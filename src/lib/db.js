/**
 * db.js — ALL Supabase data operations.
 * Column names match the ACTUAL database schema (inspected 2026-03-28).
 *
 * Key column mappings vs original design:
 *   order_tasks.completed       (not is_complete)
 *   order_tasks.time_minutes    (not actual_minutes)
 *   order_files.url             (not file_url)
 *   order_files.filename        (not file_name)
 *   materials.quantity          (not stock_quantity)
 *   overheads.amount            (not amount_per_month)
 *   profiles.role values:       'manager' | 'production' | 'accountant'
 */

import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════

export async function fetchOrders(filters = {}) {
  console.log('[DB] fetchOrders', filters)

  let q = supabase
    .from('orders')
    .select(`
      id, order_number, status, customer_name, customer_email,
      customer_phone, shipping_address, notes, tracking_token,
      shaper, shape_name, length_ft, width_in, thickness_in,
      volume_l, colour, fin_setup, fin_system, tail_shape,
      created_at, updated_at,
      order_type:order_types(id, name),
      shaper_ref:shapers(id, name),
      location:locations(id, name),
      order_tasks(id, completed, task_order)
    `)
    .order('created_at', { ascending: false })

  if (filters.location_id) q = q.eq('location_id', filters.location_id)
  if (filters.status)      q = q.eq('status', filters.status)

  const { data, error } = await q
  if (error) { console.error('[DB] fetchOrders error:', error); throw error }
  console.log('[DB] fetchOrders →', data?.length, 'rows')
  return data ?? []
}

export async function fetchOrder(id) {
  console.log('[DB] fetchOrder', id)

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_type:order_types(id, name),
      shaper_ref:shapers(id, name, royalty_rate_percent),
      location:locations(id, name),
      order_tasks(
        *,
        task_definition:task_definitions(id, name, default_order, requires_photo, estimated_min_per_foot),
        order_photos(*)
      ),
      order_files(id, filename, url, file_type, created_at, order_task_id)
    `)
    .eq('id', id)

  if (error) { console.error('[DB] fetchOrder error:', error); throw error }
  if (!data || data.length === 0) throw new Error(`Order not found: ${id}`)

  const order = data[0]
  if (order.order_tasks) {
    order.order_tasks.sort((a, b) =>
      (a.task_definition?.default_order ?? 0) - (b.task_definition?.default_order ?? 0)
    )
  }
  console.log('[DB] fetchOrder →', order.order_number)
  return order
}

export async function fetchOrderByTracking(token) {
  console.log('[DB] fetchOrderByTracking', token)

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, customer_name, created_at,
      shaper, shape_name, length_ft, width_in, thickness_in, volume_l, colour, fin_setup,
      order_tasks(
        id, completed, completed_at, task_order,
        task_definition:task_definitions(name, default_order),
        order_photos(url, created_at)
      )
    `)
    .eq('tracking_token', token)

  if (error) { console.error('[DB] fetchOrderByTracking error:', error); throw error }
  if (!data || data.length === 0) return null

  const order = data[0]
  if (order.order_tasks) {
    order.order_tasks.sort((a, b) =>
      (a.task_definition?.default_order ?? 0) - (b.task_definition?.default_order ?? 0)
    )
  }
  return order
}

export async function saveOrder(order) {
  console.log('[DB] saveOrder', order)
  const { data, error } = await supabase
    .from('orders')
    .upsert(order)
    .select()
  if (error) { console.error('[DB] saveOrder error:', error); throw error }
  return data
}

export async function createOrder({ order, userId }) {
  console.log('[DB] createOrder', order)

  const { data: orderData, error: orderErr } = await supabase
    .from('orders')
    .insert({ ...order, created_by: userId })
    .select()
  if (orderErr) { console.error('[DB] createOrder error:', orderErr); throw orderErr }

  const created = orderData[0]
  console.log('[DB] createOrder — created:', created.order_number)

  // Seed order_tasks from active task_definitions
  const { data: taskDefs, error: tdErr } = await supabase
    .from('task_definitions')
    .select('id, name, default_order')
    .eq('is_active', true)
    .order('default_order')
  if (tdErr) { console.error('[DB] createOrder — task defs error:', tdErr); throw tdErr }

  if (taskDefs?.length) {
    const tasks = taskDefs.map(td => ({
      order_id:           created.id,
      task_definition_id: td.id,
      name:               td.name,
      task_order:         td.default_order,
      completed:          false,
    }))
    const { error: tasksErr } = await supabase.from('order_tasks').insert(tasks)
    if (tasksErr) { console.error('[DB] createOrder — tasks error:', tasksErr); throw tasksErr }
    console.log('[DB] createOrder — seeded', tasks.length, 'tasks')
  }

  return created
}

// ═══════════════════════════════════════════════════════
// ORDER TASKS
// ═══════════════════════════════════════════════════════

export async function completeTask(taskId, { userId, actualMinutes, notes } = {}) {
  console.log('[DB] completeTask', taskId)
  const { data, error } = await supabase
    .from('order_tasks')
    .update({
      completed:    true,
      completed_at: new Date().toISOString(),
      completed_by: userId ?? null,
      time_minutes: actualMinutes ?? null,
      notes:        notes ?? null,
    })
    .eq('id', taskId)
    .select()
  if (error) { console.error('[DB] completeTask error:', error); throw error }
  return data
}

export async function uncompleteTask(taskId) {
  console.log('[DB] uncompleteTask', taskId)
  const { data, error } = await supabase
    .from('order_tasks')
    .update({ completed: false, completed_at: null, completed_by: null, time_minutes: null })
    .eq('id', taskId)
    .select()
  if (error) { console.error('[DB] uncompleteTask error:', error); throw error }
  return data
}

// ═══════════════════════════════════════════════════════
// FILES & PHOTOS
// ═══════════════════════════════════════════════════════

export async function uploadOrderFile({ file, orderId, orderTaskId = null, userId }) {
  console.log('[DB] uploadOrderFile', { orderId, fileName: file.name })

  const ext     = file.name.split('.').pop()
  const path    = `${orderId}/${Date.now()}.${ext}`
  const isImage = file.type.startsWith('image/')

  const { error: uploadErr } = await supabase.storage
    .from('order-files')
    .upload(path, file)
  if (uploadErr) { console.error('[DB] upload storage error:', uploadErr); throw uploadErr }

  const { data: { publicUrl } } = supabase.storage.from('order-files').getPublicUrl(path)

  if (isImage) {
    const { data, error } = await supabase
      .from('order_photos')
      .insert({ order_id: orderId, task_id: orderTaskId, url: publicUrl, caption: file.name })
      .select()
    if (error) { console.error('[DB] uploadOrderFile photo error:', error); throw error }
    return data
  } else {
    const { data, error } = await supabase
      .from('order_files')
      .insert({ order_id: orderId, order_task_id: orderTaskId, uploaded_by: userId, filename: file.name, url: publicUrl, file_type: 'document' })
      .select()
    if (error) { console.error('[DB] uploadOrderFile doc error:', error); throw error }
    return data
  }
}

export async function uploadRepairFile({ file, repairId, userId }) {
  const ext  = file.name.split('.').pop()
  const path = `${repairId}/${Date.now()}.${ext}`

  const { error: uploadErr } = await supabase.storage.from('repair-files').upload(path, file)
  if (uploadErr) throw uploadErr

  const { data: { publicUrl } } = supabase.storage.from('repair-files').getPublicUrl(path)

  const { data, error } = await supabase
    .from('repair_files')
    .insert({ repair_id: repairId, uploaded_by: userId, file_name: file.name, file_url: publicUrl, file_type: file.type.startsWith('image/') ? 'image' : 'document' })
    .select()
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════════════
// MATERIALS
// ═══════════════════════════════════════════════════════

export async function fetchMaterials() {
  console.log('[DB] fetchMaterials')
  const { data, error } = await supabase
    .from('materials')
    .select(`*, material_type:material_types(id, name, unit, is_liquid)`)
    .eq('is_active', true)
    .order('name')
  if (error) { console.error('[DB] fetchMaterials error:', error); throw error }
  return data ?? []
}

export async function saveMaterial(material) {
  console.log('[DB] saveMaterial', material)
  const { data, error } = await supabase.from('materials').upsert(material).select()
  if (error) { console.error('[DB] saveMaterial error:', error); throw error }
  return data
}

export async function fetchMaterialTypes() {
  console.log('[DB] fetchMaterialTypes')
  const { data, error } = await supabase.from('material_types').select('*').order('name')
  if (error) { console.error('[DB] fetchMaterialTypes error:', error); throw error }
  return data ?? []
}

export async function fetchMaterialRules() {
  const { data, error } = await supabase
    .from('material_rules')
    .select(`*, material:materials(name), task_definition:task_definitions(name)`)
  if (error) throw error
  return data ?? []
}

// ═══════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════

export async function fetchTaskDefinitions() {
  console.log('[DB] fetchTaskDefinitions')
  const { data, error } = await supabase.from('task_definitions').select('*').order('default_order')
  if (error) { console.error('[DB] fetchTaskDefinitions error:', error); throw error }
  return data ?? []
}

export async function saveTaskDefinition(task) {
  const { data, error } = await supabase.from('task_definitions').upsert(task).select()
  if (error) throw error
  return data
}

export async function fetchLocations() {
  console.log('[DB] fetchLocations')
  const { data, error } = await supabase.from('locations').select('*').order('name')
  if (error) { console.error('[DB] fetchLocations error:', error); throw error }
  return data ?? []
}

export async function saveLocation(location) {
  const { data, error } = await supabase.from('locations').upsert(location).select()
  if (error) throw error
  return data
}

export async function fetchShapers() {
  console.log('[DB] fetchShapers')
  const { data, error } = await supabase.from('shapers').select('*').eq('is_active', true).order('name')
  if (error) { console.error('[DB] fetchShapers error:', error); throw error }
  return data ?? []
}

export async function saveShaper(shaper) {
  const { data, error } = await supabase.from('shapers').upsert(shaper).select()
  if (error) throw error
  return data
}

export async function fetchOrderTypes() {
  console.log('[DB] fetchOrderTypes')
  const { data, error } = await supabase.from('order_types').select('*').eq('is_active', true)
  if (error) { console.error('[DB] fetchOrderTypes error:', error); throw error }
  return data ?? []
}

export async function saveOrderType(ot) {
  const { data, error } = await supabase.from('order_types').upsert(ot).select()
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════════════
// REPAIRS
// ═══════════════════════════════════════════════════════

export async function fetchRepairs() {
  console.log('[DB] fetchRepairs')
  const { data, error } = await supabase
    .from('repairs')
    .select(`*, location:locations(name), repair_files(*)`)
    .order('created_at', { ascending: false })
  if (error) { console.error('[DB] fetchRepairs error:', error); throw error }
  return data ?? []
}

export async function saveRepair(repair) {
  const { data, error } = await supabase.from('repairs').upsert(repair).select()
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════════════
// REPORTING
// ═══════════════════════════════════════════════════════

export async function fetchRoyalties(filters = {}) {
  let q = supabase
    .from('royalty_records')
    .select(`*, shaper:shapers(name), order:orders(order_number, customer_name)`)
    .order('created_at', { ascending: false })
  if (filters.is_paid !== undefined) q = q.eq('is_paid', filters.is_paid)
  if (filters.shaper_id)             q = q.eq('shaper_id', filters.shaper_id)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function saveRoyalty(royalty) {
  const { data, error } = await supabase.from('royalty_records').upsert(royalty).select()
  if (error) throw error
  return data
}

export async function fetchOverheads() {
  const { data, error } = await supabase.from('overheads').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function saveOverhead(overhead) {
  const { data, error } = await supabase.from('overheads').upsert(overhead).select()
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════════════
// PROFILES
// ═══════════════════════════════════════════════════════

export async function fetchMyProfile(userId) {
  console.log('[DB] fetchMyProfile', userId)
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId)
  if (error) { console.error('[DB] fetchMyProfile error:', error); throw error }
  return data?.[0] ?? null
}

export async function saveProfile(profile) {
  const { data, error } = await supabase.from('profiles').upsert(profile).select()
  if (error) throw error
  return data
}

export async function fetchProfiles() {
  const { data, error } = await supabase.from('profiles').select('id, full_name, role, location_id').order('full_name')
  if (error) throw error
  return data ?? []
}

export async function fetchUnits() { return [] }

/**
 * db.js — ALL Supabase data operations.
 * Single source of truth. All reads from Supabase. All writes to Supabase first.
 * Column names match actual DB schema inspected 2026-03-28.
 */

import { supabase } from './supabase'

// ─── Formula evaluator for material rules ─────────────────────
function evaluateFormula(formula, order) {
  const lengthFt      = parseFloat(order.length_ft)    || 0
  const lengthM       = lengthFt * 0.3048
  const widthIn       = parseFloat(order.width_in)      || 0
  const thicknessIn   = parseFloat(order.thickness_in)  || 0
  const volume        = parseFloat(order.volume_l)      || 0
  const finMap        = { single: 1, twin: 2, thruster: 3, quad: 4, five: 5, '2+1': 3 }
  const finCount      = finMap[(order.fin_setup || '').toLowerCase()] || 3
  // Normalise formula to lowercase variable names so LengthM, LengthFt etc all work
  const normalised = formula
    .replace(/LengthFt/g, 'lengthFt')
    .replace(/LengthM/g,  'lengthM')
    .replace(/WidthIn/g,  'widthIn')
    .replace(/ThicknessIn/g, 'thicknessIn')
    .replace(/Volume/g,   'volume')
    .replace(/FinCount/g, 'finCount')
  try {
    // eslint-disable-next-line no-new-func
    return new Function(
      'lengthFt','lengthM','widthIn','thicknessIn','volume','finCount',
      `"use strict"; return (${normalised})`
    )(lengthFt, lengthM, widthIn, thicknessIn, volume, finCount)
  } catch(e) {
    console.error('[Formula] error:', e.message, formula)
    return null
  }
}

function calculateDeduction(rule, order) {
  if (rule.deduct_type === 'fixed')   return rule.fixed_amount ?? 0
  if (rule.deduct_type === 'formula') return evaluateFormula(rule.formula, order)
  // default: ratio (qty_per_foot * length)
  return (rule.quantity_per_foot || 0) * (parseFloat(order.length_ft) || 0)
}

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
      sale_price, created_at, updated_at,
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
  const { data, error } = await supabase.from('orders').upsert(order).select()
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

  const { data: taskDefs, error: tdErr } = await supabase
    .from('task_definitions')
    .select('id, name, default_order')
    .eq('is_active', true)
    .order('default_order')
  if (tdErr) throw tdErr

  if (taskDefs?.length) {
    const tasks = taskDefs.map(td => ({
      order_id: created.id, task_definition_id: td.id,
      name: td.name, task_order: td.default_order, completed: false,
    }))
    const { error: tasksErr } = await supabase.from('order_tasks').insert(tasks)
    if (tasksErr) throw tasksErr
    console.log('[DB] createOrder — seeded', tasks.length, 'tasks')
  }
  return created
}

// ═══════════════════════════════════════════════════════
// ORDER TASKS + MATERIAL DEPLETION
// ═══════════════════════════════════════════════════════

export async function completeTask(taskId, { userId, staffId, actualMinutes, notes } = {}) {
  console.log('[DB] completeTask', taskId)
  const { data, error } = await supabase
    .from('order_tasks')
    .update({
      completed:    true,
      completed_at: new Date().toISOString(),
      completed_by: staffId ?? userId ?? null,
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

// Deduct materials when a task is completed
export async function depleteForTask({ orderId, taskDefinitionId, order }) {
  console.log('[DB] depleteForTask', { orderId, taskDefinitionId })
  const { data: rules, error } = await supabase
    .from('material_rules')
    .select(`
      *,
      material:materials(id, name, quantity, material_type:material_types(is_liquid, unit))
    `)
    .eq('task_definition_id', taskDefinitionId)
  if (error) { console.error('[DB] depleteForTask rules error:', error); throw error }
  if (!rules?.length) return []

  const depletions = []
  for (const rule of rules) {
    const qty = calculateDeduction(rule, order)
    if (qty === null || isNaN(qty) || qty <= 0) continue
    const isLiquid = !!rule.material?.material_type?.is_liquid

    if (!isLiquid) {
      const current = parseFloat(rule.material?.quantity ?? 0)
      const newQty  = Math.max(0, current - qty)
      const { error: updateErr } = await supabase
        .from('materials')
        .update({ quantity: newQty })
        .eq('id', rule.material_id)
      if (updateErr) console.error('[DB] deplete update error:', updateErr)
    }

    await supabase.from('order_material_usage').insert({
      order_id:           orderId,
      material_id:        rule.material_id,
      estimated_quantity: qty,
      actual_quantity:    isLiquid ? null : qty,
    })

    depletions.push({
      ruleId:       rule.id,
      materialId:   rule.material_id,
      materialName: rule.material?.name,
      qty:          parseFloat(qty.toFixed(4)),
      unit:         rule.material?.material_type?.unit,
      isLiquid,
    })
    console.log('[DB] depleted', rule.material?.name, qty)
  }
  return depletions
}

// Log actual liquid usage (called after staff enters amount)
export async function logActualUsage({ orderId, materialId, actualQty }) {
  console.log('[DB] logActualUsage', { materialId, actualQty })
  // Update the usage log row
  const { data: existing } = await supabase
    .from('order_material_usage')
    .select('id, estimated_quantity')
    .eq('order_id', orderId)
    .eq('material_id', materialId)
    .is('actual_quantity', null)
  
  if (existing?.length) {
    await supabase
      .from('order_material_usage')
      .update({ actual_quantity: actualQty })
      .eq('id', existing[0].id)
  } else {
    await supabase.from('order_material_usage').insert({
      order_id: orderId, material_id: materialId,
      estimated_quantity: actualQty, actual_quantity: actualQty,
    })
  }

  // Deduct from stock
  const { data: mat } = await supabase
    .from('materials').select('quantity').eq('id', materialId)
  if (mat?.[0]) {
    const newQty = Math.max(0, (mat[0].quantity ?? 0) - actualQty)
    await supabase.from('materials').update({ quantity: newQty }).eq('id', materialId)
  }
}

// ═══════════════════════════════════════════════════════
// FILES & PHOTOS
// ═══════════════════════════════════════════════════════

export async function uploadOrderFile({ file, orderId, orderTaskId = null, userId }) {
  console.log('[DB] uploadOrderFile', { orderId, fileName: file.name })
  const ext     = file.name.split('.').pop()
  const path    = `${orderId}/${Date.now()}.${ext}`
  const isImage = file.type.startsWith('image/')
  const { error: uploadErr } = await supabase.storage.from('order-files').upload(path, file)
  if (uploadErr) { console.error('[DB] upload error:', uploadErr); throw uploadErr }
  const { data: { publicUrl } } = supabase.storage.from('order-files').getPublicUrl(path)
  if (isImage) {
    const { data, error } = await supabase
      .from('order_photos')
      .insert({ order_id: orderId, task_id: orderTaskId, url: publicUrl, caption: file.name })
      .select()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('order_files')
      .insert({ order_id: orderId, order_task_id: orderTaskId, uploaded_by: userId, filename: file.name, url: publicUrl, file_type: 'document' })
      .select()
    if (error) throw error
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
    .select(`*, material_type:material_types(id, name, unit, is_liquid, category)`)
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
  if (error) throw error
  return data ?? []
}

export async function saveMaterialType(mt) {
  const { data, error } = await supabase.from('material_types').upsert(mt).select()
  if (error) throw error
  return data
}

export async function fetchMaterialRulesFull() {
  console.log('[DB] fetchMaterialRulesFull')
  const { data, error } = await supabase
    .from('material_rules')
    .select(`
      *,
      material:materials(id, name, material_type:material_types(name, unit, is_liquid)),
      task_definition:task_definitions(id, name)
    `)
  if (error) throw error
  return data ?? []
}

export async function saveMaterialRule(rule) {
  console.log('[DB] saveMaterialRule', rule)
  const payload = { ...rule }
  if (!payload.id) delete payload.id
  const { data, error } = await supabase.from('material_rules').upsert(payload).select()
  if (error) { console.error('[DB] saveMaterialRule error:', error); throw error }
  return data
}

export async function deleteMaterialRule(id) {
  console.log('[DB] deleteMaterialRule', id)
  const { error } = await supabase.from('material_rules').delete().eq('id', id)
  if (error) throw error
}

export async function fetchMaterialUsageStats() {
  console.log('[DB] fetchMaterialUsageStats')
  const { data, error } = await supabase
    .from('order_material_usage')
    .select(`material_id, estimated_quantity, actual_quantity, order:orders(length_ft)`)
  if (error) throw error

  const stats = {}
  for (const row of data ?? []) {
    if (!stats[row.material_id]) stats[row.material_id] = { est: [], actual: [] }
    const ft = parseFloat(row.order?.length_ft) || 0
    if (ft > 0 && row.estimated_quantity) stats[row.material_id].est.push(row.estimated_quantity / ft)
    if (ft > 0 && row.actual_quantity)    stats[row.material_id].actual.push(row.actual_quantity / ft)
  }

  const result = {}
  for (const [id, s] of Object.entries(stats)) {
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
    result[id] = {
      estAvgPerFt:    avg(s.est),
      actualAvgPerFt: avg(s.actual),
      sampleCount:    s.actual.length,
    }
  }
  return result
}

// ═══════════════════════════════════════════════════════
// STAFF
// ═══════════════════════════════════════════════════════

export async function fetchStaff() {
  console.log('[DB] fetchStaff')
  const { data, error } = await supabase.from('staff').select('*').eq('is_active', true).order('name')
  if (error) { console.error('[DB] fetchStaff error:', error); throw error }
  return data ?? []
}

export async function saveStaff(staff) {
  console.log('[DB] saveStaff', staff)
  const payload = { ...staff }
  if (!payload.id) delete payload.id
  const { data, error } = await supabase.from('staff').upsert(payload).select()
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════

export async function getSetting(key) {
  const { data } = await supabase.from('settings').select('value').eq('key', key)
  return data?.[0]?.value ?? null
}

export async function getSettings(keys) {
  const { data } = await supabase.from('settings').select('key, value').in('key', keys)
  const result = {}
  for (const row of data ?? []) result[row.key] = row.value
  return result
}

export async function setSetting(key, value) {
  const { error } = await supabase.from('settings').upsert({ key, value })
  if (error) throw error
}

export async function setSettings(obj) {
  const rows = Object.entries(obj).map(([key, value]) => ({ key, value }))
  const { error } = await supabase.from('settings').upsert(rows)
  if (error) throw error
}

export async function fetchTaskDefinitions() {
  console.log('[DB] fetchTaskDefinitions')
  const { data, error } = await supabase.from('task_definitions').select('*').order('default_order')
  if (error) throw error
  return data ?? []
}

export async function saveTaskDefinition(task) {
  const payload = { ...task }
  if (!payload.id) delete payload.id
  const { data, error } = await supabase.from('task_definitions').upsert(payload).select()
  if (error) throw error
  return data
}

export async function fetchLocations() {
  console.log('[DB] fetchLocations')
  const { data, error } = await supabase.from('locations').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function saveLocation(location) {
  const payload = { ...location }
  if (!payload.id) delete payload.id
  const { data, error } = await supabase.from('locations').upsert(payload).select()
  if (error) throw error
  return data
}

export async function fetchShapers() {
  console.log('[DB] fetchShapers')
  const { data, error } = await supabase.from('shapers').select('*').eq('is_active', true).order('name')
  if (error) throw error
  return data ?? []
}

export async function saveShaper(shaper) {
  const payload = { ...shaper }
  if (!payload.id) delete payload.id
  const { data, error } = await supabase.from('shapers').upsert(payload).select()
  if (error) throw error
  return data
}

export async function fetchOrderTypes() {
  const { data, error } = await supabase.from('order_types').select('*').eq('is_active', true)
  if (error) throw error
  return data ?? []
}

export async function saveOrderType(ot) {
  const payload = { ...ot }
  if (!payload.id) delete payload.id
  const { data, error } = await supabase.from('order_types').upsert(payload).select()
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
  if (error) throw error
  return data ?? []
}

export async function saveRepair(repair) {
  const payload = { ...repair }
  if (!payload.id) delete payload.id
  const { data, error } = await supabase.from('repairs').upsert(payload).select()
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════════════
// REPORTING
// ═══════════════════════════════════════════════════════

export async function fetchReportOrders() {
  console.log('[DB] fetchReportOrders')
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, customer_name, sale_price,
      shaper, shape_name, length_ft, created_at, updated_at,
      shaper_ref:shapers(id, name, royalty_rate_percent),
      order_tasks(id, completed, time_minutes, completed_by, task_definition:task_definitions(name))
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchMaterialUsageForReports() {
  const { data, error } = await supabase
    .from('order_material_usage')
    .select(`
      order_id, material_id, actual_quantity,
      material:materials(cost_per_unit, name, material_type:material_types(unit))
    `)
  if (error) throw error
  return data ?? []
}

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
  const payload = { ...overhead }
  if (!payload.id) delete payload.id
  const { data, error } = await supabase.from('overheads').upsert(payload).select()
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════════════
// PROFILES
// ═══════════════════════════════════════════════════════

export async function fetchMyProfile(userId) {
  console.log('[DB] fetchMyProfile', userId)
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId)
  if (error) throw error
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
export async function fetchMaterialRules() { return fetchMaterialRulesFull() }

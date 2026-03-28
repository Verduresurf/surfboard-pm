import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  fetchOrder, completeTask, uncompleteTask, saveOrder,
  uploadOrderFile, depleteForTask, logActualUsage,
  fetchStaff, getSettings
} from '../lib/db'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useWorker } from '../contexts/WorkerContext'

const FIN_SETUPS  = ['Single','Twin','Thruster','Quad','Five','2+1']
const FIN_SYSTEMS = ['FCS II','Futures','US Box','Glassed in']
const TAIL_SHAPES = ['Round','Squash','Square','Pin','Swallow','Bat','Fish','Asymmetric']
const STATUSES    = ['pending','in_progress','completed','shipped','cancelled']

function ftToDisplay(ft) {
  if (!ft) return null
  const total  = Math.round(parseFloat(ft) * 12)
  const feet   = Math.floor(total / 12)
  const inches = total % 12
  return inches ? `${feet}'${inches}"` : `${feet}'`
}

function inToFraction(dec) {
  if (!dec) return null
  const whole = Math.floor(parseFloat(dec))
  const frac  = parseFloat(dec) - whole
  const fracs = [[0,''], [0.0625,'1/16'], [0.125,'1/8'], [0.1875,'3/16'], [0.25,'1/4'], [0.3125,'5/16'], [0.375,'3/8'], [0.4375,'7/16'], [0.5,'1/2'], [0.5625,'9/16'], [0.625,'5/8'], [0.6875,'11/16'], [0.75,'3/4'], [0.8125,'13/16'], [0.875,'7/8'], [0.9375,'15/16']]
  const closest = fracs.reduce((a, b) => Math.abs(b[0] - frac) < Math.abs(a[0] - frac) ? b : a)
  return closest[1] ? `${whole} ${closest[1]}"` : `${whole}"`
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isManager } = useAuth()
  const { activeWorker, selectWorker } = useWorker()

  const [order, setOrder]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [taskModal, setTaskModal]     = useState(null)
  const [liquidModal, setLiquidModal] = useState(null)
  const [editModal, setEditModal]     = useState(null)
  const [uploading, setUploading]     = useState(false)
  const [staff, setStaff]             = useState([])
  const [settings, setSettings]       = useState({})
  const [showStaff, setShowStaff]     = useState(false)
  const fileRef = useRef()

  async function load() {
    setLoading(true); setError(null)
    try {
      const [data, st, sett] = await Promise.all([
        fetchOrder(id),
        fetchStaff(),
        getSettings(['track_task_time','track_material_usage']),
      ])
      setOrder(data); setStaff(st); setSettings(sett)
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    const ch = supabase.channel(`order-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tasks', filter: `order_id=eq.${id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [id])

  async function handleStatusChange(newStatus) {
    try { await saveOrder({ id: order.id, status: newStatus }); setOrder(o => ({ ...o, status: newStatus })) }
    catch(e) { alert('Failed: ' + e.message) }
  }

  async function handleDelete() {
    if (!confirm('Delete this order? This cannot be undone.')) return
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id)
      if (error) throw error
      navigate('/orders')
    } catch(e) { alert('Delete failed: ' + e.message) }
  }

  async function handleSaveSpecs(data) {
    try { await saveOrder({ id: order.id, ...data }); setEditModal(null); load() }
    catch(e) { alert('Save failed: ' + e.message) }
  }

  async function handleTaskToggle(task) {
    if (!task.completed) setTaskModal(task)
    else { try { await uncompleteTask(task.id); load() } catch(e) { alert(e.message) } }
  }

  async function handleCompleteTask({ minutes, notes }) {
    if (!taskModal) return
    try {
      await completeTask(taskModal.id, {
        userId: user?.id,
        staffId: activeWorker?.id ?? null,
        actualMinutes: minutes ? parseInt(minutes) : null,
        notes,
      })
      const depletions = await depleteForTask({
        orderId: order.id,
        taskDefinitionId: taskModal.task_definition_id,
        order,
      })
      setTaskModal(null)
      const liquids = depletions.filter(d => d.isLiquid)
      if (liquids.length && settings.track_material_usage === 'true') {
        setLiquidModal({ liquids, orderId: order.id })
      }
      load()
    } catch(e) { alert('Error: ' + e.message) }
  }

  async function handleLiquidLog(entries) {
    try {
      for (const [materialId, qty] of Object.entries(entries)) {
        if (qty) await logActualUsage({ orderId: liquidModal.orderId, materialId, actualQty: parseFloat(qty) })
      }
    } catch(e) { console.error(e) }
    setLiquidModal(null); load()
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    try { for (const f of files) await uploadOrderFile({ file: f, orderId: id, userId: user?.id }); load() }
    catch(e) { alert('Upload failed: ' + e.message) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  if (loading) return <div className="loading-spinner">LOADING ORDER…</div>
  if (error)   return <div className="page-body"><div className="error-msg">{error}</div><button className="btn btn-ghost mt-4" onClick={() => navigate('/orders')}>← Orders</button></div>
  if (!order)  return null

  const tasks     = order.order_tasks ?? []
  const doneTasks = tasks.filter(t => t.completed).length
  const pct       = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0
  const allPhotos = tasks.flatMap(t => (t.order_photos ?? []).map(p => ({ ...p, taskName: t.task_definition?.name })))
  const files     = order.order_files ?? []
  const trackingUrl = `${window.location.origin}/track/${order.tracking_token}`

  return (
    <>
      <div className="page-header" style={{ gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>{order.order_number}</div>
          <h1 style={{ fontSize: '1.3rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.customer_name}</h1>
        </div>
        {isManager && (
          <select className="form-select" value={order.status} onChange={e => handleStatusChange(e.target.value)} style={{ width: 'auto' }}>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
        )}
        {isManager && (
          <button className="btn btn-danger btn-sm" onClick={handleDelete} title="Delete order">🗑</button>
        )}
      </div>

      <div className="page-body">
        {/* Staff selector */}
        {staff.length > 0 && (
          <div style={{ background: activeWorker ? 'var(--accent-pale)' : 'var(--surface2)', border: '1px solid', borderColor: activeWorker ? 'var(--accent-dim)' : 'var(--border)', borderRadius: 'var(--r)', padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            onClick={() => setShowStaff(!showStaff)}>
            <span>👤</span>
            <div style={{ flex: 1 }}>
              {activeWorker
                ? <span style={{ fontWeight: 500, color: 'var(--accent-text)' }}>Working as: {activeWorker.name}</span>
                : <span style={{ color: 'var(--text-muted)' }}>Select your name before ticking tasks so your work is recorded</span>
              }
            </div>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{showStaff ? '▲' : '▼'}</span>
          </div>
        )}
        {showStaff && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {staff.map(s => (
              <button key={s.id} type="button"
                onClick={() => { selectWorker(activeWorker?.id === s.id ? null : s); setShowStaff(false) }}
                style={{ padding: '8px 18px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontFamily: 'var(--font-head)', fontSize: '0.95rem', transition: 'all 0.15s', borderColor: activeWorker?.id === s.id ? 'var(--accent)' : 'var(--border)', background: activeWorker?.id === s.id ? 'var(--accent-pale)' : 'var(--surface2)', color: activeWorker?.id === s.id ? 'var(--accent-text)' : 'var(--text)' }}>
                {s.name}
              </button>
            ))}
          </div>
        )}

        <div className="detail-layout">
          <div>
            {/* Progress */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600 }}>Production Progress</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: pct === 100 ? 'var(--success)' : 'var(--accent-text)', fontSize: '1.1rem' }}>{pct}%</div>
              </div>
              <div style={{ height: 10, background: 'var(--surface3)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 99, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doneTasks} of {tasks.length} steps complete</div>
            </div>

            {/* Tasks */}
            <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600 }}>Production Tasks</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>{doneTasks}/{tasks.length}</div>
              </div>
              {tasks.length === 0
                ? <div style={{ padding: 16, color: 'var(--text-dim)', fontSize: '0.85rem' }}>No tasks assigned</div>
                : tasks.map(task => (
                  <div key={task.id} onClick={() => handleTaskToggle(task)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${task.completed ? 'var(--success)' : 'var(--border2)'}`, background: task.completed ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                      {task.completed && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><polyline points="1.5,6 4.5,9 9.5,2" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: task.completed ? 'var(--text-dim)' : 'var(--text)', textDecoration: task.completed ? 'line-through' : 'none', fontSize: '0.92rem' }}>
                        {task.task_definition?.name ?? task.name}
                      </div>
                      {task.completed && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 2 }}>
                          {task.completed_by ? `${staff.find(s => s.id === task.completed_by)?.name ?? 'Unknown'} · ` : ''}
                          {task.completed_at && new Date(task.completed_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {task.time_minutes ? ` · ${task.time_minutes}min` : ''}
                        </div>
                      )}
                    </div>
                    {task.task_definition?.requires_photo && !task.completed && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--accent-text)', background: 'var(--accent-pale)', padding: '2px 7px', borderRadius: 4 }}>PHOTO</span>
                    )}
                    {task.completed && task.order_photos?.length > 0 && <span style={{ fontSize: '0.8rem' }}>📷</span>}
                  </div>
                ))
              }
            </div>

            {/* Photos & Files */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600 }}>Photos & Files</div>
                <div>
                  <input type="file" ref={fileRef} multiple accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} style={{ display: 'none' }} id="file-upload" />
                  <label htmlFor="file-upload" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>{uploading ? 'Uploading…' : '+ Upload'}</label>
                </div>
              </div>
              {allPhotos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginBottom: 12 }}>
                  {allPhotos.map((photo, i) => (
                    <a key={i} href={photo.url} target="_blank" rel="noopener noreferrer">
                      <img src={photo.url} alt={photo.taskName} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--r)', border: '1px solid var(--border)', display: 'block' }} />
                    </a>
                  ))}
                </div>
              )}
              {files.length > 0 && <div className="uploaded-files">{files.map(f => <div key={f.id} className="file-row"><span>📄</span><a href={f.url} target="_blank" rel="noopener noreferrer">{f.filename}</a></div>)}</div>}
              {allPhotos.length === 0 && files.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No files uploaded yet</div>}
            </div>
          </div>

          {/* Sidebar */}
          <div className="detail-sidebar">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600 }}>Board Specs</div>
                {isManager && <button className="btn btn-ghost btn-sm" onClick={() => setEditModal('specs')}>Edit</button>}
              </div>
              {(order.shape_name || order.shaper) && (
                <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  {order.shaper && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-text)', marginBottom: 3 }}>{order.shaper}</div>}
                  {order.shape_name && <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{order.shape_name}</div>}
                </div>
              )}
              {(order.length_ft || order.width_in || order.thickness_in) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {order.length_ft    && <SpecBox label="Length" value={ftToDisplay(order.length_ft)} />}
                  {order.width_in     && <SpecBox label="Width"  value={inToFraction(order.width_in)} />}
                  {order.thickness_in && <SpecBox label="Thick"  value={inToFraction(order.thickness_in)} />}
                </div>
              )}
              {order.volume_l && <div style={{ marginBottom: 12 }}><SpecBox label="Volume" value={`${parseFloat(order.volume_l).toFixed(2)}L`} wide /></div>}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {order.colour     && <SpecRow label="Colour"     value={order.colour} />}
                {order.fin_setup  && <SpecRow label="Fin setup"  value={order.fin_setup} />}
                {order.fin_system && <SpecRow label="Fin system" value={order.fin_system} />}
                {order.tail_shape && <SpecRow label="Tail"       value={order.tail_shape} />}
                {order.sale_price && <SpecRow label="Sale price" value={`$${parseFloat(order.sale_price).toFixed(2)}`} accent />}
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600 }}>Customer</div>
                {isManager && <button className="btn btn-ghost btn-sm" onClick={() => setEditModal('customer')}>Edit</button>}
              </div>
              {order.customer_email   && <SpecRow label="Email"   value={order.customer_email} />}
              {order.customer_phone   && <SpecRow label="Phone"   value={order.customer_phone} />}
              {order.shipping_address && <SpecRow label="Ship to" value={order.shipping_address} />}
              {!order.customer_email && !order.customer_phone && !order.shipping_address && (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No customer details — click Edit to add</div>
              )}
            </div>

            <div className="card">
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, marginBottom: 10 }}>Customer Tracking</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>{trackingUrl}</div>
              <button className="btn btn-secondary btn-sm w-full" onClick={() => navigator.clipboard.writeText(trackingUrl).then(() => alert('Link copied!'))}>Copy Link</button>
            </div>

            {order.notes && (
              <div className="card">
                <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, marginBottom: 8 }}>Notes</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{order.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {taskModal && <CompleteTaskModal task={taskModal} trackTime={settings.track_task_time === 'true'} onConfirm={handleCompleteTask} onClose={() => setTaskModal(null)} />}
      {liquidModal && <LiquidUsageModal liquids={liquidModal.liquids} onConfirm={handleLiquidLog} onClose={() => setLiquidModal(null)} />}
      {editModal === 'specs'    && <EditSpecsModal    order={order} onSave={handleSaveSpecs} onClose={() => setEditModal(null)} />}
      {editModal === 'customer' && <EditCustomerModal order={order} onSave={handleSaveSpecs} onClose={() => setEditModal(null)} />}
    </>
  )
}

function SpecBox({ label, value, wide }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 10px', textAlign: 'center', gridColumn: wide ? '1 / -1' : undefined }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1rem' }}>{value}</div>
    </div>
  )
}

function SpecRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', paddingTop: 1 }}>{label}</div>
      <div style={{ fontWeight: 500, fontSize: '0.88rem', textAlign: 'right', color: accent ? 'var(--accent-text)' : 'var(--text)', maxWidth: '60%', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

function CompleteTaskModal({ task, trackTime, onConfirm, onClose }) {
  const [minutes, setMinutes] = useState('')
  const [notes, setNotes]     = useState('')
  const [loading, setLoading] = useState(false)
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Complete: {task.task_definition?.name ?? task.name}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={async e => { e.preventDefault(); setLoading(true); await onConfirm({ minutes, notes }); setLoading(false) }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {trackTime && (
              <div className="form-group">
                <label className="form-label">Time taken (minutes)</label>
                <input className="form-input" type="number" min="1" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="e.g. 45" autoFocus />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
            {task.task_definition?.requires_photo && (
              <div style={{ background: 'var(--accent-pale)', border: '1px solid rgba(245,147,22,0.3)', borderRadius: 'var(--r)', padding: '10px 14px', color: 'var(--accent-text)', fontSize: '0.85rem' }}>
                ⚠ Remember to upload a photo for this task
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Mark Complete'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LiquidUsageModal({ liquids, onConfirm, onClose }) {
  const [entries, setEntries] = useState({})
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">Log liquid usage</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Enter actual amounts used. Leave blank to skip.</div>
          {liquids.map(l => (
            <div key={l.materialId} className="form-group">
              <label className="form-label">{l.materialName} <span className="muted">({l.unit}) — est: {l.qty}</span></label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="form-input" type="number" step="0.001" placeholder={`${l.qty}`} value={entries[l.materialId] ?? ''} onChange={e => setEntries(p => ({ ...p, [l.materialId]: e.target.value }))} />
                <span className="muted" style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{l.unit}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Skip</button>
          <button className="btn btn-primary" onClick={() => onConfirm(entries)}>Save Usage</button>
        </div>
      </div>
    </div>
  )
}

function EditSpecsModal({ order, onSave, onClose }) {
  const [form, setForm] = useState({
    shaper: order.shaper ?? '', shape_name: order.shape_name ?? '',
    length_ft: order.length_ft ?? '', width_in: order.width_in ?? '',
    thickness_in: order.thickness_in ?? '', volume_l: order.volume_l ?? '',
    colour: order.colour ?? '', fin_setup: order.fin_setup ?? '',
    fin_system: order.fin_system ?? '', tail_shape: order.tail_shape ?? '',
    sale_price: order.sale_price ?? '', notes: order.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header"><div className="modal-title">Edit Board Specs</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={async e => {
          e.preventDefault(); setLoading(true)
          await onSave({ ...form, length_ft: form.length_ft ? parseFloat(form.length_ft) : null, width_in: form.width_in ? parseFloat(form.width_in) : null, thickness_in: form.thickness_in ? parseFloat(form.thickness_in) : null, volume_l: form.volume_l ? parseFloat(form.volume_l) : null, sale_price: form.sale_price ? parseFloat(form.sale_price) : null })
          setLoading(false)
        }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Shaper</label><input className="form-input" value={form.shaper} onChange={e => setForm(f => ({ ...f, shaper: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Shape name</label><input className="form-input" value={form.shape_name} onChange={e => setForm(f => ({ ...f, shape_name: e.target.value }))} /></div>
            </div>
            <div className="form-row form-row-3">
              <div className="form-group"><label className="form-label">Length (ft)</label><input className="form-input" type="number" step="0.01" value={form.length_ft} onChange={e => setForm(f => ({ ...f, length_ft: e.target.value }))} placeholder="6.17" /></div>
              <div className="form-group"><label className="form-label">Width (in)</label><input className="form-input" type="number" step="0.0625" value={form.width_in} onChange={e => setForm(f => ({ ...f, width_in: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Thickness (in)</label><input className="form-input" type="number" step="0.0625" value={form.thickness_in} onChange={e => setForm(f => ({ ...f, thickness_in: e.target.value }))} /></div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Volume (L)</label><input className="form-input" type="number" step="0.01" value={form.volume_l} onChange={e => setForm(f => ({ ...f, volume_l: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Colour</label><input className="form-input" value={form.colour} onChange={e => setForm(f => ({ ...f, colour: e.target.value }))} /></div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Fin setup</label>
                <select className="form-select" value={form.fin_setup} onChange={e => setForm(f => ({ ...f, fin_setup: e.target.value }))}><option value="">—</option>{FIN_SETUPS.map(v => <option key={v} value={v}>{v}</option>)}</select>
              </div>
              <div className="form-group"><label className="form-label">Fin system</label>
                <select className="form-select" value={form.fin_system} onChange={e => setForm(f => ({ ...f, fin_system: e.target.value }))}><option value="">—</option>{FIN_SYSTEMS.map(v => <option key={v} value={v}>{v}</option>)}</select>
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Tail shape</label>
                <select className="form-select" value={form.tail_shape} onChange={e => setForm(f => ({ ...f, tail_shape: e.target.value }))}><option value="">—</option>{TAIL_SHAPES.map(v => <option key={v} value={v}>{v}</option>)}</select>
              </div>
              <div className="form-group"><label className="form-label">Sale price ($)</label><input className="form-input" type="number" step="0.01" value={form.sale_price} onChange={e => setForm(f => ({ ...f, sale_price: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditCustomerModal({ order, onSave, onClose }) {
  const [form, setForm] = useState({ customer_name: order.customer_name ?? '', customer_email: order.customer_email ?? '', customer_phone: order.customer_phone ?? '', shipping_address: order.shipping_address ?? '' })
  const [loading, setLoading] = useState(false)
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">Edit Customer</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={async e => { e.preventDefault(); setLoading(true); await onSave(form); setLoading(false) }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.customer_name} autoFocus onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} /></div>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Shipping address</label><textarea className="form-textarea" rows={2} value={form.shipping_address} onChange={e => setForm(f => ({ ...f, shipping_address: e.target.value }))} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

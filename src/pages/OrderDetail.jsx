import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchOrder, completeTask, uncompleteTask, saveOrder, uploadOrderFile, depleteForTask, logActualUsage, fetchStaff, getSettings } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
}

const STATUSES = ['pending','in_progress','completed','shipped','cancelled']

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isManager } = useAuth()

  const [order, setOrder]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [taskModal, setTaskModal]   = useState(null)
  const [liquidModal, setLiquidModal] = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [staff, setStaff]           = useState([])
  const [settings, setSettings]     = useState({})
  const fileRef = useRef()

  async function load() {
    setLoading(true); setError(null)
    try {
      const [data, st, sett] = await Promise.all([
        fetchOrder(id),
        fetchStaff(),
        getSettings(['track_task_time', 'track_material_usage']),
      ])
      setOrder(data)
      setStaff(st)
      setSettings(sett)
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`order-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tasks', filter: `order_id=eq.${id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [id])

  async function handleStatusChange(newStatus) {
    try { await saveOrder({ id: order.id, status: newStatus }); setOrder(o => ({ ...o, status: newStatus })) }
    catch(e) { alert('Failed to update status: ' + e.message) }
  }

  async function handleTaskToggle(task) {
    if (!task.completed) {
      setTaskModal(task)
    } else {
      try { await uncompleteTask(task.id); load() } catch(e) { alert(e.message) }
    }
  }

  async function handleCompleteTask({ minutes, notes, staffId }) {
    if (!taskModal) return
    try {
      await completeTask(taskModal.id, { userId: user.id, staffId, actualMinutes: minutes ? parseInt(minutes) : null, notes })

      // Auto-deduct materials
      const depletions = await depleteForTask({
        orderId: order.id,
        taskDefinitionId: taskModal.task_definition_id,
        order,
      })

      setTaskModal(null)

      // If any liquid materials, prompt for actual amount
      const liquids = depletions.filter(d => d.isLiquid)
      if (liquids.length && settings.track_material_usage === 'true') {
        setLiquidModal({ liquids, orderId: order.id })
      }

      load()
    } catch(e) {
      alert('Error completing task: ' + e.message)
    }
  }

  async function handleLiquidLog(entries) {
    try {
      for (const [materialId, qty] of Object.entries(entries)) {
        if (qty) await logActualUsage({ orderId: liquidModal.orderId, materialId, actualQty: parseFloat(qty) })
      }
    } catch(e) { console.error(e) }
    setLiquidModal(null)
    load()
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    try { for (const f of files) await uploadOrderFile({ file: f, orderId: id, userId: user.id }); load() }
    catch(e) { alert('Upload failed: ' + e.message) }
    finally { setUploading(false); fileRef.current.value = '' }
  }

  const trackingUrl = order ? `${window.location.origin}/track/${order.tracking_token}` : ''

  if (loading) return <div className="loading-spinner">LOADING ORDER…</div>
  if (error)   return <div className="page-body"><div className="error-msg">{error}</div><button className="btn btn-ghost mt-4" onClick={() => navigate('/orders')}>← Orders</button></div>
  if (!order)  return null

  const tasks  = order.order_tasks ?? []
  const files  = order.order_files ?? []
  const photos = order.order_photos ?? []
  const allPhotos = tasks.flatMap(t => (t.order_photos ?? []).map(p => ({ ...p, taskName: t.task_definition?.name })))
  const doneTasks = tasks.filter(t => t.completed).length

  return (
    <>
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>{order.order_number}</div>
          <h1 style={{ fontSize: '1.4rem' }}>{order.customer_name}</h1>
        </div>
        <StatusBadge status={order.status} />
        {isManager && (
          <select className="form-select" value={order.status} onChange={e => handleStatusChange(e.target.value)} style={{ width: 'auto' }}>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        )}
      </div>

      <div className="page-body">
        <div className="detail-layout">
          <div>
            {/* Tasks */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div className="card-title">Production Tasks</div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doneTasks}/{tasks.length}</span>
              </div>
              {tasks.length === 0
                ? <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No tasks assigned</div>
                : (
                  <div className="task-list">
                    {tasks.map(task => (
                      <div key={task.id} className={`task-item${task.completed ? ' complete' : ''}`} onClick={() => handleTaskToggle(task)}>
                        <div className="task-check">
                          {task.completed && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5.5 4,8 8.5,2" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <div className="task-name">{task.task_definition?.name ?? task.name}</div>
                        {task.completed && (
                          <div className="task-meta">
                            {task.time_minutes && `${task.time_minutes}min · `}
                            {task.completed_at && new Date(task.completed_at).toLocaleDateString()}
                          </div>
                        )}
                        {task.task_definition?.requires_photo && !task.completed && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent-text)', background: 'var(--accent-pale)', padding: '2px 6px', borderRadius: 4 }}>PHOTO</span>
                        )}
                      </div>
                    ))}
                  </div>
                )
              }
            </div>

            {/* Photos & Files */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Photos & Files</div>
                <div>
                  <input type="file" ref={fileRef} multiple accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} style={{ display: 'none' }} id="file-upload" />
                  <label htmlFor="file-upload" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    {uploading ? 'Uploading…' : '+ Upload'}
                  </label>
                </div>
              </div>

              {allPhotos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 12 }}>
                  {allPhotos.map((photo, i) => (
                    <a key={i} href={photo.url} target="_blank" rel="noopener noreferrer">
                      <img src={photo.url} alt={photo.taskName} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--r)', border: '1px solid var(--border)', display: 'block' }} />
                    </a>
                  ))}
                </div>
              )}

              {files.length > 0 && (
                <div className="uploaded-files">
                  {files.map(f => (
                    <div key={f.id} className="file-row">
                      <span>📄</span>
                      <a href={f.url} target="_blank" rel="noopener noreferrer">{f.filename}</a>
                    </div>
                  ))}
                </div>
              )}

              {allPhotos.length === 0 && files.length === 0 && (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No files uploaded yet</div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="detail-sidebar">
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Board Specs</div>
              <div className="spec-grid">
                <SpecItem label="Shape"      value={order.shape_name} />
                <SpecItem label="Shaper"     value={order.shaper} accent />
                <SpecItem label="Length"     value={order.length_ft ? `${order.length_ft}′` : null} />
                <SpecItem label="Width"      value={order.width_in ? `${order.width_in}″` : null} />
                <SpecItem label="Thickness"  value={order.thickness_in ? `${order.thickness_in}″` : null} />
                <SpecItem label="Volume"     value={order.volume_l ? `${order.volume_l}L` : null} />
                <SpecItem label="Colour"     value={order.colour} />
                <SpecItem label="Fin setup"  value={order.fin_setup} />
                <SpecItem label="Fin system" value={order.fin_system} />
                <SpecItem label="Tail"       value={order.tail_shape} />
                {order.sale_price && <SpecItem label="Price" value={`$${parseFloat(order.sale_price).toFixed(2)}`} accent />}
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Customer</div>
              {order.customer_email && <div style={{ marginBottom: 8 }}><div className="spec-label">Email</div><div style={{ fontSize: '0.85rem' }}>{order.customer_email}</div></div>}
              {order.customer_phone && <div style={{ marginBottom: 8 }}><div className="spec-label">Phone</div><div style={{ fontSize: '0.85rem' }}>{order.customer_phone}</div></div>}
              {order.shipping_address && <div><div className="spec-label">Ship to</div><div style={{ fontSize: '0.85rem' }}>{order.shipping_address}</div></div>}
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Customer Tracking</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{trackingUrl}</div>
              <button className="btn btn-secondary btn-sm w-full" onClick={() => navigator.clipboard.writeText(trackingUrl).then(() => alert('Link copied!'))}>Copy Link</button>
            </div>

            {order.notes && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: 8 }}>Notes</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{order.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {taskModal && (
        <CompleteTaskModal
          task={taskModal}
          staff={staff}
          trackTime={settings.track_task_time === 'true'}
          onConfirm={handleCompleteTask}
          onClose={() => setTaskModal(null)}
        />
      )}

      {liquidModal && (
        <LiquidUsageModal
          liquids={liquidModal.liquids}
          onConfirm={handleLiquidLog}
          onClose={() => setLiquidModal(null)}
        />
      )}
    </>
  )
}

function SpecItem({ label, value, accent }) {
  if (!value) return null
  return (
    <div className="spec-item">
      <div className="spec-label">{label}</div>
      <div className="spec-value" style={accent ? { color: 'var(--accent-text)' } : {}}>{value}</div>
    </div>
  )
}

function CompleteTaskModal({ task, staff, trackTime, onConfirm, onClose }) {
  const [minutes, setMinutes] = useState('')
  const [notes, setNotes]     = useState('')
  const [staffId, setStaffId] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await onConfirm({ minutes, notes, staffId: staffId || null })
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Complete: {task.task_definition?.name ?? task.name}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {staff.length > 0 && (
              <div className="form-group">
                <label className="form-label">Who completed this?</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {staff.map(s => (
                    <button key={s.id} type="button"
                      onClick={() => setStaffId(staffId === s.id ? '' : s.id)}
                      style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontFamily: 'var(--font-head)', fontSize: '0.9rem', transition: 'all 0.15s', borderColor: staffId === s.id ? 'var(--accent)' : 'var(--border)', background: staffId === s.id ? 'var(--accent-pale)' : 'var(--surface2)', color: staffId === s.id ? 'var(--accent-text)' : 'var(--text-muted)' }}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
        <div className="modal-header">
          <div className="modal-title">Log liquid usage</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Enter the actual amounts used for liquid materials. Leave blank to skip.
          </div>
          {liquids.map(l => (
            <div key={l.materialId} className="form-group">
              <label className="form-label">{l.materialName} <span className="muted">({l.unit})</span></label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="form-input" type="number" step="0.001" placeholder={`Est: ${l.qty}`}
                  value={entries[l.materialId] ?? ''} onChange={e => setEntries(p => ({ ...p, [l.materialId]: e.target.value }))} />
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{l.unit}</span>
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

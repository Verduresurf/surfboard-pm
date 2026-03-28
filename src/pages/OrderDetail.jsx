import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchOrder, completeTask, uncompleteTask, saveOrder, uploadOrderFile } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
}

const STATUSES = ['pending', 'in_progress', 'completed', 'shipped', 'cancelled']

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isManager } = useAuth()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [taskModal, setTaskModal] = useState(null) // task being completed
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOrder(id)
      setOrder(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  // Realtime subscription for this order's tasks
  useEffect(() => {
    const channel = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_tasks',
        filter: `order_id=eq.${id}`,
      }, (payload) => {
        console.log('[Realtime] order_tasks change:', payload)
        load()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id])

  async function handleStatusChange(newStatus) {
    try {
      await saveOrder({ id: order.id, status: newStatus })
      setOrder(o => ({ ...o, status: newStatus }))
    } catch (e) {
      alert('Failed to update status: ' + e.message)
    }
  }

  async function handleTaskToggle(task) {
    if (!task.completed) {
      // Open modal to capture time + notes
      if (task.task_definition?.requires_photo) {
        setTaskModal({ ...task, requiresPhoto: true })
      } else {
        setTaskModal(task)
      }
    } else {
      // Uncomplete
      try {
        await uncompleteTask(task.id)
        load()
      } catch (e) {
        alert('Error: ' + e.message)
      }
    }
  }

  async function handleCompleteTask({ minutes, notes }) {
    if (!taskModal) return
    try {
      await completeTask(taskModal.id, {
        userId: user.id,
        actualMinutes: minutes ? parseInt(minutes) : null,
        notes,
      })
      setTaskModal(null)
      load()
    } catch (e) {
      alert('Error completing task: ' + e.message)
    }
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        await uploadOrderFile({ file, orderId: id, userId: user.id })
      }
      load()
    } catch (e) {
      alert('Upload failed: ' + e.message)
    } finally {
      setUploading(false)
      fileRef.current.value = ''
    }
  }

  const trackingUrl = order
    ? `${window.location.origin}/track/${order.tracking_token}`
    : ''

  if (loading) return <div className="loading-spinner">LOADING ORDER…</div>
  if (error) return (
    <div className="page-body">
      <div className="error-msg">{error}</div>
      <button className="btn btn-ghost mt-4" onClick={() => navigate('/orders')}>← Orders</button>
    </div>
  )
  if (!order) return null

  const spec = order.board_specs ?? {}
  const tasks = order.order_tasks ?? []
  const files = order.order_files ?? []
  const doneTasks = tasks.filter(t => t.completed).length

  return (
    <>
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
            {order.order_number}
          </div>
          <h1 style={{ fontSize: '1.4rem' }}>{order.customer_name}</h1>
        </div>
        <StatusBadge status={order.status} />
        {isManager && (
          <select
            className="form-select"
            value={order.status}
            onChange={e => handleStatusChange(e.target.value)}
            style={{ width: 'auto' }}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        )}
      </div>

      <div className="page-body">
        <div className="detail-layout">
          {/* Main column */}
          <div>
            {/* Tasks */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div className="card-title">Production Tasks</div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {doneTasks}/{tasks.length} complete
                </span>
              </div>

              {tasks.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No tasks assigned</div>
              ) : (
                <div className="task-list">
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className={`task-item${task.completed ? ' complete' : ''}`}
                      onClick={() => handleTaskToggle(task)}
                    >
                      <div className="task-check">
                        {task.completed && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <polyline points="1.5,5.5 4,8 8.5,2" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div className="task-name">{task.task_definition?.name}</div>
                      {task.completed && (
                        <div className="task-meta">
                          {task.completed_by_profile?.full_name && `${task.completed_by_profile.full_name} · `}
                          {task.time_minutes && `${task.time_minutes}min · `}
                          {task.completed_at && new Date(task.completed_at).toLocaleDateString()}
                        </div>
                      )}
                      {task.task_definition?.requires_photo && !task.completed && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent-text)', background: 'var(--accent-pale)', padding: '2px 6px', borderRadius: 4 }}>
                          PHOTO REQ
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Files */}
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

              {files.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No files uploaded yet</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                  {files.filter(f => f.file_type === 'image').map(f => (
                    <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={f.file_url}
                        alt={f.file_name}
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}
                      />
                    </a>
                  ))}
                </div>
              )}
              {files.filter(f => f.file_type === 'document').length > 0 && (
                <div className="uploaded-files" style={{ marginTop: 10 }}>
                  {files.filter(f => f.file_type === 'document').map(f => (
                    <div key={f.id} className="file-row">
                      <span>📄</span>
                      <a href={f.file_url} target="_blank" rel="noopener noreferrer">{f.file_name}</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="detail-sidebar">
            {/* Board Specs */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Board Specs</div>
              <div className="spec-grid">
                <SpecItem label="Shape" value={spec.shape_name} />
                <SpecItem label="Shaper" value={order.shaper?.name} accent />
                <SpecItem label="Length" value={spec.length_ft ? `${spec.length_ft}′` : null} />
                <SpecItem label="Width" value={spec.width_in ? `${spec.width_in}″` : null} />
                <SpecItem label="Thickness" value={spec.thickness_in ? `${spec.thickness_in}″` : null} />
                <SpecItem label="Volume" value={spec.volume_l ? `${spec.volume_l}L` : null} />
                <SpecItem label="Colour" value={spec.colour} />
                <SpecItem label="Fin Setup" value={spec.fin_setup} />
                <SpecItem label="Fin System" value={spec.fin_system} />
                <SpecItem label="Tail" value={spec.tail_shape} />
              </div>
            </div>

            {/* Customer */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Customer</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {order.customer_email && (
                  <div>
                    <div className="spec-label">Email</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{order.customer_email}</div>
                  </div>
                )}
                {order.customer_phone && (
                  <div>
                    <div className="spec-label">Phone</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{order.customer_phone}</div>
                  </div>
                )}
                {order.shipping_address && (
                  <div>
                    <div className="spec-label">Ship to</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{order.shipping_address}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Tracking */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Customer Tracking</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                {trackingUrl}
              </div>
              <button
                className="btn btn-secondary btn-sm w-full"
                onClick={() => navigator.clipboard.writeText(trackingUrl).then(() => alert('Link copied!'))}
              >
                Copy Link
              </button>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: 8 }}>Notes</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{order.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Complete Task Modal */}
      {taskModal && (
        <CompleteTaskModal
          task={taskModal}
          onConfirm={handleCompleteTask}
          onClose={() => setTaskModal(null)}
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

function CompleteTaskModal({ task, onConfirm, onClose }) {
  const [minutes, setMinutes] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await onConfirm({ minutes, notes })
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Complete: {task.task_definition?.name}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Time taken (minutes)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={minutes}
                onChange={e => setMinutes(e.target.value)}
                placeholder="e.g. 45"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
            </div>
            {task.requiresPhoto && (
              <div className="error-msg" style={{ background: 'var(--accent-pale)', borderColor: 'rgba(245,147,22,0.3)', color: 'var(--accent-text)' }}>
                ⚠ Remember to upload a photo for this task
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Mark Complete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

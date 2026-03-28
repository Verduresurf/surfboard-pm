import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { fetchOrderByTracking } from '../lib/db'

export default function Track() {
  const { token } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchOrderByTracking(token)
        if (!data) setNotFound(true)
        else setOrder(data)
      } catch (e) {
        console.error('[Track] error:', e)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div className="track-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-dim)', letterSpacing: '0.12em' }}>
          LOADING…
        </div>
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="track-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12 }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: '2rem', color: 'var(--text-dim)' }}>404</div>
        <div style={{ color: 'var(--text-muted)' }}>Order not found. Check your tracking link.</div>
      </div>
    )
  }

  const tasks = order.order_tasks ?? []
  const doneTasks = tasks.filter(t => t.is_complete)
  const pct = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0
  const spec = order.board_specs

  // Collect all photos from completed tasks
  const photos = tasks
    .filter(t => t.is_complete && t.order_files?.length)
    .flatMap(t => t.order_files.filter(f => f.file_type === 'image').map(f => ({
      ...f,
      taskName: t.task_definition?.name,
    })))

  const statusLabel = {
    pending:     'Order received',
    in_progress: 'In production',
    completed:   'Production complete',
    shipped:     'Shipped',
    cancelled:   'Cancelled',
  }[order.status] ?? order.status

  const statusColor = {
    pending:     'var(--text-muted)',
    in_progress: '#60a5fa',
    completed:   'var(--success)',
    shipped:     'var(--accent-text)',
    cancelled:   'var(--danger)',
  }[order.status] ?? 'var(--text-muted)'

  return (
    <div className="track-page">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontFamily: 'var(--font-head)',
          fontSize: '1rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--accent-text)',
          marginBottom: 24,
        }}>
          SurfPM
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 6 }}>
          {order.order_number}
        </div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 6 }}>
          Hey {order.customer_name.split(' ')[0]} 👋
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Here's the live status of your board build.
        </div>
      </div>

      {/* Status banner */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: '20px 24px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: statusColor,
          flexShrink: 0,
          boxShadow: order.status === 'in_progress' ? `0 0 8px ${statusColor}` : 'none',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 600, color: statusColor }}>
            {statusLabel}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Last updated {new Date(order.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Board spec */}
      {spec && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '20px 24px',
          marginBottom: 20,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 12 }}>
            Your board
          </div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: '1.3rem', fontWeight: 600, marginBottom: 12 }}>
            {spec.shape_name ?? 'Custom Board'}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 12,
          }}>
            {spec.length_ft && <SpecChip label="Length" value={`${spec.length_ft}′`} />}
            {spec.width_in && <SpecChip label="Width" value={`${spec.width_in}″`} />}
            {spec.thickness_in && <SpecChip label="Thickness" value={`${spec.thickness_in}″`} />}
            {spec.volume_l && <SpecChip label="Volume" value={`${spec.volume_l}L`} />}
            {spec.colour && <SpecChip label="Colour" value={spec.colour} />}
            {spec.fin_setup && <SpecChip label="Fins" value={spec.fin_setup} />}
            {spec.fin_system && <SpecChip label="System" value={spec.fin_system} />}
          </div>
        </div>
      )}

      {/* Progress */}
      {tasks.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '20px 24px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
              Production progress
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-text)', fontWeight: 500 }}>
              {pct}%
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 4, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: pct === 100 ? 'var(--success)' : 'var(--accent)',
              borderRadius: 4,
              transition: 'width 0.5s ease',
            }} />
          </div>

          {/* Task steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tasks.map((task, idx) => {
              const done = task.is_complete
              const isNext = !done && tasks.slice(0, idx).every(t => t.is_complete)
              return (
                <div key={task.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: idx < tasks.length - 1 ? '1px solid var(--border)' : 'none',
                  opacity: done ? 1 : isNext ? 0.9 : 0.45,
                }}>
                  {/* Check icon */}
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: `2px solid ${done ? 'var(--success)' : isNext ? 'var(--accent-dim)' : 'var(--border2)'}`,
                    background: done ? 'var(--success)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {done && (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <polyline points="1.5,5.5 4.5,8.5 9.5,2.5" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {isNext && !done && (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.92rem',
                      color: done ? 'var(--text)' : isNext ? 'var(--text)' : 'var(--text-muted)',
                      fontWeight: done ? 400 : isNext ? 500 : 400,
                    }}>
                      {task.task_definition?.name}
                    </div>
                    {done && task.completed_at && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                        {new Date(task.completed_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                  </div>

                  {isNext && !done && (
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.62rem',
                      color: 'var(--accent-text)',
                      background: 'var(--accent-pale)',
                      padding: '2px 8px',
                      borderRadius: 20,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}>
                      Next up
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '20px 24px',
          marginBottom: 20,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 14 }}>
            Build photos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {photos.map(photo => (
              <div key={photo.id}>
                <a href={photo.file_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={photo.file_url}
                    alt={photo.taskName}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      borderRadius: 'var(--r)',
                      border: '1px solid var(--border)',
                      display: 'block',
                    }}
                  />
                </a>
                {photo.taskName && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 4, textAlign: 'center' }}>
                    {photo.taskName}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
        Powered by SurfPM
      </div>
    </div>
  )
}

function SpecChip({ label, value }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r)',
      padding: '8px 12px',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: 'var(--text)', fontWeight: 500 }}>
        {value}
      </div>
    </div>
  )
}

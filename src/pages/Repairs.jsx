import { useState, useEffect } from 'react'
import { fetchRepairs, saveRepair, fetchLocations } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'

const STATUSES = ['received', 'in_progress', 'completed', 'returned']

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
}

export default function Repairs() {
  const { user } = useAuth()
  const [repairs, setRepairs] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [reps, locs] = await Promise.all([fetchRepairs(), fetchLocations()])
      setRepairs(reps)
      setLocations(locs)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try {
      const parsed = {
        ...data,
        created_by: data.id ? data.created_by : user.id,
        estimated_minutes: data.estimated_minutes ? parseInt(data.estimated_minutes) : null,
        actual_minutes: data.actual_minutes ? parseInt(data.actual_minutes) : null,
      }
      await saveRepair(parsed)
      setModal(null)
      load()
    } catch (e) {
      alert('Save failed: ' + e.message)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Repairs</h1>
        <button className="btn btn-primary" onClick={() => setModal('new')}>+ New Repair</button>
      </div>

      <div className="page-body">
        {error && <div className="error-msg mb-4">{error}</div>}

        {loading ? (
          <div className="loading-spinner">LOADING REPAIRS…</div>
        ) : repairs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔧</div>
            <div className="empty-title">No repairs logged</div>
            <button className="btn btn-primary mt-4" onClick={() => setModal('new')}>+ New Repair</button>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Est. time</th>
                  <th>Actual time</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {repairs.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.customer_name}</div>
                      {r.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{r.description}</div>}
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="muted" style={{ fontSize: '0.85rem' }}>{r.location?.name ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      {r.estimated_minutes ? `${r.estimated_minutes}m` : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      {r.actual_minutes ? `${r.actual_minutes}m` : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(r)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <RepairModal
          repair={modal === 'new' ? null : modal}
          locations={locations}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}

function RepairModal({ repair, locations, onSave, onClose }) {
  const [form, setForm] = useState({
    id: repair?.id,
    customer_name: repair?.customer_name ?? '',
    customer_email: repair?.customer_email ?? '',
    customer_phone: repair?.customer_phone ?? '',
    description: repair?.description ?? '',
    status: repair?.status ?? 'received',
    location_id: repair?.location_id ?? locations[0]?.id ?? '',
    estimated_minutes: repair?.estimated_minutes ?? '',
    actual_minutes: repair?.actual_minutes ?? '',
    notes: repair?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await onSave(form)
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div className="modal-title">{repair ? 'Edit Repair' : 'New Repair'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Customer name *</label>
                <input className="form-input" value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.customer_email}
                  onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.customer_phone}
                  onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="form-row form-row-3">
              <div className="form-group">
                <label className="form-label">Location</label>
                <select className="form-select" value={form.location_id}
                  onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}>
                  <option value="">— none —</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Est. minutes</label>
                <input className="form-input" type="number" value={form.estimated_minutes}
                  onChange={e => setForm(f => ({ ...f, estimated_minutes: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Actual minutes</label>
                <input className="form-input" type="number" value={form.actual_minutes}
                  onChange={e => setForm(f => ({ ...f, actual_minutes: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

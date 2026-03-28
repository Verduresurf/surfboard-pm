import { useState, useEffect } from 'react'
import { fetchRoyalties, saveRoyalty, fetchOverheads, saveOverhead, fetchShapers } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'

export default function Reporting() {
  const { isManager, isAccountant } = useAuth()
  const [tab, setTab] = useState('royalties')

  if (!isManager && !isAccountant) {
    return (
      <div className="page-body">
        <div className="error-msg">Reporting is only available to managers and accountants.</div>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <h1>Reporting</h1>
      </div>
      <div className="page-body">
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {['royalties', 'overheads'].map(t => (
            <button
              key={t}
              className={`filter-pill${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
              style={{ textTransform: 'capitalize' }}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === 'royalties' && <RoyaltiesTab />}
        {tab === 'overheads' && <OverheadsTab />}
      </div>
    </>
  )
}

function RoyaltiesTab() {
  const [royalties, setRoyalties] = useState([])
  const [shapers, setShapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('unpaid')

  async function load() {
    setLoading(true)
    try {
      const [r, s] = await Promise.all([
        fetchRoyalties(filter !== 'all' ? { is_paid: filter === 'paid' } : {}),
        fetchShapers(),
      ])
      setRoyalties(r)
      setShapers(s)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  async function markPaid(id) {
    try {
      await saveRoyalty({ id, is_paid: true, paid_at: new Date().toISOString() })
      load()
    } catch(e) { alert(e.message) }
  }

  const totalOwed = royalties.filter(r => !r.is_paid).reduce((s, r) => s + (r.amount ?? 0), 0)

  // Group by shaper
  const byShaper = royalties.reduce((acc, r) => {
    const name = r.shaper?.name ?? 'Unknown'
    if (!acc[name]) acc[name] = { owed: 0, paid: 0, count: 0 }
    if (r.is_paid) acc[name].paid += r.amount ?? 0
    else acc[name].owed += r.amount ?? 0
    acc[name].count++
    return acc
  }, {})

  if (loading) return <div className="loading-spinner">Loading…</div>

  return (
    <div>
      <div className="stats-row" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total owed</div>
          <div className="stat-value" style={{ color: 'var(--accent-text)', fontSize: '1.6rem' }}>
            ${totalOwed.toFixed(2)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Royalty records</div>
          <div className="stat-value">{royalties.length}</div>
        </div>
      </div>

      {/* Shaper summary */}
      {Object.keys(byShaper).length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 14 }}>Summary by shaper</div>
          <table className="data-table">
            <thead>
              <tr><th>Shaper</th><th>Orders</th><th>Owed</th><th>Paid</th></tr>
            </thead>
            <tbody>
              {Object.entries(byShaper).map(([name, data]) => (
                <tr key={name}>
                  <td style={{ fontWeight: 500 }}>{name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{data.count}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: data.owed > 0 ? 'var(--accent-text)' : 'var(--text-muted)' }}>
                    ${data.owed.toFixed(2)}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
                    ${data.paid.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'unpaid', 'paid'].map(f => (
          <button key={f} className={`filter-pill${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>
            {f}
          </button>
        ))}
      </div>

      {royalties.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <div className="empty-title">No royalty records</div>
          <div className="empty-sub">Royalties are created automatically when orders are placed with shapers</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Shaper</th><th>Amount</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {royalties.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.order?.order_number}</td>
                  <td>{r.order?.customer_name}</td>
                  <td style={{ color: 'var(--accent-text)' }}>{r.shaper?.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>${r.amount?.toFixed(2)}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: r.is_paid ? 'var(--success)' : 'var(--warning)' }}>
                      {r.is_paid ? 'PAID' : 'UNPAID'}
                    </span>
                  </td>
                  <td>
                    {!r.is_paid && (
                      <button className="btn btn-ghost btn-sm" onClick={() => markPaid(r.id)}>Mark paid</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function OverheadsTab() {
  const [overheads, setOverheads] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  async function load() {
    setLoading(true)
    try { setOverheads(await fetchOverheads()) } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try {
      const parsed = { ...data, amount_per_month: parseFloat(data.amount_per_month) || 0 }
      await saveOverhead(parsed)
      setModal(null)
      load()
    } catch(e) { alert(e.message) }
  }

  const totalPerMonth = overheads.reduce((s, o) => s + (o.amount_per_month ?? 0), 0)

  if (loading) return <div className="loading-spinner">Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="stat-card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Total / month</div>
          <div className="stat-value" style={{ fontSize: '1.6rem' }}>${totalPerMonth.toFixed(2)}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Add Overhead</button>
      </div>

      {overheads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏢</div>
          <div className="empty-title">No overheads yet</div>
          <div className="empty-sub">Add rent, power, insurance etc.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Monthly amount</th><th>Source</th><th>From</th><th></th></tr>
            </thead>
            <tbody>
              {overheads.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 500 }}>{o.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{o.currency ?? '$'}{o.amount_per_month?.toFixed(2)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {o.source}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {o.effective_from}
                  </td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setModal(o)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <OverheadModal
          overhead={modal === 'new' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function OverheadModal({ overhead, onSave, onClose }) {
  const [form, setForm] = useState({
    id: overhead?.id,
    name: overhead?.name ?? '',
    amount_per_month: overhead?.amount_per_month ?? '',
    currency: overhead?.currency ?? 'USD',
    source: overhead?.source ?? 'manual',
    effective_from: overhead?.effective_from ?? new Date().toISOString().slice(0, 10),
    notes: overhead?.notes ?? '',
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
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{overhead ? 'Edit Overhead' : 'Add Overhead'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Monthly amount *</label>
                <input className="form-input" type="number" step="0.01" value={form.amount_per_month}
                  onChange={e => setForm(f => ({ ...f, amount_per_month: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <input className="form-input" value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} />
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Source</label>
                <select className="form-select" value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  <option value="manual">Manual</option>
                  <option value="xero_import">Xero import</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Effective from</label>
                <input className="form-input" type="date" value={form.effective_from}
                  onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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

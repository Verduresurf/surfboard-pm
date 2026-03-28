import { useState, useEffect } from 'react'
import { fetchMaterials, saveMaterial, fetchMaterialTypes } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'

export default function Materials() {
  const { isManager } = useAuth()
  const [materials, setMaterials] = useState([])
  const [matTypes, setMatTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [mats, types] = await Promise.all([fetchMaterials(), fetchMaterialTypes()])
      setMaterials(mats)
      setMatTypes(types)
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
        material_type_id: data.material_type_id || null,
        quantity: parseFloat(data.quantity) || 0,
        cost_per_unit: parseFloat(data.cost_per_unit) || null,
      }
      await saveMaterial(parsed)
      setModal(null)
      load()
    } catch (e) {
      alert('Save failed: ' + e.message)
    }
  }

  const totalValue = materials.reduce((sum, m) => {
    return sum + ((m.quantity ?? 0) * (m.cost_per_unit ?? 0))
  }, 0)

  return (
    <>
      <div className="page-header">
        <h1>Materials</h1>
        {isManager && (
          <button className="btn btn-primary" onClick={() => setModal('new')}>+ Add Material</button>
        )}
      </div>

      <div className="page-body">
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total items</div>
            <div className="stat-value">{materials.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Stock value</div>
            <div className="stat-value" style={{ fontSize: '1.4rem' }}>${totalValue.toFixed(2)}</div>
          </div>
        </div>

        {error && <div className="error-msg mb-4">{error}</div>}

        {loading ? (
          <div className="loading-spinner">LOADING MATERIALS…</div>
        ) : materials.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-title">No materials yet</div>
            <div className="empty-sub">Add materials to track your inventory</div>
            {isManager && (
              <button className="btn btn-primary mt-4" onClick={() => setModal('new')}>+ Add Material</button>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Type</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th>Cost / unit</th>
                  <th>Value</th>
                  {isManager && <th></th>}
                </tr>
              </thead>
              <tbody>
                {materials.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      {m.material_type?.is_liquid && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--info)', background: 'var(--info-pale)', padding: '1px 6px', borderRadius: 4 }}>LIQUID</span>
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: '0.85rem' }}>{m.material_type?.name}</td>
                    <td className="muted" style={{ fontSize: '0.85rem' }}>{m.material_type?.unit ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{m.quantity ?? 0}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {m.cost_per_unit ? `${m.currency ?? 'NZD'} ${m.cost_per_unit}` : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {m.cost_per_unit ? `$${((m.quantity ?? 0) * m.cost_per_unit).toFixed(2)}` : '—'}
                    </td>
                    {isManager && (
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal(m)}>Edit</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <MaterialModal
          material={modal === 'new' ? null : modal}
          matTypes={matTypes}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}

function MaterialModal({ material, matTypes, onSave, onClose }) {
  const [form, setForm] = useState({
    id:               material?.id,
    name:             material?.name ?? '',
    material_type_id: material?.material_type_id ?? matTypes[0]?.id ?? '',
    quantity:         material?.quantity ?? 0,
    cost_per_unit:    material?.cost_per_unit ?? '',
    currency:         material?.currency ?? 'NZD',
    supplier:         material?.supplier ?? '',
    is_active:        material?.is_active ?? true,
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
          <div className="modal-title">{material ? 'Edit Material' : 'Add Material'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.material_type_id}
                onChange={e => setForm(f => ({ ...f, material_type_id: e.target.value }))}>
                <option value="">— select —</option>
                {matTypes.map(t => <option key={t.id} value={t.id}>{t.name} {t.unit ? `(${t.unit})` : ''}</option>)}
              </select>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Quantity in stock</label>
                <input className="form-input" type="number" step="0.001" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Cost per unit</label>
                <input className="form-input" type="number" step="0.01" value={form.cost_per_unit}
                  onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Currency</label>
                <input className="form-input" value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Supplier</label>
                <input className="form-input" value={form.supplier}
                  onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
              </div>
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

import { useState, useEffect } from 'react'
import {
  fetchTaskDefinitions, saveTaskDefinition,
  fetchShapers, saveShaper,
  fetchOrderTypes, saveOrderType,
  fetchLocations, saveLocation,
  fetchMaterialTypes,
} from '../lib/db'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Settings() {
  const { isManager } = useAuth()
  const [tab, setTab] = useState('tasks')

  if (!isManager) {
    return (
      <div className="page-body">
        <div className="error-msg">Only managers can access settings.</div>
      </div>
    )
  }

  const tabs = ['tasks', 'shapers', 'order types', 'locations', 'material types']

  return (
    <>
      <div className="page-header">
        <h1>Settings</h1>
      </div>
      <div className="page-body">
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {tabs.map(t => (
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

        {tab === 'tasks'          && <TaskSettings />}
        {tab === 'shapers'        && <ShaperSettings />}
        {tab === 'order types'    && <OrderTypeSettings />}
        {tab === 'locations'      && <LocationSettings />}
        {tab === 'material types' && <MaterialTypeSettings />}
      </div>
    </>
  )
}

// ── Material Types ────────────────────────────────────

function MaterialTypeSettings() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  async function load() {
    setLoading(true)
    try { setItems(await fetchMaterialTypes()) } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try {
      const payload = {
        ...data,
        is_liquid: !!data.is_liquid,
      }
      if (!payload.id) delete payload.id
      const { error } = await supabase.from('material_types').upsert(payload)
      if (error) throw error
      setModal(null)
      load()
    } catch(e) { alert('Save failed: ' + e.message) }
  }

  if (loading) return <div className="loading-spinner">Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-heading" style={{ margin: 0 }}>Material Types</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Add Type</button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧪</div>
          <div className="empty-title">No material types yet</div>
          <div className="empty-sub">Add types like Resin, Fibreglass, Foam blank etc.</div>
          <button className="btn btn-primary mt-4" onClick={() => setModal('new')}>+ Add Type</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Unit</th>
                <th>Category</th>
                <th>Liquid</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 500 }}>{item.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{item.unit ?? '—'}</td>
                  <td className="muted" style={{ fontSize: '0.85rem' }}>{item.category ?? '—'}</td>
                  <td>
                    {item.is_liquid
                      ? <span style={{ color: 'var(--info)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>YES</span>
                      : <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>NO</span>
                    }
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal(item)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <MaterialTypeModal
          item={modal === 'new' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function MaterialTypeModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    id:        item?.id,
    name:      item?.name ?? '',
    unit:      item?.unit ?? '',
    category:  item?.category ?? '',
    is_liquid: item?.is_liquid ?? false,
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
          <div className="modal-title">{item ? 'Edit Material Type' : 'New Material Type'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name} required autoFocus
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Resin, Fibreglass, Foam blank" />
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Unit</label>
                <input className="form-input" value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  placeholder="e.g. litres, metres, sheets" />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input className="form-input" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Chemicals, Cloth" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 8 }}>Is liquid?</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.is_liquid}
                  onChange={e => setForm(f => ({ ...f, is_liquid: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Liquid materials require manual quantity entry per task
                </span>
              </label>
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

// ── Task Definitions ──────────────────────────────────

function TaskSettings() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  async function load() {
    setLoading(true)
    try { setTasks(await fetchTaskDefinitions()) } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try {
      const parsed = {
        ...data,
        default_order: parseInt(data.default_order) || 0,
        estimated_min_per_foot: data.estimated_min_per_foot ? parseFloat(data.estimated_min_per_foot) : null,
      }
      await saveTaskDefinition(parsed)
      setModal(null)
      load()
    } catch(e) { alert(e.message) }
  }

  if (loading) return <div className="loading-spinner">Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-heading" style={{ margin: 0 }}>Production Tasks</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Add Task</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Task name</th>
              <th>Est. min/ft</th>
              <th>Photo req</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id}>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: '0.8rem' }}>{t.default_order}</td>
                <td style={{ fontWeight: 500 }}>{t.name}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{t.estimated_min_per_foot ?? '—'}</td>
                <td>{t.requires_photo ? '✓' : '—'}</td>
                <td>
                  <span style={{ color: t.is_active ? 'var(--success)' : 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {t.is_active ? 'YES' : 'NO'}
                  </span>
                </td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => setModal(t)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <SimpleModal
          title={modal === 'new' ? 'New Task' : 'Edit Task'}
          onClose={() => setModal(null)}
          onSave={handleSave}
          initial={modal === 'new' ? {} : modal}
          fields={[
            { key: 'name', label: 'Task name', required: true },
            { key: 'default_order', label: 'Order (number)', type: 'number' },
            { key: 'estimated_min_per_foot', label: 'Est. min per foot', type: 'number' },
            { key: 'requires_photo', label: 'Requires photo', type: 'checkbox' },
            { key: 'is_active', label: 'Active', type: 'checkbox' },
          ]}
        />
      )}
    </div>
  )
}

// ── Shapers ───────────────────────────────────────────

function ShaperSettings() {
  const [shapers, setShapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  async function load() {
    setLoading(true)
    try { setShapers(await fetchShapers()) } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try {
      const parsed = { ...data, royalty_rate_percent: parseFloat(data.royalty_rate_percent) || 0 }
      await saveShaper(parsed)
      setModal(null)
      load()
    } catch(e) { alert(e.message) }
  }

  if (loading) return <div className="loading-spinner">Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-heading" style={{ margin: 0 }}>Shapers / Brands</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Add Shaper</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Royalty %</th><th>Notes</th><th></th></tr>
          </thead>
          <tbody>
            {shapers.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>{s.name}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: s.royalty_rate_percent > 0 ? 'var(--accent-text)' : 'var(--text-muted)' }}>
                  {s.royalty_rate_percent > 0 ? `${s.royalty_rate_percent}%` : '—'}
                </td>
                <td className="muted" style={{ fontSize: '0.85rem' }}>{s.notes ?? '—'}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => setModal(s)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <SimpleModal
          title={modal === 'new' ? 'New Shaper' : 'Edit Shaper'}
          onClose={() => setModal(null)}
          onSave={handleSave}
          initial={modal === 'new' ? {} : modal}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'royalty_rate_percent', label: 'Royalty rate (%)', type: 'number' },
            { key: 'notes', label: 'Notes' },
            { key: 'is_active', label: 'Active', type: 'checkbox' },
          ]}
        />
      )}
    </div>
  )
}

// ── Order Types ───────────────────────────────────────

function OrderTypeSettings() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  async function load() {
    setLoading(true)
    try { setItems(await fetchOrderTypes()) } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try { await saveOrderType(data); setModal(null); load() } catch(e) { alert(e.message) }
  }

  if (loading) return <div className="loading-spinner">Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-heading" style={{ margin: 0 }}>Order Types</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Add Type</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span style={{ fontWeight: 500 }}>{item.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setModal(item)}>Edit</button>
          </div>
        ))}
      </div>
      {modal && (
        <SimpleModal
          title={modal === 'new' ? 'New Order Type' : 'Edit Order Type'}
          onClose={() => setModal(null)}
          onSave={handleSave}
          initial={modal === 'new' ? {} : modal}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'is_active', label: 'Active', type: 'checkbox' },
          ]}
        />
      )}
    </div>
  )
}

// ── Locations ─────────────────────────────────────────

function LocationSettings() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  async function load() {
    setLoading(true)
    try { setItems(await fetchLocations()) } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try { await saveLocation(data); setModal(null); load() } catch(e) { alert(e.message) }
  }

  if (loading) return <div className="loading-spinner">Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-heading" style={{ margin: 0 }}>Locations</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Add Location</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <div>
              <div style={{ fontWeight: 500 }}>{item.name}</div>
              {item.address && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{item.address}</div>}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setModal(item)}>Edit</button>
          </div>
        ))}
      </div>
      {modal && (
        <SimpleModal
          title={modal === 'new' ? 'New Location' : 'Edit Location'}
          onClose={() => setModal(null)}
          onSave={handleSave}
          initial={modal === 'new' ? {} : modal}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'address', label: 'Address' },
          ]}
        />
      )}
    </div>
  )
}

// ── Generic Simple Modal ──────────────────────────────

function SimpleModal({ title, initial, fields, onSave, onClose }) {
  const [form, setForm] = useState({ is_active: true, ...initial })
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
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {fields.map((field, i) => (
              <div key={field.key} className="form-group">
                <label className="form-label">{field.label}</label>
                {field.type === 'checkbox' ? (
                  <input type="checkbox" checked={!!form[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                ) : (
                  <input className="form-input" type={field.type ?? 'text'}
                    required={field.required} value={form[field.key] ?? ''}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    autoFocus={i === 0} step={field.type === 'number' ? '0.01' : undefined} />
                )}
              </div>
            ))}
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

import { useState, useEffect } from 'react'
import {
  fetchTaskDefinitions, saveTaskDefinition,
  fetchShapers, saveShaper,
  fetchOrderTypes, saveOrderType,
  fetchLocations, saveLocation,
  fetchMaterialTypes, saveMaterialType,
  fetchStaff, saveStaff,
  getSettings, setSettings,
} from '../lib/db'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const TABS = ['tasks','material types','shapers','order types','locations','staff','pay','display']

export default function Settings() {
  const { isManager } = useAuth()
  const [tab, setTab] = useState('tasks')

  if (!isManager) {
    return <div className="page-body"><div className="error-msg">Only managers can access settings.</div></div>
  }

  return (
    <>
      <div className="page-header"><h1>Settings</h1></div>
      <div className="page-body">
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t} className={`filter-pill${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>
        {tab === 'tasks'          && <TaskSettings />}
        {tab === 'material types' && <MaterialTypeSettings />}
        {tab === 'shapers'        && <ShaperSettings />}
        {tab === 'order types'    && <OrderTypeSettings />}
        {tab === 'locations'      && <LocationSettings />}
        {tab === 'staff'          && <StaffSettings />}
        {tab === 'pay'            && <PaySettings />}
        {tab === 'display'        && <DisplaySettings />}
      </div>
    </>
  )
}

// ── Task Definitions ───────────────────────────────────────────

function TaskSettings() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  async function load() { setLoading(true); try { setTasks(await fetchTaskDefinitions()) } catch(e) {} setLoading(false) }
  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try {
      await saveTaskDefinition({ ...data, default_order: parseInt(data.default_order) || 0, estimated_min_per_foot: data.estimated_min_per_foot ? parseFloat(data.estimated_min_per_foot) : null })
      setModal(null); load()
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
          <thead><tr><th>#</th><th>Task name</th><th>Est. min/ft</th><th>Photo req</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id}>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: '0.8rem' }}>{t.default_order}</td>
                <td style={{ fontWeight: 500 }}>{t.name}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{t.estimated_min_per_foot ?? '—'}</td>
                <td>{t.requires_photo ? '✓' : '—'}</td>
                <td><span style={{ color: t.is_active ? 'var(--success)' : 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{t.is_active ? 'YES' : 'NO'}</span></td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => setModal(t)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <SimpleModal title={modal === 'new' ? 'New Task' : 'Edit Task'} onClose={() => setModal(null)} onSave={handleSave} initial={modal === 'new' ? {} : modal} fields={[{key:'name',label:'Task name',required:true},{key:'default_order',label:'Order #',type:'number'},{key:'estimated_min_per_foot',label:'Est. min/ft',type:'number'},{key:'requires_photo',label:'Requires photo',type:'checkbox'},{key:'is_active',label:'Active',type:'checkbox'}]} />}
    </div>
  )
}

// ── Material Types ─────────────────────────────────────────────

function MaterialTypeSettings() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  async function load() { setLoading(true); try { setItems(await fetchMaterialTypes()) } catch(e) {} setLoading(false) }
  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try {
      const payload = { ...data, is_liquid: !!data.is_liquid }
      if (!payload.id) delete payload.id
      await saveMaterialType(payload)
      setModal(null); load()
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
        <div className="empty-state"><div className="empty-icon">🧪</div><div className="empty-title">No material types yet</div><div className="empty-sub">Add types like Resin, Fibreglass, Foam blank etc.</div><button className="btn btn-primary mt-4" onClick={() => setModal('new')}>+ Add Type</button></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Unit</th><th>Category</th><th>Liquid</th><th></th></tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 500 }}>{item.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{item.unit ?? '—'}</td>
                  <td className="muted" style={{ fontSize: '0.85rem' }}>{item.category ?? '—'}</td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: item.is_liquid ? 'var(--info)' : 'var(--text-dim)' }}>{item.is_liquid ? 'YES' : 'NO'}</span></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setModal(item)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <MaterialTypeModal item={modal === 'new' ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  )
}

function MaterialTypeModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({ id: item?.id, name: item?.name ?? '', unit: item?.unit ?? '', category: item?.category ?? '', is_liquid: item?.is_liquid ?? false })
  const [loading, setLoading] = useState(false)
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">{item ? 'Edit Material Type' : 'New Material Type'}</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={async e => { e.preventDefault(); setLoading(true); await onSave(form); setLoading(false) }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} required autoFocus onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Resin, Fibreglass" /></div>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Unit</label><input className="form-input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="litres, metres, sheets" /></div>
              <div className="form-group"><label className="form-label">Category</label><input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Roll, Sheet, Liquid…" /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.is_liquid} onChange={e => setForm(f => ({ ...f, is_liquid: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
              <div><div style={{ fontWeight: 500 }}>Liquid material</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Staff enter actual quantity used per task</div></div>
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Shapers ────────────────────────────────────────────────────

function ShaperSettings() {
  const [shapers, setShapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  async function load() { setLoading(true); try { setShapers(await fetchShapers()) } catch(e) {} setLoading(false) }
  useEffect(() => { load() }, [])
  async function handleSave(data) {
    try { await saveShaper({ ...data, royalty_rate_percent: parseFloat(data.royalty_rate_percent) || 0 }); setModal(null); load() } catch(e) { alert(e.message) }
  }
  if (loading) return <div className="loading-spinner">Loading…</div>
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="section-heading" style={{ margin: 0 }}>Shapers / Brands</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Add</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Name</th><th>Royalty %</th><th>Notes</th><th></th></tr></thead>
          <tbody>{shapers.map(s => <tr key={s.id}><td style={{ fontWeight: 500 }}>{s.name}</td><td style={{ fontFamily: 'var(--font-mono)', color: s.royalty_rate_percent > 0 ? 'var(--accent-text)' : 'var(--text-muted)' }}>{s.royalty_rate_percent > 0 ? `${s.royalty_rate_percent}%` : '—'}</td><td className="muted" style={{ fontSize: '0.85rem' }}>{s.notes ?? '—'}</td><td><button className="btn btn-ghost btn-sm" onClick={() => setModal(s)}>Edit</button></td></tr>)}</tbody>
        </table>
      </div>
      {modal && <SimpleModal title={modal === 'new' ? 'New Shaper' : 'Edit Shaper'} onClose={() => setModal(null)} onSave={handleSave} initial={modal === 'new' ? {} : modal} fields={[{key:'name',label:'Name',required:true},{key:'royalty_rate_percent',label:'Royalty rate (%)',type:'number'},{key:'notes',label:'Notes'},{key:'is_active',label:'Active',type:'checkbox'}]} />}
    </div>
  )
}

// ── Order Types ────────────────────────────────────────────────

function OrderTypeSettings() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  async function load() { setLoading(true); try { setItems(await fetchOrderTypes()) } catch(e) {} setLoading(false) }
  useEffect(() => { load() }, [])
  async function handleSave(data) { try { await saveOrderType(data); setModal(null); load() } catch(e) { alert(e.message) } }
  if (loading) return <div className="loading-spinner">Loading…</div>
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="section-heading" style={{ margin: 0 }}>Order Types</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Add</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}><span style={{ fontWeight: 500 }}>{item.name}</span><button className="btn btn-ghost btn-sm" onClick={() => setModal(item)}>Edit</button></div>)}
      </div>
      {modal && <SimpleModal title={modal === 'new' ? 'New Order Type' : 'Edit Order Type'} onClose={() => setModal(null)} onSave={handleSave} initial={modal === 'new' ? {} : modal} fields={[{key:'name',label:'Name',required:true},{key:'is_active',label:'Active',type:'checkbox'}]} />}
    </div>
  )
}

// ── Locations ──────────────────────────────────────────────────

function LocationSettings() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  async function load() { setLoading(true); try { setItems(await fetchLocations()) } catch(e) {} setLoading(false) }
  useEffect(() => { load() }, [])
  async function handleSave(data) { try { await saveLocation(data); setModal(null); load() } catch(e) { alert(e.message) } }
  if (loading) return <div className="loading-spinner">Loading…</div>
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="section-heading" style={{ margin: 0 }}>Locations</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Add</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}><div><div style={{ fontWeight: 500 }}>{item.name}</div>{item.address && <div className="muted" style={{ fontSize: '0.82rem' }}>{item.address}</div>}</div><button className="btn btn-ghost btn-sm" onClick={() => setModal(item)}>Edit</button></div>)}
      </div>
      {modal && <SimpleModal title={modal === 'new' ? 'New Location' : 'Edit Location'} onClose={() => setModal(null)} onSave={handleSave} initial={modal === 'new' ? {} : modal} fields={[{key:'name',label:'Name',required:true},{key:'address',label:'Address'}]} />}
    </div>
  )
}

// ── Staff ──────────────────────────────────────────────────────

const STAFF_COLORS = ['blue','teal','amber','coral','purple','green','pink']

function StaffSettings() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  async function load() { setLoading(true); try { setStaff(await fetchStaff()) } catch(e) {} setLoading(false) }
  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try { await saveStaff(data); setModal(null); load() } catch(e) { alert(e.message) }
  }

  async function handleDeactivate(id) {
    if (!confirm('Remove this staff member?')) return
    try {
      const { error } = await supabase.from('staff').update({ is_active: false }).eq('id', id)
      if (error) throw error
      load()
    } catch(e) { alert(e.message) }
  }

  if (loading) return <div className="loading-spinner">Loading…</div>

  return (
    <div>
      <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        Staff tap their name when completing tasks so work is attributed correctly. No login required.
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="section-heading" style={{ margin: 0 }}>Staff Members</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Add Staff</button>
      </div>
      {staff.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">👷</div><div className="empty-title">No staff added yet</div><div className="empty-sub">Add staff members so they can be attributed to completed tasks</div><button className="btn btn-primary mt-4" onClick={() => setModal('new')}>+ Add Staff</button></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {staff.map(s => (
            <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: `var(--accent-pale)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-head)', fontWeight: 700, color: 'var(--accent-text)', fontSize: '1.1rem', flexShrink: 0 }}>
                {s.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{s.name}</div>
                {s.role && <div className="muted" style={{ fontSize: '0.82rem' }}>{s.role}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal(s)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(s.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && <StaffModal staff={modal === 'new' ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  )
}

function StaffModal({ staff, onSave, onClose }) {
  const [form, setForm] = useState({ id: staff?.id, name: staff?.name ?? '', role: staff?.role ?? '', color: staff?.color ?? 'blue', is_active: true })
  const [loading, setLoading] = useState(false)
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">{staff ? 'Edit Staff' : 'Add Staff Member'}</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={async e => { e.preventDefault(); setLoading(true); await onSave(form); setLoading(false) }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} required autoFocus onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Jack" /></div>
            <div className="form-group"><label className="form-label">Role</label><input className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Shaper, Glasser" /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Pay Settings ───────────────────────────────────────────────

function PaySettings() {
  const [values, setValues] = useState({ track_task_time: true, track_material_usage: true, piece_work_enabled: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const s = await getSettings(['track_task_time','track_material_usage','piece_work_enabled'])
        setValues({
          track_task_time:      s.track_task_time === 'true' || s.track_task_time === true,
          track_material_usage: s.track_material_usage === 'true' || s.track_material_usage === true,
          piece_work_enabled:   s.piece_work_enabled === 'true' || s.piece_work_enabled === true,
        })
      } catch(e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await setSettings({
        track_task_time:      String(values.track_task_time),
        track_material_usage: String(values.track_material_usage),
        piece_work_enabled:   String(values.piece_work_enabled),
      })
      alert('Settings saved')
    } catch(e) { alert(e.message) }
    setSaving(false)
  }

  if (loading) return <div className="loading-spinner">Loading…</div>

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Production Tracking</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Toggle label="Track task time" description='After completing a task, staff are asked how long it took. Used to calculate per-foot time rates.' value={values.track_task_time} onChange={v => setValues(p => ({ ...p, track_task_time: v }))} />
          <Toggle label="Track material usage" description='Staff are prompted to enter qty used for liquid materials on task completion.' value={values.track_material_usage} onChange={v => setValues(p => ({ ...p, track_material_usage: v }))} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Piece Work Pay</div>
        <Toggle label="Enable piece work" description='Staff get paid per task completed. See payroll in Reports → Staff.' value={values.piece_work_enabled} onChange={v => setValues(p => ({ ...p, piece_work_enabled: v }))} />
      </div>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
    </div>
  )
}

function Toggle({ label, description, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 500, marginBottom: 3 }}>{label}</div>
        {description && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{description}</div>}
      </div>
      <button type="button" onClick={() => onChange(!value)}
        style={{ flexShrink: 0, width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'background 0.2s', background: value ? 'var(--accent)' : 'var(--surface3)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 3, left: value ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
      </button>
    </div>
  )
}

// ── Display Settings ───────────────────────────────────────────

function DisplaySettings() {
  const [values, setValues] = useState({ card_columns: '1', theme: 'dark' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const s = await getSettings(['card_columns','theme'])
        setValues({ card_columns: String(s.card_columns ?? 1), theme: String(s.theme ?? 'dark').replace(/"/g,'') })
      } catch(e) {}
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    try { await setSettings({ card_columns: values.card_columns, theme: `"${values.theme}"` }); alert('Saved — refresh to apply') }
    catch(e) { alert(e.message) }
    setSaving(false)
  }

  if (loading) return <div className="loading-spinner">Loading…</div>

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Orders Grid</div>
        <div className="form-group">
          <label className="form-label">Columns on orders tab</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['1','2','3'].map(c => (
              <button key={c} type="button" onClick={() => setValues(v => ({ ...v, card_columns: c }))}
                style={{ flex: 1, padding: '10px', borderRadius: 'var(--r)', border: '1px solid', cursor: 'pointer', fontFamily: 'var(--font-head)', fontSize: '1rem', borderColor: values.card_columns === c ? 'var(--accent)' : 'var(--border)', background: values.card_columns === c ? 'var(--accent-pale)' : 'var(--surface2)', color: values.card_columns === c ? 'var(--accent-text)' : 'var(--text-muted)' }}>
                {c} {c === '1' ? 'column' : 'columns'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
    </div>
  )
}

// ── Generic Simple Modal ───────────────────────────────────────

function SimpleModal({ title, initial, fields, onSave, onClose }) {
  const [form, setForm] = useState({ is_active: true, ...initial })
  const [loading, setLoading] = useState(false)
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">{title}</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={async e => { e.preventDefault(); setLoading(true); await onSave(form); setLoading(false) }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {fields.map((field, i) => (
              <div key={field.key} className="form-group">
                <label className="form-label">{field.label}</label>
                {field.type === 'checkbox'
                  ? <input type="checkbox" checked={!!form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  : <input className="form-input" type={field.type ?? 'text'} required={field.required} value={form[field.key] ?? ''} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} autoFocus={i === 0} step={field.type === 'number' ? '0.01' : undefined} />
                }
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

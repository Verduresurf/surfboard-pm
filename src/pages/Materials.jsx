import { useState, useEffect } from 'react'
import {
  fetchMaterials, saveMaterial, fetchMaterialTypes,
  fetchMaterialRulesFull, saveMaterialRule, deleteMaterialRule,
  fetchTaskDefinitions, fetchMaterialUsageStats,
} from '../lib/db'
import { useAuth } from '../contexts/AuthContext'

export default function Materials() {
  const { isManager } = useAuth()
  const [tab, setTab] = useState('stock')

  return (
    <>
      <div className="page-header">
        <h1>Inventory</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['stock','rules','usage'].map(t => (
            <button key={t} className={`filter-pill${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="page-body">
        {tab === 'stock' && <StockTab isManager={isManager} />}
        {tab === 'rules' && <RulesTab isManager={isManager} />}
        {tab === 'usage' && <UsageTab />}
      </div>
    </>
  )
}

// ── Stock Tab ──────────────────────────────────────────────────

function StockTab({ isManager }) {
  const [materials, setMaterials] = useState([])
  const [matTypes, setMatTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [mats, types] = await Promise.all([fetchMaterials(), fetchMaterialTypes()])
      setMaterials(mats); setMatTypes(types)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try {
      await saveMaterial({ ...data, material_type_id: data.material_type_id || null, quantity: parseFloat(data.quantity) || 0, cost_per_unit: parseFloat(data.cost_per_unit) || null })
      setModal(null); load()
    } catch(e) { alert('Save failed: ' + e.message) }
  }

  // Group by category
  const grouped = {}
  for (const m of materials) {
    const cat = m.material_type?.category || m.material_type?.name || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(m)
  }

  const totalValue = materials.reduce((s, m) => s + ((m.quantity ?? 0) * (m.cost_per_unit ?? 0)), 0)

  if (loading) return <div className="loading-spinner">LOADING…</div>

  return (
    <div>
      <div className="stats-row" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-label">Materials</div><div className="stat-value">{materials.length}</div></div>
        <div className="stat-card"><div className="stat-label">Stock value</div><div className="stat-value" style={{ fontSize: '1.4rem' }}>${totalValue.toFixed(2)}</div></div>
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
            📦 {cat}
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Material</th><th>Unit</th><th>Cost/unit</th><th>Stock</th>{isManager && <th></th>}</tr></thead>
              <tbody>
                {items.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      {m.material_type?.is_liquid && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--info)', background: 'var(--info-pale)', padding: '1px 6px', borderRadius: 4 }}>LIQUID</span>}
                    </td>
                    <td className="muted" style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{m.material_type?.unit ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{m.cost_per_unit ? `${m.currency ?? 'NZD'} ${parseFloat(m.cost_per_unit).toFixed(2)}` : '—'}</td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: (m.quantity ?? 0) < 5 ? 'var(--danger)' : 'var(--text)' }}>{parseFloat(m.quantity ?? 0).toFixed(3)}</span></td>
                    {isManager && <td><button className="btn btn-ghost btn-sm" onClick={() => setModal(m)}>Edit</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {materials.length === 0 && <div className="empty-state"><div className="empty-icon">📦</div><div className="empty-title">No materials yet</div></div>}

      {isManager && <button className="btn btn-primary w-full" style={{ marginTop: 16 }} onClick={() => setModal('new')}>+ Add Material</button>}

      {modal && <MaterialModal material={modal === 'new' ? null : modal} matTypes={matTypes} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  )
}

function MaterialModal({ material, matTypes, onSave, onClose }) {
  const [form, setForm] = useState({
    id: material?.id, name: material?.name ?? '', material_type_id: material?.material_type_id ?? '',
    quantity: material?.quantity ?? 0, cost_per_unit: material?.cost_per_unit ?? '',
    currency: material?.currency ?? 'NZD', supplier: material?.supplier ?? '',
  })
  const [loading, setLoading] = useState(false)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">{material ? 'Edit Material' : 'Add Material'}</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={async e => { e.preventDefault(); setLoading(true); await onSave(form); setLoading(false) }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} required autoFocus onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.material_type_id} onChange={e => setForm(f => ({ ...f, material_type_id: e.target.value }))}>
                <option value="">— select —</option>
                {matTypes.map(t => <option key={t.id} value={t.id}>{t.name} {t.unit ? `(${t.unit})` : ''}</option>)}
              </select>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Quantity</label><input className="form-input" type="number" step="0.001" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Cost/unit</label><input className="form-input" type="number" step="0.01" value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))} placeholder="0.00" /></div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Currency</label><input className="form-input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Supplier</label><input className="form-input" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
            </div>
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

// ── Rules Tab ──────────────────────────────────────────────────

function RulesTab({ isManager }) {
  const [rules, setRules] = useState([])
  const [materials, setMaterials] = useState([])
  const [taskDefs, setTaskDefs] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [r, m, t] = await Promise.all([fetchMaterialRulesFull(), fetchMaterials(), fetchTaskDefinitions()])
      setRules(r); setMaterials(m); setTaskDefs(t)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="loading-spinner">LOADING…</div>

  return (
    <div>
      <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        Rules auto-deduct stock when a task is checked off. Set qty/ft for solids; liquids prompt staff for actual amount used.
      </div>
      {rules.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">No rules yet</div><div className="empty-sub">Add rules to auto-deduct stock when tasks are completed</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {rules.map(r => (
            <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: 3 }}>{r.rule_name || `${r.task_definition?.name} → ${r.material?.name}`}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--accent-text)' }}>{r.task_definition?.name}</span> → <span>{r.material?.name}</span> ·{' '}
                  {r.deduct_type === 'fixed' && `Fixed ${r.fixed_amount} ${r.material?.material_type?.unit}`}
                  {r.deduct_type === 'formula' && `Formula: ${r.formula}`}
                  {r.deduct_type === 'ratio' && `${r.quantity_per_foot} ${r.material?.material_type?.unit ?? ''}/ft`}
                  {r.material?.material_type?.is_liquid && <span style={{ color: 'var(--info)', marginLeft: 8 }}>LIQUID</span>}
                </div>
              </div>
              {isManager && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(r)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={async () => { if (confirm('Delete rule?')) { await deleteMaterialRule(r.id); load() } }}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {isManager && <button className="btn btn-primary" onClick={() => setModal('new')}>+ Add Rule</button>}
      {modal && <RuleModal rule={modal === 'new' ? null : modal} materials={materials} taskDefs={taskDefs} onSave={async data => { try { await saveMaterialRule(data); setModal(null); load() } catch(e) { alert(e.message) } }} onClose={() => setModal(null)} />}
    </div>
  )
}

function RuleModal({ rule, materials, taskDefs, onSave, onClose }) {
  const [form, setForm] = useState({
    id: rule?.id, rule_name: rule?.rule_name ?? '',
    task_definition_id: rule?.task_definition_id ?? taskDefs[0]?.id ?? '',
    material_id: rule?.material_id ?? materials[0]?.id ?? '',
    deduct_type: rule?.deduct_type ?? 'ratio',
    quantity_per_foot: rule?.quantity_per_foot ?? '',
    fixed_amount: rule?.fixed_amount ?? '',
    formula: rule?.formula ?? '',
  })
  const [loading, setLoading] = useState(false)
  const selMat = materials.find(m => m.id === form.material_id)
  const unit = selMat?.material_type?.unit ?? ''

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header"><div className="modal-title">{rule ? 'Edit Rule' : 'New Rule'}</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={async e => {
          e.preventDefault(); setLoading(true)
          await onSave({ ...form, task_definition_id: form.task_definition_id || null, material_id: form.material_id || null, quantity_per_foot: form.quantity_per_foot ? parseFloat(form.quantity_per_foot) : null, fixed_amount: form.fixed_amount ? parseFloat(form.fixed_amount) : null })
          setLoading(false)
        }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group"><label className="form-label">Rule name</label><input className="form-input" value={form.rule_name} placeholder="e.g. Resin Btm Lam" autoFocus onChange={e => setForm(f => ({ ...f, rule_name: e.target.value }))} /></div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Trigger task *</label>
                <select className="form-select" value={form.task_definition_id} required onChange={e => setForm(f => ({ ...f, task_definition_id: e.target.value }))}>
                  <option value="">— select —</option>
                  {taskDefs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Material *</label>
                <select className="form-select" value={form.material_id} required onChange={e => setForm(f => ({ ...f, material_id: e.target.value }))}>
                  <option value="">— select —</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.material_type?.unit})</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Deduct quantity</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {['ratio','fixed','formula'].map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, deduct_type: t }))}
                    style={{ flex: 1, padding: '8px', borderRadius: 'var(--r)', border: '1px solid', cursor: 'pointer', fontFamily: 'var(--font-head)', fontSize: '0.88rem', textTransform: 'capitalize', borderColor: form.deduct_type === t ? 'var(--accent)' : 'var(--border)', background: form.deduct_type === t ? 'var(--accent-pale)' : 'var(--surface2)', color: form.deduct_type === t ? 'var(--accent-text)' : 'var(--text-muted)' }}>
                    {t === 'ratio' ? 'Use Ratio' : t === 'fixed' ? 'Fixed Amount' : 'Formula'}
                  </button>
                ))}
              </div>
              {form.deduct_type === 'ratio' && (
                <div>
                  <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Auto-calculates rate × board length. Uses actual average once 3+ boards are logged, otherwise uses estimated qty/ft.
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="form-input" type="number" step="0.0001" value={form.quantity_per_foot} onChange={e => setForm(f => ({ ...f, quantity_per_foot: e.target.value }))} placeholder="0.05" style={{ flex: 1 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{unit}/ft</span>
                  </div>
                </div>
              )}
              {form.deduct_type === 'fixed' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="form-input" type="number" step="0.001" value={form.fixed_amount} onChange={e => setForm(f => ({ ...f, fixed_amount: e.target.value }))} placeholder="Amount to deduct" style={{ flex: 1 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{unit}</span>
                </div>
              )}
              {form.deduct_type === 'formula' && (
                <div>
                  <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 10, fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                    <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Variables:</strong>
                    lengthFt · lengthM · widthIn · thicknessIn · volume · finCount<br/>
                    <strong style={{ color: 'var(--text)', display: 'block', margin: '6px 0 4px' }}>Examples:</strong>
                    lengthM — metres for one lam pass<br/>
                    lengthM * 2 — top + bottom lam<br/>
                    lengthFt * 0.05 — 0.05 L/ft ratio
                  </div>
                  <input className="form-input" value={form.formula} onChange={e => setForm(f => ({ ...f, formula: e.target.value }))} placeholder="e.g. lengthM * 2" style={{ fontFamily: 'var(--font-mono)' }} />
                </div>
              )}
            </div>
            {selMat?.material_type?.is_liquid && (
              <div style={{ background: 'var(--info-pale)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '0.82rem', color: '#60a5fa' }}>
                ℹ Liquid material — staff will be prompted to enter actual amount used when completing the task.
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Rule'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Usage Tab ──────────────────────────────────────────────────

function UsageTab() {
  const [materials, setMaterials] = useState([])
  const [stats, setStats] = useState({})
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [mats, s, r] = await Promise.all([fetchMaterials(), fetchMaterialUsageStats(), fetchMaterialRulesFull()])
        setMaterials(mats); setStats(s); setRules(r)
      } catch(e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="loading-spinner">LOADING…</div>

  const trackedIds = new Set(rules.map(r => r.material_id))
  const tracked = materials.filter(m => trackedIds.has(m.id))

  if (!tracked.length) return (
    <div className="empty-state">
      <div className="empty-icon">📊</div>
      <div className="empty-title">No usage data yet</div>
      <div className="empty-sub">Set up material rules and complete some tasks to see actual usage stats here.</div>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Estimated qty/ft comes from your rules. Actual avg/ft fills in from real usage logs — more accurate over time.
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Material</th><th>Est. qty/ft</th><th>Actual avg/ft</th><th>Boards logged</th></tr></thead>
          <tbody>
            {tracked.map(m => {
              const s = stats[m.id]
              const estRule = rules.find(r => r.material_id === m.id && r.deduct_type === 'ratio')
              return (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{m.name}</div>
                    <div className="muted" style={{ fontSize: '0.75rem' }}>{m.material_type?.name} · {m.material_type?.unit}</div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {estRule?.quantity_per_foot != null ? `${estRule.quantity_per_foot} ${m.material_type?.unit}/ft` : <span className="muted">—</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {s?.actualAvgPerFt != null
                      ? <span style={{ color: 'var(--success)' }}>{s.actualAvgPerFt.toFixed(4)} {m.material_type?.unit}/ft</span>
                      : <span className="muted" style={{ fontSize: '0.8rem' }}>No data yet</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {s?.sampleCount ?? 0}
                    {s?.sampleCount >= 3 && <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'var(--success)', background: 'var(--success-pale)', padding: '1px 6px', borderRadius: 4 }}>USING ACTUAL</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { fetchReportOrders, fetchMaterialUsageForReports, fetchRoyalties, saveRoyalty, fetchStaff } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'

const TABS = ['production','revenue','costs','staff','royalties']

export default function Reporting() {
  const { isManager, isAccountant } = useAuth()
  const [tab, setTab] = useState('production')
  const [orders, setOrders] = useState([])
  const [usage, setUsage] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [o, u, s] = await Promise.all([fetchReportOrders(), fetchMaterialUsageForReports(), fetchStaff()])
        setOrders(o); setUsage(u); setStaff(s)
      } catch(e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  if (!isManager && !isAccountant) {
    return <div className="page-body"><div className="error-msg">Reporting is only available to managers and accountants.</div></div>
  }

  if (loading) return <><div className="page-header"><h1>Reports</h1></div><div className="page-body"><div className="loading-spinner">LOADING…</div></div></>

  const completed = orders.filter(o => o.status === 'completed' || o.status === 'shipped')
  const inProgress = orders.filter(o => o.status === 'in_progress')

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>{orders.length} orders in database</div>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
          {TABS.map(t => (
            <button key={t} className={`filter-pill${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)} style={{ textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{t}</button>
          ))}
        </div>

        {tab === 'production' && <ProductionTab orders={orders} completed={completed} />}
        {tab === 'revenue'    && <RevenueTab orders={orders} completed={completed} inProgress={inProgress} />}
        {tab === 'costs'      && <CostsTab orders={orders} usage={usage} />}
        {tab === 'staff'      && <StaffTab orders={orders} staff={staff} />}
        {tab === 'royalties'  && <RoyaltiesTab orders={orders} />}
      </div>
    </>
  )
}

// ── Production ─────────────────────────────────────────────────

function ProductionTab({ orders, completed }) {
  const totalFt   = completed.reduce((s, o) => s + (parseFloat(o.length_ft) || 0), 0)
  const avgFt     = completed.length ? totalFt / completed.length : 0

  // Boards per week (last 8 weeks)
  const weeks = {}
  for (const o of completed) {
    const d = new Date(o.updated_at || o.created_at)
    const wk = `${d.getFullYear()}-W${String(Math.ceil((d.getDate()) / 7)).padStart(2,'0')}`
    weeks[wk] = (weeks[wk] || 0) + 1
  }
  const weekData = Object.entries(weeks).sort().slice(-8)
  const maxBoards = Math.max(...weekData.map(w => w[1]), 1)

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Boards completed</div><div className="stat-value">{completed.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total board feet</div><div className="stat-value">{totalFt.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>ft</span></div></div>
        <div className="stat-card"><div className="stat-label">Avg board length</div><div className="stat-value">{avgFt.toFixed(2)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>ft</span></div></div>
        <div className="stat-card"><div className="stat-label">In progress</div><div className="stat-value" style={{ color: 'var(--info)' }}>{orders.filter(o => o.status === 'in_progress').length}</div></div>
      </div>

      {weekData.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Boards per week</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
            {weekData.map(([wk, count]) => (
              <div key={wk} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)' }}>{count}</div>
                <div style={{ width: '100%', background: 'var(--accent)', borderRadius: '3px 3px 0 0', height: `${(count / maxBoards) * 80}px`, minHeight: 4 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length === 0 && <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">No completed orders yet</div></div>}
    </div>
  )
}

// ── Revenue ────────────────────────────────────────────────────

function RevenueTab({ orders, completed, inProgress }) {
  const collected = completed.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const wip       = inProgress.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Total collected</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--success)' }}>${collected.toFixed(2)}</div>
          <div className="stat-sub">from {completed.length} completed boards</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Work in progress</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--accent-text)' }}>${wip.toFixed(2)}</div>
          <div className="stat-sub">balance owing on active orders</div>
        </div>
      </div>

      {orders.filter(o => o.sale_price).length === 0 ? (
        <div className="empty-state"><div className="empty-icon">💰</div><div className="empty-title">No pricing data yet</div><div className="empty-sub">Add sale prices to orders to see revenue here</div></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Board</th><th>Status</th><th style={{ textAlign: 'right' }}>Price</th></tr></thead>
            <tbody>
              {orders.filter(o => o.sale_price).map(o => (
                <tr key={o.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-dim)' }}>{o.order_number}</td>
                  <td style={{ fontWeight: 500 }}>{o.customer_name}</td>
                  <td className="muted" style={{ fontSize: '0.85rem' }}>{o.shaper} {o.shape_name}</td>
                  <td><span className={`badge badge-${o.status}`}>{o.status.replace('_',' ')}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>${parseFloat(o.sale_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Costs ──────────────────────────────────────────────────────

function CostsTab({ orders, usage }) {
  const totalRevenue = orders.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)

  // Calculate material cost per order
  const matCostByOrder = {}
  for (const row of usage) {
    if (!matCostByOrder[row.order_id]) matCostByOrder[row.order_id] = 0
    const qty  = parseFloat(row.actual_quantity ?? row.estimated_quantity ?? 0)
    const cost = parseFloat(row.material?.cost_per_unit ?? 0)
    matCostByOrder[row.order_id] += qty * cost
  }

  const totalMatCost = Object.values(matCostByOrder).reduce((s, c) => s + c, 0)
  const totalProfit  = totalRevenue - totalMatCost
  const avgMargin    = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0

  const priced = orders.filter(o => o.sale_price)

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Total revenue</div><div className="stat-value" style={{ fontSize: '1.3rem' }}>${totalRevenue.toFixed(2)}</div></div>
        <div className="stat-card"><div className="stat-label">Material cost</div><div className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--danger)' }}>${totalMatCost.toFixed(2)}</div></div>
        <div className="stat-card"><div className="stat-label">Total profit</div><div className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--success)' }}>${totalProfit.toFixed(2)}</div></div>
        <div className="stat-card"><div className="stat-label">Avg margin</div><div className="stat-value" style={{ color: avgMargin > 50 ? 'var(--success)' : 'var(--warning)' }}>{avgMargin.toFixed(0)}%</div></div>
      </div>

      {priced.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">No cost data yet</div><div className="empty-sub">Add sale prices to orders and material rules to see per-board breakdown</div></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600 }}>Per-Board Breakdown</div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>Ordered by most recent first</div>
          </div>
          {priced.map(o => {
            const rev    = parseFloat(o.sale_price) || 0
            const mat    = matCostByOrder[o.id] || 0
            const profit = rev - mat
            const margin = rev > 0 ? ((profit / rev) * 100) : null
            return (
              <div key={o.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{o.customer_name}</div>
                    <div className="muted" style={{ fontSize: '0.82rem' }}>{o.shaper} {o.shape_name}{o.length_ft ? ` · ${o.length_ft}′` : ''}</div>
                  </div>
                  {margin !== null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, background: margin > 60 ? 'var(--success-pale)' : 'var(--warning-pale)', color: margin > 60 ? 'var(--success)' : 'var(--warning)' }}>
                      {margin.toFixed(0)}% margin
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  {[['Revenue', rev, 'var(--text)'],['Materials', mat, 'var(--danger)'],['Labour', 0, 'var(--text-muted)'],['Profit', profit, profit >= 0 ? 'var(--success)' : 'var(--danger)']].map(([label, val, color]) => (
                    <div key={label}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 500, color }}>${val.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Staff ──────────────────────────────────────────────────────

function StaffTab({ orders, staff }) {
  // Count tasks per worker
  const tasksByWorker = {}
  for (const o of orders) {
    for (const t of o.order_tasks ?? []) {
      if (!t.completed) continue
      const key = t.completed_by || 'unknown'
      tasksByWorker[key] = (tasksByWorker[key] || 0) + 1
    }
  }

  const totalTasks = Object.values(tasksByWorker).reduce((s, c) => s + c, 0)
  const maxTasks   = Math.max(...Object.values(tasksByWorker), 1)

  // Match worker IDs to staff names
  const getName = id => staff.find(s => s.id === id)?.name ?? 'Unknown'

  const sorted = Object.entries(tasksByWorker).sort((a, b) => b[1] - a[1])

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Active workers</div><div className="stat-value">{sorted.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total tasks done</div><div className="stat-value">{totalTasks}</div></div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">👷</div><div className="empty-title">No task completions yet</div><div className="empty-sub">Tasks need to be completed by named staff to appear here</div></div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Tasks per worker (all time)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sorted.map(([id, count]) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 100, fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--text)', flexShrink: 0 }}>{getName(id)}</div>
                  <div style={{ flex: 1, height: 20, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / maxTasks) * 100}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ width: 30, fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'right' }}>{count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Worker</th><th style={{ textAlign: 'right' }}>Tasks</th></tr></thead>
              <tbody>
                {sorted.map(([id, count]) => (
                  <tr key={id}><td style={{ fontWeight: 500 }}>{getName(id)}</td><td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{count} tasks</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Royalties ──────────────────────────────────────────────────

function RoyaltiesTab({ orders }) {
  // Group boards by shaper
  const byShaperName = {}
  for (const o of orders) {
    const name = o.shaper_ref?.name || o.shaper || 'Unknown'
    if (!byShaperName[name]) byShaperName[name] = { boards: 0, rate: o.shaper_ref?.royalty_rate_percent ?? 0, revenue: 0 }
    byShaperName[name].boards++
    byShaperName[name].revenue += parseFloat(o.sale_price ?? 0)
  }

  const shaperList = Object.entries(byShaperName).sort((a, b) => b[1].boards - a[1].boards)
  const totalBoards = shaperList.reduce((s, [, d]) => s + d.boards, 0)

  function exportCSV() {
    const rows = [['Shaper','Boards','Revenue','Royalty Rate','Royalty Owed']]
    for (const [name, d] of shaperList) {
      const owed = (d.revenue * (d.rate / 100)).toFixed(2)
      rows.push([name, d.boards, d.revenue.toFixed(2), `${d.rate}%`, owed])
    }
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'royalties.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Shapers</div><div className="stat-value">{shaperList.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total boards</div><div className="stat-value">{totalBoards}</div></div>
      </div>

      {shaperList.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🏄</div><div className="empty-title">No shaper data yet</div></div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {shaperList.map(([name, d]) => {
              const owed = d.revenue * (d.rate / 100)
              return (
                <div key={name} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: d.boards > 0 ? 12 : 0 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{name}</div>
                      <div className="muted" style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>{d.rate}% royalty rate</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-text)', fontWeight: 600 }}>{d.boards} boards</div>
                      {owed > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--warning)' }}>Owes ${owed.toFixed(2)}</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <button className="btn btn-secondary w-full" onClick={exportCSV}>↓ Export CSV</button>
        </>
      )}
    </div>
  )
}

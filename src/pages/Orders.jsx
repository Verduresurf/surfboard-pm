import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchOrders, fetchOrderTypes, getSettings } from '../lib/db'

const STATUSES = ['all','pending','in_progress','completed','shipped','cancelled']

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
}

function elapsedLabel(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  if (days < 7)  return `${days} days`
  const wks = Math.floor(days / 7)
  return wks === 1 ? '1 wk' : `${wks} wks`
}

function isOverdue(dateStr, status) {
  if (status === 'completed' || status === 'shipped') return false
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000) > 14
}

export default function Orders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [orderTypes, setOrderTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [columns, setColumns] = useState(1)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const filters = {}
      if (statusFilter !== 'all') filters.status = statusFilter
      const [data, types, settings] = await Promise.all([
        fetchOrders(filters),
        fetchOrderTypes(),
        getSettings(['card_columns']),
      ])
      setOrders(data)
      setOrderTypes(types)
      setColumns(parseInt(settings.card_columns) || 1)
    } catch(e) { setError(e.message) }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = orders.filter(o => {
    if (typeFilter !== 'all' && o.order_type?.id !== typeFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return o.customer_name?.toLowerCase().includes(q) || o.order_number?.toLowerCase().includes(q) || o.shape_name?.toLowerCase().includes(q) || o.shaper?.toLowerCase().includes(q)
  })

  const stats = {
    total:      orders.length,
    inProgress: orders.filter(o => o.status === 'in_progress').length,
    pending:    orders.filter(o => o.status === 'pending').length,
    completed:  orders.filter(o => o.status === 'completed').length,
  }

  return (
    <>
      <div className="page-header">
        <h1>Orders</h1>
        <button className="btn btn-primary" onClick={() => navigate('/orders/new')}>+ New Order</button>
      </div>
      <div className="page-body">
        <div className="stats-row">
          <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{stats.total}</div></div>
          <div className="stat-card"><div className="stat-label">In progress</div><div className="stat-value" style={{ color: 'var(--info)' }}>{stats.inProgress}</div></div>
          <div className="stat-card"><div className="stat-label">Pending</div><div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.pending}</div></div>
          <div className="stat-card"><div className="stat-label">Completed</div><div className="stat-value" style={{ color: 'var(--success)' }}>{stats.completed}</div></div>
        </div>

        <div className="filters-bar">
          <input className="search-input" placeholder="Search name, order no, shape…" value={search} onChange={e => setSearch(e.target.value)} />
          {STATUSES.map(s => (
            <button key={s} className={`filter-pill${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
          {orderTypes.map(ot => (
            <button key={ot.id} className={`filter-pill${typeFilter === ot.id ? ' active' : ''}`} onClick={() => setTypeFilter(typeFilter === ot.id ? 'all' : ot.id)}>
              {ot.name}
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={load} style={{ marginLeft: 'auto' }}>↺ Refresh</button>
        </div>

        {error && <div className="error-msg mb-4">{error}</div>}

        {loading ? (
          <div className="loading-spinner">LOADING ORDERS…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">No orders found</div>
            <div className="empty-sub">{search ? 'Try a different search' : 'Create your first order'}</div>
            {!search && <button className="btn btn-primary mt-4" onClick={() => navigate('/orders/new')}>+ New Order</button>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 16 }}>
            {filtered.map(order => <OrderCard key={order.id} order={order} onClick={() => navigate(`/orders/${order.id}`)} />)}
          </div>
        )}
      </div>
    </>
  )
}

function OrderCard({ order, onClick }) {
  const tasks    = order.order_tasks ?? []
  const done     = tasks.filter(t => t.completed).length
  const pct      = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const overdue  = isOverdue(order.created_at, order.status)
  const elapsed  = elapsedLabel(order.created_at)

  return (
    <div className={`order-card status-${order.status}`} onClick={onClick}>
      <div className="order-card-header">
        <div>
          <div className="order-number">{order.order_number}</div>
          <div className="order-customer">{order.customer_name}</div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {(order.shaper || order.shape_name) && (
        <div style={{ fontSize: '0.85rem', color: 'var(--accent-text)', fontWeight: 500, margin: '6px 0 2px' }}>
          {order.shaper}{order.shape_name ? ` — ${order.shape_name}` : ''}
        </div>
      )}

      <div className="order-specs">
        {order.length_ft && <span>{order.length_ft}′</span>}
        {order.width_in  && <span> × {order.width_in}″</span>}
        {order.thickness_in && <span> × {order.thickness_in}″</span>}
        {order.volume_l  && <span> {order.volume_l}L</span>}
        {order.colour    && <span> · {order.colour}</span>}
        {order.fin_setup && <span> · {order.fin_setup}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: overdue ? 'var(--warning)' : 'var(--text-dim)' }}>
          {elapsed}{overdue ? ' ⚠' : ''}
        </div>
        {order.sale_price && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--accent-text)', fontWeight: 600 }}>
            ${parseFloat(order.sale_price).toFixed(2)}
          </div>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="order-progress">
          <div className="progress-label">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)' }}>{done}/{tasks.length} steps</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)' }}>{pct}%</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent)' }} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
        {order.location?.name}{order.order_type?.name ? ` · ${order.order_type.name}` : ''}
      </div>
    </div>
  )
}
  )
}

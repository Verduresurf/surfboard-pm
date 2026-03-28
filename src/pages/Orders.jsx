import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchOrders } from '../lib/db'

const STATUSES = ['all', 'pending', 'in_progress', 'completed', 'shipped', 'cancelled']

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
}

function progressOf(order) {
  const tasks = order.order_tasks ?? []
  if (!tasks.length) return null
  const done = tasks.filter(t => t.completed).length
  return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) }
}

export default function Orders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters = {}
      if (statusFilter !== 'all') filters.status = statusFilter
      const data = await fetchOrders(filters)
      setOrders(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      o.customer_name?.toLowerCase().includes(q) ||
      o.order_number?.toLowerCase().includes(q) ||
      o.board_specs?.shape_name?.toLowerCase().includes(q)
    )
  })

  // Stats
  const stats = {
    total: orders.length,
    inProgress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
    pending: orders.filter(o => o.status === 'pending').length,
  }

  return (
    <>
      <div className="page-header">
        <h1>Orders</h1>
        <button className="btn btn-primary" onClick={() => navigate('/orders/new')}>
          + New Order
        </button>
      </div>

      <div className="page-body">
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">In progress</div>
            <div className="stat-value" style={{ color: 'var(--info)' }}>{stats.inProgress}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending</div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.completed}</div>
          </div>
        </div>

        <div className="filters-bar">
          <input
            className="search-input"
            placeholder="Search customer, order no, shape…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {STATUSES.map(s => (
            <button
              key={s}
              className={`filter-pill${statusFilter === s ? ' active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={load} style={{ marginLeft: 'auto' }}>
            ↺ Refresh
          </button>
        </div>

        {error && <div className="error-msg mb-4">{error}</div>}

        {loading ? (
          <div className="loading-spinner">LOADING ORDERS…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">No orders found</div>
            <div className="empty-sub">
              {search ? 'Try a different search' : 'Create your first order to get started'}
            </div>
            {!search && (
              <button className="btn btn-primary mt-4" onClick={() => navigate('/orders/new')}>
                + New Order
              </button>
            )}
          </div>
        ) : (
          <div className="orders-grid">
            {filtered.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => navigate(`/orders/${order.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function OrderCard({ order, onClick }) {
  const progress = progressOf(order)
  const spec = order.board_specs

  return (
    <div className={`order-card status-${order.status}`} onClick={onClick}>
      <div className="order-card-header">
        <div>
          <div className="order-number">{order.order_number}</div>
          <div className="order-customer">{order.customer_name}</div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {spec && (
        <div className="order-specs">
          {spec.shape_name && <span>{spec.shape_name} · </span>}
          {spec.length_ft && <span>{spec.length_ft}′</span>}
          {spec.width_in && <span> × {spec.width_in}″</span>}
          {spec.thickness_in && <span> × {spec.thickness_in}″</span>}
          {order.shaper?.name && <span style={{ marginLeft: 6, color: 'var(--accent-text)' }}> {order.shaper.name}</span>}
        </div>
      )}

      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
        {order.location?.name}
        {order.order_type?.name && ` · ${order.order_type.name}`}
      </div>

      {progress && (
        <div className="order-progress">
          <div className="progress-label">
            <span>Tasks</span>
            <span>{progress.done}/{progress.total}</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
        {new Date(order.created_at).toLocaleDateString()}
      </div>
    </div>
  )
}

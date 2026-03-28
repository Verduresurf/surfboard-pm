import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrder, fetchOrderTypes, fetchShapers, fetchLocations } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'

const FIN_SETUPS  = ['Single','Twin','Thruster','Quad','Five','2+1']
const FIN_SYSTEMS = ['FCS II','Futures','US Box','Glassed in']
const TAIL_SHAPES = ['Round','Squash','Square','Pin','Swallow','Bat','Fish','Asymmetric']

export default function NewOrder() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [orderTypes, setOrderTypes] = useState([])
  const [shapers, setShapers]     = useState([])
  const [locations, setLocations] = useState([])

  // All fields flat — board specs are inline on orders table
  const [form, setForm] = useState({
    status:          'pending',
    order_type_id:   '',
    location_id:     '',
    shaper_id:       '',
    shaper:          '',
    customer_name:   '',
    customer_email:  '',
    customer_phone:  '',
    shipping_address:'',
    notes:           '',
    shape_name:      '',
    length_ft:       '',
    width_in:        '',
    thickness_in:    '',
    volume_l:        '',
    colour:          '',
    fin_setup:       '',
    fin_system:      '',
    tail_shape:      '',
  })

  useEffect(() => {
    async function loadSettings() {
      try {
        const [ot, sh, loc] = await Promise.all([fetchOrderTypes(), fetchShapers(), fetchLocations()])
        setOrderTypes(ot)
        setShapers(sh)
        setLocations(loc)
        setForm(f => ({
          ...f,
          order_type_id: ot[0]?.id ?? '',
          location_id:   loc[0]?.id ?? '',
        }))
      } catch (e) { console.error('[NewOrder] settings error:', e) }
    }
    loadSettings()
  }, [])

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  // When shaper selected from dropdown, also set the text shaper field
  function handleShaperChange(shaperId) {
    const s = shapers.find(s => s.id === shaperId)
    set('shaper_id', shaperId)
    set('shaper', s?.name ?? '')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.customer_name.trim()) { setError('Customer name is required'); return }
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...form,
        order_type_id:  form.order_type_id  || null,
        location_id:    form.location_id    || null,
        shaper_id:      form.shaper_id      || null,
        length_ft:      form.length_ft      ? parseFloat(form.length_ft)      : null,
        width_in:       form.width_in       ? parseFloat(form.width_in)       : null,
        thickness_in:   form.thickness_in   ? parseFloat(form.thickness_in)   : null,
        volume_l:       form.volume_l       ? parseFloat(form.volume_l)       : null,
      }
      const created = await createOrder({ order: payload, userId: user.id })
      navigate(`/orders/${created.id}`)
    } catch (e) {
      console.error('[NewOrder] submit error:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>←</button>
        <h1>New Order</h1>
      </div>

      <div className="page-body">
        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg mb-4">{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

            {/* Customer + order info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 18 }}>Customer</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input className="form-input" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} required autoFocus />
                  </div>
                  <div className="form-row form-row-2">
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input className="form-input" type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input className="form-input" value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shipping address</label>
                    <textarea className="form-textarea" rows={2} value={form.shipping_address} onChange={e => set('shipping_address', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-title" style={{ marginBottom: 18 }}>Order Details</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-row form-row-2">
                    <div className="form-group">
                      <label className="form-label">Order type</label>
                      <select className="form-select" value={form.order_type_id} onChange={e => set('order_type_id', e.target.value)}>
                        <option value="">— none —</option>
                        {orderTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Location</label>
                      <select className="form-select" value={form.location_id} onChange={e => set('location_id', e.target.value)}>
                        <option value="">— none —</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-textarea" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Board specs */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 18 }}>Board Specs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Shape name</label>
                    <input className="form-input" value={form.shape_name} onChange={e => set('shape_name', e.target.value)} placeholder="Fish, Shortboard…" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shaper</label>
                    <select className="form-select" value={form.shaper_id} onChange={e => handleShaperChange(e.target.value)}>
                      <option value="">— none —</option>
                      {shapers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label className="form-label">Length (ft)</label>
                    <input className="form-input" type="number" step="0.01" value={form.length_ft} onChange={e => set('length_ft', e.target.value)} placeholder="6.2" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Width (in)</label>
                    <input className="form-input" type="number" step="0.125" value={form.width_in} onChange={e => set('width_in', e.target.value)} placeholder="19.5" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Thickness (in)</label>
                    <input className="form-input" type="number" step="0.0625" value={form.thickness_in} onChange={e => set('thickness_in', e.target.value)} placeholder="2.5" />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Volume (L)</label>
                    <input className="form-input" type="number" step="0.1" value={form.volume_l} onChange={e => set('volume_l', e.target.value)} placeholder="32.0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Colour</label>
                    <input className="form-input" value={form.colour} onChange={e => set('colour', e.target.value)} placeholder="Clear, Navy…" />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Fin setup</label>
                    <select className="form-select" value={form.fin_setup} onChange={e => set('fin_setup', e.target.value)}>
                      <option value="">— select —</option>
                      {FIN_SETUPS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fin system</label>
                    <select className="form-select" value={form.fin_system} onChange={e => set('fin_system', e.target.value)}>
                      <option value="">— select —</option>
                      {FIN_SYSTEMS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Tail shape</label>
                  <select className="form-select" value={form.tail_shape} onChange={e => set('tail_shape', e.target.value)}>
                    <option value="">— select —</option>
                    {TAIL_SHAPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/orders')}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? 'Creating…' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

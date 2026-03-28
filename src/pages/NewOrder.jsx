import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrder, fetchOrderTypes, fetchShapers, fetchLocations, getSettings } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'

const FIN_SETUPS  = ['Single','Twin','Thruster','Quad','Five','2+1']
const FIN_SYSTEMS = ['FCS II','Futures','US Box','Glassed in']
const TAIL_SHAPES = ['Round','Squash','Square','Pin','Swallow','Bat','Fish','Asymmetric']

export default function NewOrder() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [mode, setMode] = useState('manual') // 'manual' | 'ai'
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [orderTypes, setOrderTypes] = useState([])
  const [shapers, setShapers]       = useState([])
  const [locations, setLocations]   = useState([])
  const [aiTab, setAiTab]           = useState('screenshot')
  const [aiParsing, setAiParsing]   = useState(false)
  const [aiError, setAiError]       = useState(null)
  const fileRef = useRef()

  const [form, setForm] = useState({
    status: 'pending', order_type_id: '', location_id: '', shaper_id: '', shaper: '',
    customer_name: '', customer_email: '', customer_phone: '', shipping_address: '',
    notes: '', shape_name: '', length_ft: '', width_in: '', thickness_in: '',
    volume_l: '', colour: '', fin_setup: '', fin_system: '', tail_shape: '', sale_price: '',
  })

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }
  function handleShaperChange(id) {
    const s = shapers.find(s => s.id === id)
    set('shaper_id', id); set('shaper', s?.name ?? '')
  }

  useEffect(() => {
    async function loadSettings() {
      try {
        const [ot, sh, loc] = await Promise.all([fetchOrderTypes(), fetchShapers(), fetchLocations()])
        setOrderTypes(ot); setShapers(sh); setLocations(loc)
        setForm(f => ({ ...f, order_type_id: ot[0]?.id ?? '', location_id: loc[0]?.id ?? '' }))
      } catch(e) { console.error(e) }
    }
    loadSettings()
  }, [])

  function applyParsed(parsed) {
    setForm(f => ({
      ...f,
      customer_name:    parsed.customer_name    ?? f.customer_name,
      customer_email:   parsed.customer_email   ?? f.customer_email,
      customer_phone:   parsed.customer_phone   ?? f.customer_phone,
      shipping_address: parsed.shipping_address ?? f.shipping_address,
      shape_name:       parsed.shape_name       ?? f.shape_name,
      length_ft:        parsed.length_ft        ?? f.length_ft,
      width_in:         parsed.width_in         ?? f.width_in,
      thickness_in:     parsed.thickness_in     ?? f.thickness_in,
      volume_l:         parsed.volume_l         ?? f.volume_l,
      colour:           parsed.colour           ?? f.colour,
      fin_setup:        parsed.fin_setup        ?? f.fin_setup,
      fin_system:       parsed.fin_system       ?? f.fin_system,
      tail_shape:       parsed.tail_shape       ?? f.tail_shape,
      notes:            parsed.notes            ?? f.notes,
      sale_price:       parsed.sale_price       ?? f.sale_price,
      shaper:           parsed.shaper           ?? f.shaper,
    }))
    setMode('manual')
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAiParsing(true); setAiError(null)
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })
      const resp = await fetch('/api/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'image', content: { data: base64, mediaType: file.type } }),
      })
      const result = await resp.json()
      if (!resp.ok) throw new Error(result.error)
      applyParsed(result.data)
    } catch(e) {
      setAiError(e.message)
    } finally {
      setAiParsing(false)
      fileRef.current && (fileRef.current.value = '')
    }
  }

  async function handleTextParse(text) {
    if (!text.trim()) return
    setAiParsing(true); setAiError(null)
    try {
      const resp = await fetch('/api/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', content: text }),
      })
      const result = await resp.json()
      if (!resp.ok) throw new Error(result.error)
      applyParsed(result.data)
    } catch(e) {
      setAiError(e.message)
    } finally {
      setAiParsing(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.customer_name.trim()) { setError('Customer name is required'); return }
    setLoading(true); setError(null)
    try {
      const payload = {
        ...form,
        order_type_id: form.order_type_id || null,
        location_id:   form.location_id   || null,
        shaper_id:     form.shaper_id     || null,
        length_ft:     form.length_ft     ? parseFloat(form.length_ft)     : null,
        width_in:      form.width_in      ? parseFloat(form.width_in)      : null,
        thickness_in:  form.thickness_in  ? parseFloat(form.thickness_in)  : null,
        volume_l:      form.volume_l      ? parseFloat(form.volume_l)      : null,
        sale_price:    form.sale_price    ? parseFloat(form.sale_price)    : null,
      }
      const created = await createOrder({ order: payload, userId: user.id })
      navigate(`/orders/${created.id}`)
    } catch(e) {
      console.error('[NewOrder] submit error:', e)
      setError(e.message)
    } finally { setLoading(false) }
  }

  return (
    <>
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>←</button>
        <h1>New Order</h1>
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
          {[['manual','Manual Entry'],['ai','AI Import']].map(([m, label]) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              style={{ padding: '7px 16px', fontFamily: 'var(--font-head)', fontSize: '0.9rem', cursor: 'pointer', border: 'none', background: mode === m ? 'var(--accent)' : 'var(--surface2)', color: mode === m ? '#000' : 'var(--text-muted)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {mode === 'ai' && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Import Order</div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Upload a screenshot, photo of a handwritten form, or paste text — Claude will extract all the order details automatically.
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {['screenshot','text'].map(t => (
                <button key={t} type="button" className={`filter-pill${aiTab === t ? ' active' : ''}`}
                  onClick={() => setAiTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
              ))}
            </div>

            {aiTab === 'screenshot' && (
              <div>
                <input type="file" ref={fileRef} accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} id="ai-upload" />
                <label htmlFor="ai-upload" style={{ display: 'block', border: '2px dashed var(--border2)', borderRadius: 'var(--r)', padding: '32px', textAlign: 'center', cursor: aiParsing ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.target.style.borderColor = 'var(--accent-dim)'}
                  onMouseLeave={e => e.target.style.borderColor = 'var(--border2)'}
                >
                  {aiParsing
                    ? <div style={{ color: 'var(--text-muted)' }}>🤖 Parsing order… please wait</div>
                    : <div><div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div><div style={{ color: 'var(--text-muted)' }}>Upload screenshot, photo or scan of order form</div></div>
                  }
                </label>
              </div>
            )}

            {aiTab === 'text' && (
              <TextParseTab onParse={handleTextParse} loading={aiParsing} />
            )}

            {aiError && <div className="error-msg" style={{ marginTop: 12 }}>AI error: {aiError}</div>}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg mb-4">{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 18 }}>Customer</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} required autoFocus /></div>
                  <div className="form-row form-row-2">
                    <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Shipping address</label><textarea className="form-textarea" rows={2} value={form.shipping_address} onChange={e => set('shipping_address', e.target.value)} /></div>
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
                    <label className="form-label">Sale price</label>
                    <input className="form-input" type="number" step="0.01" value={form.sale_price} onChange={e => set('sale_price', e.target.value)} placeholder="e.g. 1200.00" />
                  </div>
                  <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 18 }}>Board Specs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">Shape name</label><input className="form-input" value={form.shape_name} onChange={e => set('shape_name', e.target.value)} placeholder="Fish, Mid…" /></div>
                  <div className="form-group">
                    <label className="form-label">Shaper</label>
                    <select className="form-select" value={form.shaper_id} onChange={e => handleShaperChange(e.target.value)}>
                      <option value="">— none —</option>
                      {shapers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row form-row-3">
                  <div className="form-group"><label className="form-label">Length (ft)</label><input className="form-input" type="number" step="0.01" value={form.length_ft} onChange={e => set('length_ft', e.target.value)} placeholder="6.2" /></div>
                  <div className="form-group"><label className="form-label">Width (in)</label><input className="form-input" type="number" step="0.125" value={form.width_in} onChange={e => set('width_in', e.target.value)} placeholder="19.5" /></div>
                  <div className="form-group"><label className="form-label">Thickness (in)</label><input className="form-input" type="number" step="0.0625" value={form.thickness_in} onChange={e => set('thickness_in', e.target.value)} placeholder="2.5" /></div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">Volume (L)</label><input className="form-input" type="number" step="0.1" value={form.volume_l} onChange={e => set('volume_l', e.target.value)} placeholder="32.0" /></div>
                  <div className="form-group"><label className="form-label">Colour</label><input className="form-input" value={form.colour} onChange={e => set('colour', e.target.value)} placeholder="Clear, Navy…" /></div>
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
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>{loading ? 'Creating…' : 'Create Order'}</button>
          </div>
        </form>
      </div>
    </>
  )
}

function TextParseTab({ onParse, loading }) {
  const [text, setText] = useState('')
  return (
    <div>
      <textarea className="form-textarea" rows={6} value={text} onChange={e => setText(e.target.value)}
        placeholder="Paste order email, message, or any text with order details here…"
        style={{ marginBottom: 12 }} />
      <button className="btn btn-primary" disabled={loading || !text.trim()} onClick={() => onParse(text)}>
        {loading ? '🤖 Parsing…' : '🤖 Parse with AI'}
      </button>
    </div>
  )
}


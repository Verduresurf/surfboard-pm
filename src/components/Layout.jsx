import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  {
    section: 'Production',
    items: [
      { to: '/orders',    label: 'Orders',    icon: IconOrders },
      { to: '/repairs',   label: 'Repairs',   icon: IconRepairs },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { to: '/materials', label: 'Materials', icon: IconMaterials },
    ],
  },
  {
    section: 'Business',
    items: [
      { to: '/reporting', label: 'Reporting', icon: IconReporting },
    ],
  },
  {
    section: 'System',
    items: [
      { to: '/settings',  label: 'Settings',  icon: IconSettings },
    ],
  },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Dark overlay when menu open on mobile */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 300,
          }}
        />
      )}

      {/* Sidebar */}
      <nav style={{
        width: 220,
        minHeight: '100vh',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'fixed',
        top: 0, left: 0,
        zIndex: 400,
        transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
      }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-text)' }}>SurfPM</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>Production System</div>
        </div>

        <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {NAV.map(group => (
            <div key={group.section}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)', padding: '12px 20px 4px' }}>
                {group.section}
              </div>
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <item.icon className="icon" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          <div style={{ fontWeight: 500, color: 'var(--text-muted)', marginBottom: 2 }}>{profile?.full_name ?? 'User'}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-dim)' }}>{profile?.role}</div>
          <button
            onClick={handleSignOut}
            style={{ marginTop: 10, background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--text-muted)', padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, minHeight: '100vh', marginLeft: 0 }}>

        {/* Mobile top bar — always visible */}
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: 52,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          zIndex: 200,
        }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer', padding: 8,
              display: 'flex', flexDirection: 'column',
              gap: 5, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ display: 'block', width: 22, height: 2, background: 'var(--text)', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 22, height: 2, background: 'var(--text)', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 22, height: 2, background: 'var(--text)', borderRadius: 2 }} />
          </button>
        </div>

        {/* Spacer so content doesn't hide under fixed bar */}
        <div style={{ height: 52 }} />

        <Outlet />
      </div>
    </div>
  )
}

function IconOrders({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2"/>
      <line x1="5" y1="6" x2="11" y2="6"/>
      <line x1="5" y1="8.5" x2="11" y2="8.5"/>
      <line x1="5" y1="11" x2="8" y2="11"/>
    </svg>
  )
}

function IconRepairs({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2.5a4 4 0 0 1-5.5 5.5L2 10l4 4 2-2a4 4 0 0 1 5.5-5.5"/>
    </svg>
  )
}

function IconMaterials({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="9" width="5" height="5" rx="1"/>
      <rect x="9" y="9" width="5" height="5" rx="1"/>
      <rect x="5.5" y="2" width="5" height="5" rx="1"/>
    </svg>
  )
}

function IconReporting({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="13" x2="2" y2="5"/>
      <line x1="6" y1="13" x2="6" y2="8"/>
      <line x1="10" y1="13" x2="10" y2="4"/>
      <line x1="14" y1="13" x2="14" y2="7"/>
    </svg>
  )
}

function IconSettings({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M13 3l-1.4 1.4M4.4 11.6 3 13"/>
    </svg>
  )
}

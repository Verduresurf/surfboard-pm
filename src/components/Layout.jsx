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

  function handleNavClick() {
    setMenuOpen(false)
  }

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 99,
          }}
        />
      )}

      {/* Sidebar */}
      <nav className="sidebar" style={{
        transform: menuOpen ? 'translateX(0)' : undefined,
      }}>
        <div className="sidebar-logo">
          <div className="wordmark">SurfPM</div>
          <div className="sub">Production System</div>
        </div>

        <div className="sidebar-nav">
          {NAV.map(group => (
            <div key={group.section}>
              <div className="nav-section-label">{group.section}</div>
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={handleNavClick}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <item.icon className="icon" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-name">{profile?.full_name ?? 'User'}</div>
          <div className="user-role">{profile?.role?.replace('_', ' ')}</div>
          <button className="sign-out" onClick={handleSignOut}>Sign out</button>
        </div>
      </nav>

      {/* Main content */}
      <main className="page-content">
        {/* Mobile header bar */}
        <div className="mobile-header">
          <button
            className="hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-text)', fontSize: '1.1rem' }}>
            SurfPM
          </div>
          <div style={{ width: 36 }} />
        </div>

        <Outlet />
      </main>
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

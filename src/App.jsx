import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import NewOrder from './pages/NewOrder'
import Materials from './pages/Materials'
import Repairs from './pages/Repairs'
import Settings from './pages/Settings'
import Reporting from './pages/Reporting'
import Track from './pages/Track'

function AppRoutes() {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner">LOADING…</div>
      </div>
    )
  }

  // Public tracking page — no auth required
  // Must be outside auth guard

  return (
    <Routes>
      <Route path="/track/:token" element={<Track />} />

      {!session ? (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      ) : (
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/orders" replace />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/new" element={<NewOrder />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/repairs" element={<Repairs />} />
          <Route path="/reporting" element={<Reporting />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/orders" replace />} />
        </Route>
      )}
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

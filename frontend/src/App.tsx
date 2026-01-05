import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { useAuth } from './hooks/useAuth'
import { Register } from './pages/Register'
import { Login } from './pages/Login'
import { PendingApproval } from './pages/PendingApproval'
import { AdminUsers } from './pages/AdminUsers'
import { AdminPitches } from './pages/AdminPitches'
import { Home } from './pages/Home'
import { Bookings } from './pages/Bookings'
import { Profile } from './pages/Profile'
import { MainLayout } from './components/MainLayout'
import { ToastContainer } from './components/ToastContainer'
import { signOut } from './lib/auth'
import './App.css'
import Loading from './components/Loading'

// Logout handler component
function LogoutHandler() {
  useEffect(() => {
    const handleLogout = async () => {
      await signOut()
      window.location.href = '/login'
    }
    handleLogout()
  }, [])

  return <div className="loading">Logging out...</div>
}

// Approval-restricted route (only approved users + admins)
function ApprovedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isApproved, profile } = useAuth()

  console.log('[ApprovedRoute] Checking access:', { userId: user?.id, isApproved, role: profile?.role })

  if (loading) {
    return <Loading />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isApproved) {
    console.log('[ApprovedRoute] Access denied - redirecting to pending approval')
    return <Navigate to="/pending-approval" replace />
  }

  console.log('[ApprovedRoute] Access granted')
  return <>{children}</>
}

// Dashboard component (shown to authenticated users)
function Dashboard() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<ApprovedRoute><Home /></ApprovedRoute>} />
        <Route path="/bookings" element={<ApprovedRoute><Bookings /></ApprovedRoute>} />
        <Route path="/profile" element={<ApprovedRoute><Profile /></ApprovedRoute>} />
        <Route path="/admin/users" element={<ApprovedRoute><AdminUsers /></ApprovedRoute>} />
        <Route path="/admin/pitches" element={<ApprovedRoute><AdminPitches /></ApprovedRoute>} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/logout" element={<LogoutHandler />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  )
}

// Main app router
function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return <Loading />
  }

  // Already logged in, redirect to dashboard
  if (user) {
    return <Dashboard />
  }

  // Not logged in, show auth pages
  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/logout" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
          <ToastContainer />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

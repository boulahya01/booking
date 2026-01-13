import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { useAuth } from './hooks/useAuth'
import { Register } from './pages/Register'
import { Login } from './pages/Login'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { PendingApproval } from './pages/PendingApproval'
import { AdminUsers } from './pages/AdminUsers'
import { AdminPitches } from './pages/AdminPitches'
import { AdminUserManagement } from './pages/AdminUserManagement'
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
        <Route path="/admin/user-management" element={<ApprovedRoute><AdminUserManagement /></ApprovedRoute>} />
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
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    // Give Supabase a moment to process the recovery URL hash and establish session
    // This ensures detectSessionInUrl has time to parse #access_token=...&type=recovery
    const timer = setTimeout(() => setIsInitializing(false), 100)
    return () => clearTimeout(timer)
  }, [])

  if (loading || isInitializing) {
    return <Loading />
  }

  // Check if user is in password reset recovery flow (or explicitly on the reset page)
  // Recovery token is normally in the URL hash: #access_token=...&type=recovery
  const currentHash = window.location.hash
  const pathname = window.location.pathname
  const isRecoveryHash = currentHash.includes('type=recovery')
  // Some email templates or redirects may not include the `type=recovery` piece
  // but still land the user on the `/reset-password` path. Treat that as recovery too.
  const isResetPath = pathname === '/reset-password' || pathname.startsWith('/reset-password')

  // If user is in recovery flow or explicitly on the reset page, ALWAYS show reset password page
  if (isRecoveryHash || isResetPath) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/reset-password" replace />} />
      </Routes>
    )
  }

  // Already logged in (but not in recovery flow), redirect to dashboard
  if (user) {
    return <Dashboard />
  }

  // Not logged in, show auth pages
  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
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

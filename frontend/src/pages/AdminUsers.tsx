import { useEffect, useState } from 'react'
import { FiCheck, FiX, FiHash, FiCalendar, FiUser } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import type { Profile } from '../types/database'
import { useToast } from '../hooks/useToast'
import { useTranslation } from 'react-i18next'
import '../styles/AdminUsers.css'

export function AdminUsers() {
  const { profile: userProfile, loading: authLoading } = useAuth()
  const { i18n } = useTranslation()
  const toast = useToast()
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const navigate = useNavigate()
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject' | null
    userId?: string | null
  }>({ type: null, userId: null })

  useEffect(() => {
    // Wait until auth finished loading
    if (authLoading) return

    // Verify admin role, redirect non-admins
    if (userProfile?.role !== 'admin') {
      navigate('/dashboard')
      return
    }

    // User is admin and auth loaded — fetch pending users
    fetchPendingUsers()
  }, [authLoading, userProfile?.role, navigate])

  const fetchPendingUsers = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError, status, statusText } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      console.debug('fetchPendingUsers response', { status, statusText, data, fetchError })

      if (fetchError) throw fetchError
      setPendingUsers(data || [])
    } catch (err: any) {
      console.error('fetchPendingUsers error', err)
      setError(err.message || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const startConfirm = (type: 'approve' | 'reject', userId: string) => {
    setConfirmAction({ type, userId })
  }

  const cancelConfirm = () => setConfirmAction({ type: null, userId: null })

  const performConfirmedAction = async () => {
    const { type, userId } = confirmAction
    if (!type || !userId) return cancelConfirm()

    try {
      setActionLoading(userId)

      const newStatus = type === 'approve' ? 'approved' : 'rejected'
      console.debug('performConfirmedAction starting', { userId, newStatus })

      // Use RPC to perform admin-approved status change to avoid RLS recursion
      const { data, error: rpcError, status } = await supabase.rpc('approve_profile', {
        target_id: userId,
        new_status: newStatus,
      })

      console.debug('performConfirmedAction rpc response', { status, data, rpcError })

      if (rpcError) throw rpcError

      await fetchPendingUsers()
      toast.success(`User ${newStatus}`)
    } catch (err: any) {
      console.error('performConfirmedAction error', err)
      const msg = err?.message || `Failed to ${confirmAction.type} user`
      setError(msg)
      toast.error(msg)
    } finally {
      setActionLoading(null)
      cancelConfirm()
    }
  }

  if (authLoading) {
    return <div className="admin-container">Loading...</div>
  }

  if (userProfile?.role !== 'admin') {
    return <div className="admin-container">Access denied. Admin only.</div>
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin Panel - User Approvals</h1>
        <p>Manage pending user registrations</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {error && (
        <div className="error-message">
          {error}
          <div style={{ marginTop: 8 }}>
            <button className="btn-retry" onClick={() => fetchPendingUsers()}>
              Retry
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading pending users...</div>
      ) : pendingUsers.length === 0 ? (
        <div className="no-users">
          <p>No pending users to approve</p>
        </div>
      ) : (
        <div className="users-list">
          {pendingUsers.map((user) => (
            <div key={user.id} className="user-card">
              <div className="user-info">
                <div className="user-name" title={user.full_name || 'N/A'}><FiUser style={{ marginRight: 8 }} />{user.full_name || 'N/A'}</div>
                <div className="user-student-id"><FiHash style={{ marginRight: 8 }} />{user.student_id}</div>
                <div className="user-meta">
                  <span className="user-created"><FiCalendar style={{ marginRight: 8 }} />{new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', numberingSystem: 'latn' }).format(new Date(user.created_at))}</span>
                </div>
              </div>
              <div className="user-actions">
                <button
                  onClick={() => startConfirm('reject', user.id)}
                  disabled={actionLoading === user.id}
                  className="btn-reject"
                  title="Reject user"
                  aria-label="Reject user"
                >
                  {actionLoading === user.id ? '...' : <><FiX /> <span className="btn-text">Reject</span></>}
                </button>
                <button
                  onClick={() => startConfirm('approve', user.id)}
                  disabled={actionLoading === user.id}
                  className="btn-approve"
                  aria-label="Approve user"
                >
                  {actionLoading === user.id ? '...' : <><FiCheck /> <span className="btn-text">Approve</span></>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="admin-footer">
        <p>Total pending users: {pendingUsers.length}</p>
      </div>
      {confirmAction.type && confirmAction.userId && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>{confirmAction.type === 'approve' ? 'Approve User' : 'Reject User'}</h2>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to <strong>{confirmAction.type}</strong> this user?
              </p>
              <div className="modal-user-info">
                <div className="modal-user-name">
                  {pendingUsers.find((u) => u.id === confirmAction.userId)?.full_name || 'User'}
                </div>
                <div className="modal-user-id">
                  Student ID: {pendingUsers.find((u) => u.id === confirmAction.userId)?.student_id}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={cancelConfirm}>
                Cancel
              </button>
              <button
                className={confirmAction.type === 'approve' ? 'btn-approve' : 'btn-modal-reject'}
                onClick={performConfirmedAction}
                disabled={actionLoading === confirmAction.userId}
              >
                {actionLoading === confirmAction.userId ? '...' : confirmAction.type === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabaseClient'
import { Card, Button, Spinner } from '../ui'
import { FiTrash2, FiHash, FiMail, FiUser, FiInfo, FiClipboard } from 'react-icons/fi'
import '../styles/Admin.css'
 
interface User {
  id: string
  full_name: string
  student_id: string
  role: 'student' | 'admin' | 'moderator'
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  email?: string
  created_at: string
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'suspended'

export function AdminUserManagement() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const toast = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const deleteModalRef = useRef<HTMLDivElement | null>(null)
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null)
  const detailModalRef = useRef<HTMLDivElement | null>(null)

  // Check if user is admin
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      toast.error(t('admin_user_management.access_denied'))
      window.location.href = '/dashboard'
    }
  }, [profile, toast, t])

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError('')

      const query = supabase.from('profiles').select('*')

      if (filterStatus !== 'all') {
        query.eq('status', filterStatus)
      }

      const { data, error: fetchError } = await query.order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setUsers(data || [])
    } catch (err: any) {
      setError(err.message)
      toast.error(t('admin_user_management.failed_load'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [filterStatus])

  // Handle delete user
  const handleDeleteUser = (user: User) => {
    setSelectedUser(user)
    setShowDeleteModal(true)
  }

  // Focus management & keyboard handling for modals
  useEffect(() => {
    if (showDeleteModal) {
      // focus the confirm button for accessibility
      confirmBtnRef.current?.focus()

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setShowDeleteModal(false)
      }

      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
  }, [showDeleteModal])

  useEffect(() => {
    if (showDetailModal) {
      detailModalRef.current?.focus()

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setShowDetailModal(false)
      }

      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
  }, [showDetailModal])

  const handleRowClick = (user: User) => {
    setSelectedUser(user)
    setShowDetailModal(true)
  }

  const confirmDelete = async () => {
    if (!selectedUser) return

    try {
      setDeletingId(selectedUser.id)
      setShowDeleteModal(false)

      const { error: deleteError } = await supabase.from('profiles').delete().eq('id', selectedUser.id)

      if (deleteError) throw deleteError

      toast.success(t('admin_user_management.user_deleted'))
      setUsers(users.filter((u) => u.id !== selectedUser.id))
      setSelectedUser(null)
    } catch (err: any) {
      toast.error(t('admin_user_management.failed_delete'))
      console.error('Delete error:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleCopy = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success((label ? `${label} ` : '') + t('admin_user_management.copied'))
    } catch (err) {
      toast.error(t('admin_user_management.copy_failed'))
    }
  }

  if (!profile || profile.role !== 'admin') {
    return null
  }

  return (
    <>
      <div className="admin-container">
        <div className="admin-header">
          <div className="admin-header-top">
            <div>
              <h1 className="admin-title">{t('admin_user_management.title')}</h1>
              <p className="admin-subtitle">{t('admin_user_management.subtitle')}</p>
            </div>
            <div className="admin-stats">
              <div className="stat-card">
                <div className="stat-value">{users.length}</div>
                <div className="stat-label">Total Users</div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-section">
            <p className="error-message">{error}</p>
            <Button onClick={() => fetchUsers()} variant="primary">
              {t('admin_user_management.retry')}
            </Button>
          </div>
        )}

        {!error && (
          <Card>
            <div className="filter-section">
              <label htmlFor="status-filter" className="filter-label">
                {t('admin_user_management.filter_label')}
              </label>
              <select
                id="status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="filter-select"
              >
                <option value="all">{t('admin_user_management.filter_all')}</option>
                <option value="pending">{t('admin_user_management.filter_pending')}</option>
                <option value="approved">{t('admin_user_management.filter_approved')}</option>
                <option value="rejected">{t('admin_user_management.filter_rejected')}</option>
              </select>
            </div>

            {loading ? (
              <div className="loading-container">
                <Spinner size={32} />
                <p>{t('admin_user_management.loading')}</p>
              </div>
            ) : users.length === 0 ? (
              <div className="empty-state">
                <p>{t('admin_user_management.no_users')}</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>{t('admin_user_management.full_name_header')}</th>
                      <th>{t('admin_user_management.student_id_header')}</th>
                      <th>{t('admin_user_management.status_header')}</th>
                      <th>{t('admin_user_management.actions_header')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} onClick={() => handleRowClick(user)} className="user-row">
                        <td className="cell-full-name" data-label={t('admin_user_management.full_name_header')}>
                          <div className="name-wrap">
                            <div className="name-line">{user.full_name}</div>
                            <div className="mobile-meta" aria-hidden>
                              <span className="meta-item"><FiHash size={14} style={{ marginRight: 8 }} />{user.student_id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="cell-student-id" data-label={t('admin_user_management.student_id_header')}>{user.student_id}</td>
                        <td className="cell-status" data-label={t('admin_user_management.status_header')}>
                          <span className={`status-badge status-${user.status}`}>{t(`admin_user_management.status_${user.status}`)}</span>
                        </td>
                        <td className="cell-actions">
                          <Button
                            onClick={(e) => { e.stopPropagation(); handleDeleteUser(user) }}
                            variant="danger"
                            disabled={deletingId === user.id}
                            className="delete-btn"
                            title={t('admin_user_management.delete_button')}
                            aria-label={t('admin_user_management.delete_button')}
                          >
                            {deletingId === user.id ? <Spinner size={14} /> : <FiTrash2 size={16} />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            ref={deleteModalRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-modal-title" className="modal-title">{t('admin_user_management.delete_modal_title')}</h2>
            <p className="modal-message">
              {t('admin_user_management.delete_modal_message', { name: selectedUser!.full_name })}
            </p>
            <p className="modal-warning">{t('admin_user_management.delete_warning')}</p>
            <div className="modal-actions">
              <Button onClick={() => setShowDeleteModal(false)} variant="ghost" aria-label={t('admin_user_management.cancel_button')}>
                {t('admin_user_management.cancel_button')}
              </Button>
              <Button onClick={confirmDelete} variant="danger" aria-label={t('admin_user_management.confirm_delete')} ref={confirmBtnRef}>
                {t('admin_user_management.confirm_delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal (row click) */}
      {showDetailModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-modal-title"
            ref={detailModalRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="detail-modal-title" className="sr-only">{selectedUser.full_name}</h2>

            <div className="detail-grid" style={{ marginTop: 'var(--space-4)' }}>
              <div className="detail-item">
                <div className="detail-label"><FiUser size={16} style={{ marginRight: 8 }} />{t('admin_user_management.full_name_header')}</div>
                <div className="detail-value">{selectedUser.full_name}</div>
              </div>

              <div className="detail-item">
                <div className="detail-label"><FiHash size={16} style={{ marginRight: 8 }} />{t('admin_user_management.student_id_header')}</div>
                <div className="detail-value">
                  <span>{selectedUser.student_id}</span>
                  <button className="copy-btn" onClick={(e) => { e.stopPropagation(); handleCopy(selectedUser.student_id, t('admin_user_management.student_id_header')) }} aria-label="Copy Student ID">
                    <FiClipboard />
                  </button>
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label"><FiMail size={16} style={{ marginRight: 8 }} />Email</div>
                <div className="detail-value">
                  <span>{selectedUser.email || '-'}</span>
                  {selectedUser.email && (
                    <button className="copy-btn" onClick={(e) => { e.stopPropagation(); handleCopy(selectedUser.email!, 'Email') }} aria-label="Copy Email">
                      <FiClipboard />
                    </button>
                  )}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label"><FiInfo size={16} style={{ marginRight: 8 }} />{t('admin_user_management.status_header')}</div>
                <div className="detail-value"><span className={`status-badge status-${selectedUser.status}`}>{t(`admin_user_management.status_${selectedUser.status}`)}</span></div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 'var(--space-4)' }}>
              <Button onClick={() => { setShowDetailModal(false); setShowDeleteModal(true) }} variant="danger" className="delete-btn">
                <FiTrash2 style={{ marginRight: 8 }} /> {t('admin_user_management.delete_button')}
              </Button>
              <Button onClick={() => setShowDetailModal(false)} variant="ghost">
                {t('admin_user_management.cancel_button')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

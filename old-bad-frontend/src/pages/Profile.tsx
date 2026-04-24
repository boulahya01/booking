import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabaseClient'
import { Input, Button, Card } from '../ui'
import { FiUser, FiLock } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import '../styles/Profile.css'

export function Profile() {
  const { t } = useTranslation()
  const { user, profile, loading: authLoading } = useAuth()
  const toast = useToast()
  const [fullName, setFullName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [, setError] = useState('')
  const [, setSuccess] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [, setPasswordError] = useState('')
  const [, setPasswordSuccess] = useState('')
  const [, setCurrentPassword] = useState('')

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setStudentId(profile.student_id || '')
    }
  }, [profile])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
        })
        .eq('id', user?.id)

      if (updateError) {
        toast.error(updateError.message)
      } else {
        toast.success('Profile updated successfully!')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setPasswordLoading(true)

    try {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (passwordError) {
        toast.error(passwordError.message)
      } else {
        toast.success('Password changed successfully!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setShowPasswordForm(false)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  if (authLoading) {
    return <div className="loading">{t('profile.loading')}</div>
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1><FiUser style={{ display: 'inline', marginRight: '12px', verticalAlign: 'middle' }} /> {t('profile.title')}</h1>
        <p className="subtitle">{t('profile.subtitle')}</p>
      </div>

      <div className="profile-grid">
        {/* Profile Information Card */}
        <Card>
          <div className="card-header">
            <h2>{t('profile.settings')}</h2>
          </div>

          <form onSubmit={handleUpdateProfile} className="profile-form">
            <div className="form-group">
              <label htmlFor="fullName">{t('profile.full_name_label')}</label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('profile.full_name_placeholder')}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="studentId">{t('profile.student_id_label')}</label>
              <Input
                id="studentId"
                type="text"
                value={studentId}
                disabled
                placeholder={t('profile.student_id_label')}
              />
            </div>

            <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? t('profile.saving') : t('profile.save_changes')}
            </Button>
          </form>
        </Card>

        {/* Change Password Card */}
        <Card>
          <div className="card-header">
            <h2><FiLock style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />{t('profile.security')}</h2>
          </div>

          {!showPasswordForm ? (
            <Button
                variant="ghost"
                onClick={() => setShowPasswordForm(true)}
                style={{ width: '100%' }}
              >
              Change Password
            </Button>
          ) : (
            <form onSubmit={handleChangePassword} className="profile-form">
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  disabled={passwordLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={passwordLoading}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={passwordLoading}
                  style={{ flex: 1 }}
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowPasswordForm(false)
                    setCurrentPassword('')
                    setNewPassword('')
                    setConfirmPassword('')
                    setPasswordError('')
                  }}
                  disabled={passwordLoading}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* Account Info Card */}
        <Card>
          <div className="card-header">
            <h2>Account Info</h2>
          </div>

          <div className="info-list">
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">{user?.email}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Role:</span>
              <span className="info-value">
                {profile?.role === 'admin' ? (
                  <span className="badge badge-admin">Admin</span>
                ) : (
                  <span className="badge badge-student">Student</span>
                )}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Status:</span>
              <span className="info-value">
                {profile?.status === 'approved' ? (
                  <span className="badge badge-approved">Approved</span>
                ) : (
                  <span className="badge badge-pending">Pending</span>
                )}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default Profile

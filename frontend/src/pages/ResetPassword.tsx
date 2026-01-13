import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FiLock, FiCheck, FiAlertCircle } from 'react-icons/fi'
import { updatePassword } from '../lib/auth'
import { supabase } from '../lib/supabaseClient'
import '../styles/Auth.css'
import { Input, Button, Card, Spinner } from '../ui'
import { AuthLayout } from '../components/AuthLayout'

export function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validToken, setValidToken] = useState(true)
  const [isReady, setIsReady] = useState(false)

  // Check if user has valid session from reset link
  useEffect(() => {
    const checkResetToken = async () => {
      // Supabase sends reset links with #type=recovery in the hash
      const hash = window.location.hash
      const isRecoveryFlow = hash.includes('type=recovery')

      if (isRecoveryFlow) {
        // Give Supabase a moment to process the hash and establish session (detectSessionInUrl)
        // Small delay ensures auth state change listener has fired
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Verify session exists
        try {
          const sessionRes = await supabase.auth.getSession()
          const session = sessionRes?.data?.session ?? null
          
          console.log('[ResetPassword] Session check:', { hasSession: !!session, accessToken: session?.access_token?.substring(0, 20) })
          
          setValidToken(true)
        } catch (err) {
          console.error('[ResetPassword] error checking session:', err)
          setValidToken(false)
          setError(t('reset_password.invalid_link'))
        } finally {
          setIsReady(true)
        }
      } else {
        setValidToken(false)
        setError(t('reset_password.invalid_link'))
        setIsReady(true)
      }
    }

    checkResetToken()
  }, [t])

  const validateForm = () => {
    if (!password) {
      setError(t('reset_password.password_required'))
      return false
    }
    if (password.length < 6) {
      setError(t('reset_password.password_too_short'))
      return false
    }
    if (!confirmPassword) {
      setError(t('reset_password.confirm_required'))
      return false
    }
    if (password !== confirmPassword) {
      setError(t('reset_password.passwords_mismatch'))
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!validateForm()) {
      setLoading(false)
      return
    }

    const { error: updateError } = await updatePassword(password)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      // Auto-redirect after 2 seconds
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    }
  }

  if (!isReady) {
    return (
      <AuthLayout>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <Spinner size={24} />
          </div>
        </Card>
      </AuthLayout>
    )
  }

  if (!validToken) {
    return (
      <AuthLayout>
        <Card>
          <div className="auth-layout-header" style={{ textAlign: 'center' }}>
            <FiAlertCircle size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
            <h1 className="auth-layout-title" style={{ color: '#dc2626' }}>
              {t('reset_password.invalid_link')}
            </h1>
            <p className="auth-layout-subtitle">{t('reset_password.link_expired')}</p>
          </div>

          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '2rem',
              color: '#991b1b',
              fontSize: '0.9rem',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0.5rem 0' }}>{t('reset_password.request_new_reset')}</p>
          </div>

          <Button
            variant="primary"
            onClick={() => navigate('/forgot-password')}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {t('reset_password.request_reset_link')}
          </Button>
        </Card>
      </AuthLayout>
    )
  }

  if (success) {
    return (
      <AuthLayout>
        <Card>
          <div className="auth-layout-header" style={{ textAlign: 'center' }}>
            <FiCheck size={48} style={{ color: '#22c55e', marginBottom: '1rem' }} />
            <h1 className="auth-layout-title" style={{ color: '#16a34a' }}>
              {t('reset_password.success')}
            </h1>
            <p className="auth-layout-subtitle">{t('reset_password.password_updated')}</p>
          </div>

          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '2rem',
              color: '#15803d',
              fontSize: '0.9rem',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0.5rem 0' }}>{t('reset_password.redirecting')}</p>
          </div>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card>
        <div className="auth-layout-header">
          <h1 className="auth-layout-title">{t('reset_password.title')}</h1>
          <p className="auth-layout-subtitle">{t('reset_password.subtitle')}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('reset_password.new_password')}
            disabled={loading}
            icon={<FiLock />}
          />

          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('reset_password.confirm_password')}
            disabled={loading}
            icon={<FiLock />}
          />

          <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? <Spinner size={16} /> : t('reset_password.update_password')}
          </Button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
          {t('reset_password.remember_password')}{' '}
          <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 'var(--font-weight-semibold)' }}>
            {t('reset_password.back_to_login')}
          </a>
        </p>
      </Card>
    </AuthLayout>
  )
}

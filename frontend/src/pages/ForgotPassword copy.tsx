import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiMail, FiCheck } from 'react-icons/fi'
import '../styles/Auth.css'
import { Card, Input, Button, Spinner } from '../ui'
import { AuthLayout } from '../components/AuthLayout'
import { resetPasswordForEmail } from '../lib/auth'

export function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const validateEmail = (emailValue: string) => {
    if (!emailValue) {
      setError(t('forgot_password.email_required'))
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailValue)) {
      setError(t('forgot_password.invalid_email'))
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateEmail(email)) {
      return
    }

    setLoading(true)
    const { error: resetError } = await resetPasswordForEmail(email)

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
    } else {
      setEmailSent(true)
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <AuthLayout>
        <Card>
          <div className="auth-layout-header" style={{ textAlign: 'center' }}>
            <FiCheck size={48} style={{ color: '#22c55e', marginBottom: '1rem' }} />
            <h1 className="auth-layout-title" style={{ color: '#16a34a' }}>
              {t('forgot_password.email_sent_title', 'Check your email')}
            </h1>
            <p className="auth-layout-subtitle">{t('forgot_password.email_sent_subtitle', 'We sent a password reset link to your email address.')}</p>
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
            <p style={{ margin: '0.5rem 0' }}>{t('forgot_password.email_sent_instruction', 'Click the link in your email to reset your password. The link expires in 1 hour.')}</p>
          </div>

          <Button
            variant="primary"
            onClick={() => {
              setEmailSent(false)
              setEmail('')
            }}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {t('forgot_password.send_another_email', 'Send another email')}
          </Button>

          <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
            {t('forgot_password.back_to_login', 'Back to Login')}{' '}
            <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 'var(--font-weight-semibold)' }}>
              {t('forgot_password.login_here', 'Login here')}
            </a>
          </p>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card>
        <div className="auth-layout-header">
          <h1 className="auth-layout-title">{t('forgot_password.title')}</h1>
          <p className="auth-layout-subtitle">{t('forgot_password.subtitle')}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('forgot_password.email_placeholder')}
            disabled={loading}
            icon={<FiMail />}
          />

          <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? <Spinner size={16} /> : t('forgot_password.send_reset_link', 'Send Reset Link')}
          </Button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
          {t('forgot_password.remember_password', "Remember your password?")}{' '}
          <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 'var(--font-weight-semibold)' }}>
            {t('forgot_password.login_here', 'Login here')}
          </a>
        </p>
      </Card>
    </AuthLayout>
  )
}

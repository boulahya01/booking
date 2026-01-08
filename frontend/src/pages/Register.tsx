import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { FiMail, FiLock, FiUser, FiUserCheck } from 'react-icons/fi'
import { register } from '../lib/auth'
import '../styles/Auth.css'
import { Input, Button, Card, Spinner } from '../ui'
import { AuthLayout } from '../components/AuthLayout'

export function Register() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [studentId, setStudentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const navigate = useNavigate()

  const validateForm = () => {
    if (!email || !password || !confirmPassword || !studentId || !fullName) {
      setError(t('register.errors.required'))
      return false
    }
    if (password !== confirmPassword) {
      setError(t('register.errors.password_mismatch'))
      return false
    }
    if (password.length < 6) {
      setError(t('register.errors.password_short'))
      return false
    }
    if (!email.includes('@')) {
      setError(t('register.errors.invalid_email'))
      return false
    }
    if (fullName.trim().length < 6) {
      setError(t('register.errors.invalid_name'))
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

    const { error: authError } = await register(email, password, studentId, fullName)

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
    }
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">{t('register.welcome')}</h1>
          <p className="text-gray-600">{t('register.created')}</p>
        </div>
        <Card>
          <div style={{ textAlign: 'center', paddingTop: 'var(--space-4)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>✓</div>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text)', marginBottom: 'var(--space-3)' }}>
              {t('register.hi_user', { name: fullName })}
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
              {t('register.approval_note')}
            </p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-4)' }}>
              {t('register.redirect')}
            </p>
          </div>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card>
        <div className="auth-                   supabase db pushlayout-header">
          <h1 className="auth-layout-title">{t('register.title')}</h1>
          <p className="auth-layout-subtitle">{t('register.subtitle')}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <Input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} onFocus={() => setFocusedField('fullName')} onBlur={() => setFocusedField(null)} placeholder={t('register.placeholders.fullName')} disabled={loading} icon={<FiUserCheck />} />
            {focusedField === 'fullName' && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', opacity: 0.7, margin: 'var(--space-2) 0 0 0', transition: 'opacity 0.3s ease' }}>
                {t('register.hints.fullName')}
              </p>
            )}
          </div>

          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('register.placeholders.email')} disabled={loading} icon={<FiMail />} />

          <div>
            <Input id="studentId" type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} onFocus={() => setFocusedField('studentId')} onBlur={() => setFocusedField(null)} placeholder={t('register.placeholders.studentId')} disabled={loading} icon={<FiUser />} />
            {focusedField === 'studentId' && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', opacity: 0.7, margin: 'var(--space-2) 0 0 0', transition: 'opacity 0.3s ease' }}>
                {t('register.hints.studentId')}
              </p>
            )}
          </div>

          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('register.placeholders.password')} disabled={loading} icon={<FiLock />} />

          <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('register.placeholders.confirmPassword')} disabled={loading} icon={<FiLock />} />

          <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? <Spinner size={16} /> : t('register.create_button')}
          </Button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 'var(--space-4) 0 0 0', fontFamily: "'El Messiri', 'Noto Naskh Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif" }}>
          {t('register.have_account')} <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 'var(--font-weight-semibold)' }}>{t('register.sign_in')}</Link>
        </p>
      </Card>
    </AuthLayout>
  )
}

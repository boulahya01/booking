import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { FiMail, FiLock, FiUser } from 'react-icons/fi'
import { loginWithEmail } from '../lib/auth'
import '../styles/Auth.css'
import { Input, Button, Card, Spinner } from '../ui'
import { AuthLayout } from '../components/AuthLayout'

export function Login() {
  const { t } = useTranslation()
  const [loginMode, setLoginMode] = useState<'email' | 'student-id'>('email')
  const [email, setEmail] = useState('')
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const validateForm = () => {
    if (!password) {
      setError(t('login.errors.password_required'))
      return false
    }
    if (loginMode === 'email') {
      if (!email) {
        setError(t('login.errors.email_required'))
        return false
      }
      if (!email.includes('@')) {
        setError(t('login.errors.invalid_email'))
        return false
      }
    } else {
      if (!studentId) {
        setError(t('login.errors.student_required'))
        return false
      }
    }
    return true
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!validateForm()) {
      setLoading(false)
      return
    }

    const { error: authError } = await loginWithEmail(email, password)

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  const handleStudentIdLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!validateForm()) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/login-by-student-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed')
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    if (loginMode === 'email') {
      handleEmailLogin(e)
    } else {
      handleStudentIdLogin(e)
    }
  }

  return (
    <AuthLayout>
      <Card>
        <div className="auth-layout-header">
          <h1 className="auth-layout-title">{t('login.welcome_back')}</h1>
          <p className="auth-layout-subtitle">{t('login.subtitle')}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="mode-toggle" style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Button variant={loginMode === 'email' ? 'primary' : 'ghost'} onClick={() => { setLoginMode('email'); setError(''); setStudentId('') }} disabled={loading} style={{ flex: 1 }}>
            {t('login.email')}
          </Button>
          <Button variant={loginMode === 'email' ? 'ghost' : 'primary'} onClick={() => { setLoginMode('student-id'); setError(''); setEmail('') }} disabled={loading} style={{ flex: 1 }}>
            {t('login.student_id')}
          </Button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {loginMode === 'email' ? (
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.email')} disabled={loading} icon={<FiMail />} />
          ) : (
            <Input id="studentId" type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder={t('login.student_id')} disabled={loading} icon={<FiUser />} />
          )}

          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('login.password')} disabled={loading} icon={<FiLock />} />

          <Link to="/forgot-password" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
            {t('login.forgot_password')}
          </Link>

          <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? <Spinner size={16} /> : t('login.sign_in')}
          </Button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 'var(--space-4) 0 0 0', fontFamily: "'El Messiri', 'Noto Naskh Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif" }}>
          {t('login.sign_up_prompt')} <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 'var(--font-weight-semibold)' }}>{t('login.sign_up')}</Link>
        </p>
      </Card>
    </AuthLayout>
  )
}

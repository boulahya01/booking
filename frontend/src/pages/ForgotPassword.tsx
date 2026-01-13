import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import '../styles/Auth.css'
import { Card } from '../ui'
import { AuthLayout } from '../components/AuthLayout'
import { SiWhatsapp } from 'react-icons/si'

export function ForgotPassword() {
  const { t } = useTranslation()

  return (
    <AuthLayout>
      <Card>
        <div className="auth-layout-header" style={{ textAlign: 'center' }}>
          <h1 className="auth-layout-title">{t('forgot_password.contact_admin_title', 'Password Reset — Contact Admin')}</h1>
          <p className="auth-layout-subtitle">{t('forgot_password.contact_admin_subtitle', 'To reset your password, please contact an administrator.')}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('forgot_password.contact_admin_instructions', 'Send a message via WhatsApp to the admin with your student ID and full name to request a password reset.')}
          </p>

          <a
            href="https://wa.me/212693094897"
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp-button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <SiWhatsapp size={18} />
            {t('forgot_password.contact_admin_whatsapp', 'Contact Admin on WhatsApp')}
          </a>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            {t('forgot_password.or_visit_admin', "Or visit the admin in person for assistance.")}
          </p>

          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', marginTop: '1rem' }}>
            {t('forgot_password.back_to_login', 'Back to Login')}
          </Link>
        </div>
      </Card>
    </AuthLayout>
  )
}

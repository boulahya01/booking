import { useNavigate } from 'react-router-dom'
import { signOut } from '../lib/auth'
import { SiWhatsapp } from 'react-icons/si'
import { MdCheckCircle } from 'react-icons/md'
import { MdPhone } from 'react-icons/md'
import '../styles/Auth.css'
import { useTranslation } from 'react-i18next'

export function PendingApproval() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="auth-container pending-page">
      <div className="pending-card">
        <img 
          src="/assests/transparent-hourglass-3d-icon-png-download-12211099.webp" 
          alt="Account pending approval" 
          className="pending-icon-overlay"
        />

        <h1 className="pending-title">{t('pending.title', 'Account Pending')}</h1>

        <div className="pending-content" dir="rtl" lang="ar">
          <p className="pending-instruction">
            سيتوجب عليك إرسال صورة من بطاقة الطالب عبر واتساب إلى الرقم:
          </p>

          <div className="phone-display">
            <MdPhone className="phone-icon" />
            <span className="phone-number" dir="ltr">06 93 094 897</span>
          </div>

          <a 
            href="https://wa.me/212693094897" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="whatsapp-button"
            aria-label="Send student card via WhatsApp"
          >
            <span>{t('pending.whatsapp', 'WhatsApp')}</span>
            <SiWhatsapp size={20} />
          </a>

          <p className="fallback-text">
            أو زيارة <strong>admin simo</strong> في (الحانوت) لإتمام تفعيل حسابك.
          </p>

          <ul className="checklist">
            <li>
              <MdCheckCircle size={20} />
              <span>{t('pending.student_card', 'بطاقة الطالب')}</span>
            </li>
          </ul>
        </div>

        <button 
          onClick={handleLogout} 
          className="btn-logout"
          aria-label="Sign out of your account"
        >
          {t('pending.sign_out', 'Sign Out')}
        </button>
      </div>
    </div>
  )
}

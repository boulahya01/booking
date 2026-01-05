import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/auth'
import { FiMenu, FiX, FiLogOut, FiHome, FiCalendar, FiUser, FiUsers, FiGrid } from 'react-icons/fi'
import { LanguageDropdown } from './LanguageDropdown'
import { useTranslation } from 'react-i18next'
import './MainLayout.css'

interface MainLayoutProps {
  children: React.ReactNode
}

interface MenuItem {
  label: string
  href: string
  icon: React.ComponentType<{ size: number }>
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { profile, isApproved } = useAuth()
  const { t, i18n } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/login'
  }

  const menuItems: MenuItem[] = [
    { label: t('layout.book_pitch'), href: '/', icon: FiHome },
    { label: t('layout.my_bookings'), href: '/bookings', icon: FiCalendar },
    { label: t('layout.profile'), href: '/profile', icon: FiUser },
    ...(profile?.role === 'admin'
      ? [
          { label: t('layout.admin_users'), href: '/admin/users', icon: FiUsers },
          { label: t('layout.admin_pitches'), href: '/admin/pitches', icon: FiGrid },
        ]
      : []),
  ]

  useEffect(() => {
    // ensure direction and lang attribute reflect current locale
    const lang = i18n.language || localStorage.getItem('locale') || 'ar'
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
      document.documentElement.dir = lang.startsWith('ar') ? 'rtl' : 'ltr'
    }
  }, [i18n.language])

  const toggleLanguage = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar'
    i18n.changeLanguage(next)
    localStorage.setItem('locale', next)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next
      document.documentElement.dir = next.startsWith('ar') ? 'rtl' : 'ltr'
    }
  }

  return (
    <div className="main-layout">
      {/* Header */}
      <header className="main-header">
        <div className="header-content">
          <div className="header-left">
            <button
              className="menu-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle navigation menu"
              title="Toggle Navigation Menu"
            >
              {menuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
            <h1 className="app-title">{t('layout.app_title')}</h1>
          </div>

          <div className="header-right">
            <LanguageDropdown />
            <div className="user-badge">
              <span className="user-name">{profile?.full_name || profile?.student_id}</span>
              {profile?.role === 'admin' && <span className="badge badge-admin">{t('layout.admin')}</span>}
              {isApproved && <span className="badge badge-approved">{t('layout.approved')}</span>}
            </div>
            <button
              className="logout-btn"
              onClick={handleLogout}
              title={t('layout.logout')}
              aria-label={t('layout.logout')}
            >
              <FiLogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="layout-container">
        {/* Sidebar Navigation */}
        <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <nav className="sidebar-nav">
            {menuItems.map((item) => {
              const IconComponent = item.icon
              return (
                <Link key={item.href} to={item.href} className="nav-item" onClick={() => setMenuOpen(false)}>
                  <IconComponent size={20} />
                  <span className="nav-label">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="sidebar-footer">
            <button className="logout-btn-mobile" onClick={handleLogout} aria-label="Logout">
              <FiLogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)}></div>}

        {/* Main Content */}
        <main className="main-content">{children}</main>
      </div>
    </div>
  )
}

export default MainLayout

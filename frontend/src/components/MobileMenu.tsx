import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import '../styles/MobileMenu.css'

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const { profile } = useAuth()
  const navigate = useNavigate()

  const handleNavigate = (path: string) => {
    navigate(path)
    setIsOpen(false)
  }

  const handleLogout = () => {
    window.location.href = '/logout'
  }

  return (
    <>
      {/* Hamburger Button */}
      <button
        className={`mobile-menu-toggle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsOpen(false)}></div>
      )}

      {/* Mobile Menu */}
      <div className={`mobile-menu ${isOpen ? 'open' : ''}`}>
        {/* Menu Header */}
        <div className="mobile-menu-header">
          <h2>Menu</h2>
          <button
            className="mobile-menu-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* User Info */}
        <div className="mobile-menu-user-info">
          <div className="user-avatar">
            {profile?.student_id?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="user-details">
            <p className="user-id">{profile?.student_id}</p>
            <p className="user-role">
              {profile?.role === 'admin' ? '👤 Admin' : '👤 Student'}
            </p>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="mobile-menu-items">
          {/* Bookings - Available to all authenticated users */}
          <button
            className="mobile-menu-item"
            onClick={() => handleNavigate('/bookings')}
          >
            <span className="menu-icon">📅</span>
            <span className="menu-label">Bookings</span>
          </button>

          {/* Admin Menu Items */}
          {profile?.role === 'admin' && (
            <>
              <div className="mobile-menu-divider">Admin</div>

              <button
                className="mobile-menu-item admin"
                onClick={() => handleNavigate('/admin/users')}
              >
                <span className="menu-icon">👥</span>
                <span className="menu-label">Manage Users</span>
              </button>

              <button
                className="mobile-menu-item admin"
                onClick={() => handleNavigate('/admin/pitches')}
              >
                <span className="menu-icon">⚽</span>
                <span className="menu-label">Manage Pitches</span>
              </button>
            </>
          )}

          {/* Divider */}
          <div className="mobile-menu-divider"></div>

          {/* Logout */}
          <button className="mobile-menu-item logout" onClick={handleLogout}>
            <span className="menu-icon">🚪</span>
            <span className="menu-label">Logout</span>
          </button>
        </nav>

        {/* Footer */}
        <div className="mobile-menu-footer">
          <p>Football Pitch Booking System</p>
        </div>
      </div>
    </>
  )
}

import React from 'react'
import './AuthLayout.css'

export const AuthLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div className="auth-layout">
      <div className="auth-layout-container">
        {children}
      </div>
    </div>
  )
}

export default AuthLayout

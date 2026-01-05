import React from 'react'
import './Loading.css'

export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => {
  return <div className={`ui-spinner ${className}`} style={{ width: size, height: size }} />
}

export const FullPageLoading: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Spinner size={36} />
        <div style={{ marginTop: 12 }}>{message}</div>
      </div>
    </div>
  )
}

export default Spinner

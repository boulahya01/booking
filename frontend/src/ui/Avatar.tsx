import React from 'react'
import './Avatar.css'

export const Avatar: React.FC<{ src?: string | null; name?: string; size?: number; className?: string }> = ({ src, name = '', size = 36, className = '' }) => {
  const initials = name.split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase()
  return (
    <div className={`ui-avatar ${className}`} style={{ width: size, height: size, fontSize: Math.round(size/2.5) }}>
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : <span className="ui-avatar-initials">{initials}</span>}
    </div>
  )
}

export default Avatar

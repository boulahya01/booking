import React from 'react'
import './Badge.css'

export type BadgeProps = {
  variant?: 'default' | 'success' | 'danger' | 'muted'
  children?: React.ReactNode
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '' }) => {
  const cls = `ui-badge ui-badge--${variant} ${className}`.trim()
  return <span className={cls}>{children}</span>
}

export default Badge

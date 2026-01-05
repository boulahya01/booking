import React from 'react'
import './Text.css'

export const Title: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h2 className={`ui-title ${className}`.trim()}>{children}</h2>
)

export const Subtitle: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h3 className={`ui-subtitle ${className}`.trim()}>{children}</h3>
)

export const Body: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`ui-body ${className}`.trim()}>{children}</p>
)

export default Title

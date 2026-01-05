import React from 'react'
import './Card.css'

export type CardProps = {
  children?: React.ReactNode
  className?: string
  as?: keyof JSX.IntrinsicElements
}

export const Card: React.FC<CardProps> = ({ children, className = '', as: Component = 'div' }) => {
  const cls = `ui-card ${className}`.trim()
  return (
    // @ts-ignore allow dynamic tag
    <Component className={cls}>{children}</Component>
  )
}

export default Card

import React from 'react'
import './Button.css'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, className = '', ...rest }) => {
  const cls = `ui-button ui-button--${variant} ${className}`.trim()
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}

export default Button

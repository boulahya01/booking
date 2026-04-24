import React from 'react'
import './Button.css'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', children, className = '', ...rest }, ref) => {
    const cls = `ui-button ui-button--${variant} ${className}`.trim()
    return (
      <button ref={ref} className={cls} {...rest}>
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button

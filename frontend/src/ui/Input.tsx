import React, { useState } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import './Input.css'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string | null
  icon?: React.ReactNode
}

export const Input: React.FC<InputProps> = ({ label, error = null, placeholder, className = '', icon, type, ...rest }) => {
  const [showPassword, setShowPassword] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  
  const isPasswordField = type === 'password'
  const displayType = isPasswordField && showPassword ? 'text' : type
  const displayPlaceholder = placeholder || label || ''
  
  return (
    <div className={`ui-input-wrapper ${className}`}>
      <div className={`ui-input-container ${isFocused ? 'focused' : ''}`}>
        {icon && <div className="ui-input-icon">{icon}</div>}
        <input 
          className={`ui-input ${icon ? 'with-icon' : ''} ${isPasswordField && isFocused ? 'with-toggle' : ''}`} 
          placeholder={displayPlaceholder}
          type={displayType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest} 
        />
        {isPasswordField && isFocused && (
          <button
            type="button"
            className="ui-input-password-toggle"
            onClick={(e) => {
              e.preventDefault()
              setShowPassword(!showPassword)
            }}
            onMouseDown={(e) => e.preventDefault()}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        )}
      </div>
      {error && <div className="ui-input-error">{error}</div>}
    </div>
  )
}

export default Input

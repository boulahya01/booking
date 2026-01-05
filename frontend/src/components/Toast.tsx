import React from 'react'
import { Toast as ToastType } from '../context/ToastContext'
import { FiX, FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi'
import './Toast.css'

interface ToastProps extends ToastType {
  onClose: () => void
}

export const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FiCheckCircle className="toast-icon" />
      case 'error':
        return <FiAlertCircle className="toast-icon" />
      case 'warning':
        return <FiAlertCircle className="toast-icon" />
      case 'info':
        return <FiInfo className="toast-icon" />
      default:
        return null
    }
  }

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-content">
        {getIcon()}
        <span className="toast-message">{message}</span>
      </div>
      <button className="toast-close" onClick={onClose} aria-label="Close notification">
        <FiX size={18} />
      </button>
    </div>
  )
}

import React, { useContext } from 'react'
import { ToastContext } from '../context/ToastContext'
import { Toast } from './Toast'
import './ToastContainer.css'

export const ToastContainer: React.FC = () => {
  const context = useContext(ToastContext)

  if (!context) {
    return null
  }

  return (
    <div className="toast-container">
      {context.toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => context.removeToast(toast.id)} />
      ))}
    </div>
  )
}

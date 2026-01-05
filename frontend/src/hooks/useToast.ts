import { useContext } from 'react'
import { ToastContext } from '../context/ToastContext'

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return {
    success: (message: string, duration?: number) => context.addToast(message, 'success', duration || 3000),
    error: (message: string, duration?: number) => context.addToast(message, 'error', duration || 5000),
    warning: (message: string, duration?: number) => context.addToast(message, 'warning', duration || 4000),
    info: (message: string, duration?: number) => context.addToast(message, 'info', duration || 4000),
    remove: (id: string) => context.removeToast(id),
  }
}

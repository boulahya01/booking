/**
 * Utility function to merge Tailwind CSS classes
 * Handles class name conflicts and removes duplicates
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Format time as HH:MM
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Format date as DD/MM/YYYY or localized
 */
export function formatDate(date: Date | string, locale = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Check if date is today
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return d < new Date()
}

/**
 * Get day name (Monday, Tuesday, etc.)
 */
export function getDayName(date: Date | string, locale = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(locale, { weekday: 'long' })
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) {
  let timeout: ReturnType<typeof setTimeout>

  return function (...args: Parameters<T>) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), delay)
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate public username: 3-24 lowercase letters, numbers, or underscores.
 */
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase())
}

/**
 * Validate student ID: 1 uppercase letter followed by 9 digits (e.g., S123456789)
 */
export function isValidStudentId(id: string): boolean {
  return /^[A-Z][0-9]{9}$/.test(id)
}

/**
 * change to min 8 chars, at least 1 number, and 1 special character
 */
export function isValidPassword(password: string): boolean {
  return /^(?=.*\d)(?=.*[!@#$%^&*()-+]).{8,}$/.test(password)
}

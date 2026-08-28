import DOMPurify from 'dompurify'
import { z } from 'zod'

type Purifier = {
  sanitize: (value: string, options: { ALLOWED_TAGS: string[]; ALLOWED_ATTR: string[] }) => string
}

function browserPurifier(): Purifier | null {
  if (typeof window === 'undefined') return null

  const candidate = DOMPurify as unknown as Purifier | ((hostWindow: Window) => Purifier)
  if (typeof (candidate as Purifier).sanitize === 'function') return candidate as Purifier
  if (typeof candidate === 'function') return candidate(window)
  return null
}

function plainTextFallback(value: string): string {
  // Server-rendered form values are escaped by Svelte and are sanitized again
  // in the browser before submission. Strip markup here so SSR validation has
  // the same plain-text intent without requiring a synthetic browser window.
  return value.replace(/<[^>]*>/g, '')
}

export const sanitizeInput = (s = ''): string => {
  const value = String(s || '')
  const purifier = browserPurifier()
  return (purifier
    ? purifier.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    : plainTextFallback(value)
  ).trim()
}

export const sanitizeName = (s = ''): string => sanitizeInput(s).replace(/\s+/g, ' ').slice(0, 100)

// Match the Postgres identity contract exactly: Student IDs are case-insensitive
// only through canonical uppercasing, and whitespace is ignored. Punctuation is
// deliberately NOT stripped so malformed values are shown as invalid instead of
// being silently rewritten into a different identifier.
export const sanitizeStudentId = (s = ''): string => String(s || '').replace(/\s+/g, '').toUpperCase().slice(0, 50)

export const sanitizeDescription = (s = ''): string => {
  const value = String(s || '')
  const purifier = browserPurifier()
  return purifier
    ? purifier.sanitize(value, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: [],
      })
    : plainTextFallback(value)
}

export const sanitizeBody = (obj: any): any => {
  if (obj == null) return obj
  if (typeof obj === 'string') return sanitizeInput(obj)
  if (Array.isArray(obj)) return obj.map(sanitizeBody)
  if (typeof obj === 'object') {
    const out: any = {}
    for (const k in obj) {
      out[k] = sanitizeBody(obj[k])
    }
    return out
  }
  return obj
}

export const LoginEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

export const LoginStudentSchema = z.object({
  student_id: z.string().min(3).max(50),
})

export const NameSchema = z.string().min(1).max(100)

export const validate = <T>(schema: z.ZodSchema<T>, data: unknown): T => schema.parse(data)

export const isValidUsmbaEmail = (email: string): boolean => {
  return /^[^\s@]+@usmba\.ac\.ma$/.test(email.trim().toLowerCase())
}

import DOMPurify from 'dompurify'
import { z } from 'zod'

export const sanitizeInput = (s = ''): string => {
  return DOMPurify.sanitize(String(s || ''), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim()
}

export const sanitizeName = (s = ''): string => sanitizeInput(s).replace(/\s+/g, ' ').slice(0, 100)

export const sanitizeStudentId = (s = ''): string => String(s || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 50)

export const sanitizeDescription = (s = ''): string => {
  return DOMPurify.sanitize(String(s || ''), {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  })
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

import type { ZodSchema } from 'zod'
import { sanitizeBody } from './validation'

const lastCall = new Map<string, number>()
const COOLDOWN_MS = 400

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split('=')[1]) : undefined
}

export async function apiFetch<T = any>(path: string, opts: RequestInit = {}, schema?: ZodSchema<T>): Promise<T> {
  if (typeof window !== 'undefined') {
    const last = lastCall.get(path) || 0
    if (Date.now() - last < COOLDOWN_MS) {
      throw new Error('Too many client requests; slow down')
    }
    lastCall.set(path, Date.now())
  }

  opts.credentials = opts.credentials || 'include'

  const headers = new Headers(opts.headers || {})
  if (!headers.has('Content-Type') && !(opts.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const csrf = getCookie('XSRF-TOKEN') || getCookie('X-CSRF-Token') || getCookie('csrf_token')
  if (csrf) headers.set('X-CSRF-Token', csrf)

  opts.headers = headers

  if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(sanitizeBody(opts.body))
  }

  const res = await fetch(path, opts)
  const text = await res.text()
  let data: any = text ? JSON.parse(text) : null

  if (!res.ok) {
    const errMsg = data?.error || `HTTP ${res.status}`
    throw new Error(errMsg)
  }

  if (schema) return schema.parse(data)
  return data
}

export function postJson<T = any>(path: string, body: unknown, schema?: ZodSchema<T>) {
  return apiFetch(path, { method: 'POST', body }, schema)
}

import type { ZodSchema } from 'zod'
import { sanitizeBody } from './validation'
import { supabaseClient } from './supabaseClient'
import { logger } from './logger'

const lastCall = new Map<string, number>()
const COOLDOWN_MS = 400
const MAX_CACHE_ENTRIES = 100

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

    // Prevent memory leak: evict oldest entries when cache grows too large
    if (lastCall.size > MAX_CACHE_ENTRIES) {
      const firstKey = lastCall.keys().next().value
      if (firstKey) lastCall.delete(firstKey)
    }
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
  let data: any = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch (parseErr) {
      logger.error('[apiFetch] Failed to parse response as JSON:', parseErr)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
      }
      throw new Error('Server returned invalid JSON response')
    }
  }

  if (!res.ok) {
    const errMsg = data?.error || `HTTP ${res.status}`
    throw new Error(errMsg)
  }

  if (schema) return schema.parse(data)
  return data
}

export function postJson<T = any>(path: string, body: unknown, schema?: ZodSchema<T>) {
  return apiFetch(path, { method: 'POST', body: body as BodyInit | null | undefined }, schema)
}

export async function fetchWithCSRF(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="csrf-token"]')
    const csrfToken = meta?.getAttribute('content')
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken)
  }

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    const errMsg = `HTTP error! status: ${response.status}`
    throw new Error(errMsg)
  }

  return response.json()
}

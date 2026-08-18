import { env } from '$env/dynamic/private'
import { json } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import type { RequestHandler } from './$types'

const GENERIC_ERROR = 'Support is temporarily unavailable. Please try again.'
const RATE_LIMIT_ERROR = 'You have sent several requests recently. Try again a little later.'
const MAX_REQUEST_BYTES = 32 * 1024

function clientIp(request: Request): string | null {
  const value = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return value || null
}

async function ipHash(ip: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(ip))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function safeString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

async function readJsonBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; status: 400 | 413 | 415 }> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.startsWith('application/json')) return { ok: false, status: 415 }

  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return { ok: false, status: 413 }
  if (!request.body) return { ok: false, status: 400 }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      size += value.byteLength
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel()
        return { ok: false, status: 413 }
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) }
  } catch {
    return { ok: false, status: 400 }
  }
}

function serverConfig() {
  const supabaseUrl = env.SUPABASE_URL?.trim()
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const ipHashSecret = env.SUPPORT_IP_HASH_SECRET?.trim()
  if (!supabaseUrl || !serviceRoleKey || !ipHashSecret || ipHashSecret.length < 32) return null
  return { supabaseUrl, serviceRoleKey, ipHashSecret }
}

export const POST: RequestHandler = async ({ request }) => {
  const parsed = await readJsonBody(request)
  if (!parsed.ok) {
    if (parsed.status === 413) return json({ error: 'Request is too large.' }, { status: 413 })
    if (parsed.status === 415) return json({ error: 'Send this request as JSON.' }, { status: 415 })
    return json({ error: GENERIC_ERROR }, { status: 400 })
  }

  const config = serverConfig()
  const ip = clientIp(request)
  if (!config || !ip) return json({ error: GENERIC_ERROR }, { status: 503 })

  const payload: any = parsed.value
  const contactEmail = safeString(payload?.contactEmail, 254).toLowerCase()
  const subject = safeString(payload?.subject, 120)
  const body = safeString(payload?.body, 4000)
  if (!body) return json({ error: 'Write a short message before sending.' }, { status: 400 })

  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })

  const { data, error } = await supabase.rpc('create_guest_support_thread_server', {
    p_contact_email: contactEmail,
    p_subject: subject,
    p_body: body,
    p_ip_hash: await ipHash(ip, config.ipHashSecret)
  })

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('support_rate_limited') || message.includes('support_temporarily_busy')) return json({ error: RATE_LIMIT_ERROR }, { status: 429 })
    if (message.includes('invalid_contact_email')) return json({ error: 'Check the contact email and try again.' }, { status: 400 })
    if (message.includes('invalid_support_message')) return json({ error: 'Write a short message before sending.' }, { status: 400 })
    return json({ error: GENERIC_ERROR }, { status: 503 })
  }

  const row: any = Array.isArray(data) ? data[0] : data
  if (!row?.thread_id || !row?.access_token) return json({ error: GENERIC_ERROR }, { status: 503 })

  return json({ threadId: row.thread_id, accessToken: row.access_token }, {
    status: 201,
    headers: { 'cache-control': 'no-store' }
  })
}

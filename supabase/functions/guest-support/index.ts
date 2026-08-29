import { createClient } from 'npm:@supabase/supabase-js@2'

const MAX_REQUEST_BYTES = 32 * 1024
const GENERIC_ERROR = 'Support is temporarily unavailable. Please try again.'
const RATE_LIMIT_ERROR = 'You have sent several requests recently. Try again a little later.'
const PRODUCTION_ORIGINS = new Set(['https://www.uneem.site', 'https://uneem.site'])
const FALLBACK_ORIGIN = 'https://www.uneem.site'

function isAllowedOrigin(origin: string | null) {
  return (
    !origin ||
    PRODUCTION_ORIGINS.has(origin) ||
    origin === 'https://uneem.vercel.app' ||
    origin === 'http://localhost:5173' ||
    origin === 'http://127.0.0.1:5173' ||
    /^https:\/\/uneem(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)
  )
}

function corsHeaders(origin: string | null) {
  return {
    'access-control-allow-origin': origin && isAllowedOrigin(origin) ? origin : FALLBACK_ORIGIN,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-max-age': '86400',
    vary: 'Origin'
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  })
}

function safeString(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function clientIp(req: Request) {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ''
  )
}

async function hmacSha256(value: string, secret: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (!isAllowedOrigin(origin)) return json({ error: 'Forbidden.' }, 403, origin)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin)

  const contentType = req.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.startsWith('application/json')) return json({ error: 'Send this request as JSON.' }, 415, origin)

  const declaredLength = Number(req.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return json({ error: 'Request is too large.' }, 413, origin)
  }

  let bytes: ArrayBuffer
  try {
    bytes = await req.arrayBuffer()
  } catch {
    return json({ error: GENERIC_ERROR }, 400, origin)
  }
  if (bytes.byteLength > MAX_REQUEST_BYTES) return json({ error: 'Request is too large.' }, 413, origin)

  let payload: any
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return json({ error: GENERIC_ERROR }, 400, origin)
  }

  const contactEmail = safeString(payload?.contactEmail, 254).toLowerCase()
  const subject = safeString(payload?.subject, 120)
  const body = safeString(payload?.body, 4000)
  if (!body) return json({ error: 'Write a short message before sending.' }, 400, origin)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || ''
  const ip = clientIp(req)
  if (!supabaseUrl || !serviceRoleKey || !ip) return json({ error: GENERIC_ERROR }, 503, origin)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { data, error } = await supabase.rpc('create_guest_support_thread_server', {
    p_contact_email: contactEmail,
    p_subject: subject,
    p_body: body,
    p_ip_hash: await hmacSha256(ip, serviceRoleKey)
  })

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('support_rate_limited') || message.includes('support_temporarily_busy')) {
      return json({ error: RATE_LIMIT_ERROR }, 429, origin)
    }
    if (message.includes('invalid_contact_email')) return json({ error: 'Check the contact email and try again.' }, 400, origin)
    if (message.includes('invalid_support_message')) return json({ error: 'Write a short message before sending.' }, 400, origin)
    console.error('guest-support RPC failed', { code: error.code })
    return json({ error: GENERIC_ERROR }, 503, origin)
  }

  const row: any = Array.isArray(data) ? data[0] : data
  if (!row?.thread_id || !row?.access_token) return json({ error: GENERIC_ERROR }, 503, origin)

  return json({ threadId: row.thread_id, accessToken: row.access_token }, 201, origin)
})

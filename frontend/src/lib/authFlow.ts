import type { AuthError, EmailOtpType, Session } from '@supabase/supabase-js'
import { replaceState } from '$app/navigation'
import { supabase } from './supabaseClient'

export {
  passwordRecoveryActive,
  markPasswordRecovery,
  clearPasswordRecovery,
  restorePasswordRecovery
} from './authRecovery'

export type AuthFlowKind = 'email' | 'recovery'

export type AuthFlowResult = {
  handled: boolean
  session: Session | null
  error: AuthError | Error | null
}

function readFragmentParams(url: URL) {
  return new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
}

export function getAuthFlowError(url: URL): string | null {
  const hash = readFragmentParams(url)
  return (
    url.searchParams.get('error_description') ||
    url.searchParams.get('error') ||
    hash.get('error_description') ||
    hash.get('error') ||
    null
  )
}

// URL evidence is useful only for deciding which callback UX to show. It is
// never password-reset authority; the reset mutation verifies signed claims.
export function hasRecoveryEvidence(url: URL): boolean {
  const hash = readFragmentParams(url)
  return (
    url.searchParams.get('type') === 'recovery' ||
    hash.get('type') === 'recovery' ||
    url.searchParams.has('token_hash') ||
    url.searchParams.has('code') ||
    hash.has('access_token')
  )
}

export async function completeAuthFlow(url: URL, expected: AuthFlowKind): Promise<AuthFlowResult> {
  const urlError = getAuthFlowError(url)
  if (urlError) return { handled: true, session: null, error: new Error(urlError) }

  const tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token')
  const suppliedType = url.searchParams.get('type')

  if (tokenHash) {
    const otpType = expected === 'email' && suppliedType === 'email_change' ? 'email_change' : expected
    if (suppliedType && suppliedType !== otpType) {
      return { handled: true, session: null, error: new Error('unexpected_auth_flow') }
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType
    })
    return { handled: true, session: data.session ?? null, error }
  }

  const code = url.searchParams.get('code')
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    return { handled: true, session: data.session ?? null, error }
  }

  const hash = readFragmentParams(url)
  const hashHasSession = hash.has('access_token') || hash.has('refresh_token')
  if (hashHasSession) {
    const { data, error } = await supabase.auth.getSession()
    return { handled: true, session: data.session ?? null, error }
  }

  const { data, error } = await supabase.auth.getSession()
  return { handled: false, session: data.session ?? null, error }
}

export function clearAuthFlowUrl(url: URL) {
  const clean = new URL(url)
  for (const key of ['token_hash', 'token', 'type', 'code', 'error', 'error_code', 'error_description']) {
    clean.searchParams.delete(key)
  }
  clean.hash = ''
  if (typeof window !== 'undefined') {
    replaceState(clean.pathname + clean.search, {})
  }
}

export function getAuthOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  const configured = String(import.meta.env.VITE_APP_URL || '').trim()
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // Fall through to the local development origin.
    }
  }

  return 'http://localhost:5173'
}

function absoluteAuthUrl(pathname: string): URL {
  return new URL(pathname, `${getAuthOrigin()}/`)
}

// Keep the provider redirect itself exact. The current signup tab preserves its
// non-sensitive email hint in local navigation; provider redirects should not
// need an unbounded query-string allow-list entry.
export function emailConfirmationRedirectUrl(_email?: string): string {
  return absoluteAuthUrl('/verify-email').toString()
}

export function passwordRecoveryRedirectUrl(): string {
  return absoluteAuthUrl('/reset-password').toString()
}

// This marker is UX state only. It lets the shell keep a genuine recovery flow
// on the reset route, but it is never sufficient authority to change a password.
// Password mutation additionally verifies the signed Supabase JWT `amr` claim.
// Security authority for password recovery. Supabase verifies the JWT before
// returning claims; only a signed session whose authentication-method reference
// contains `recovery` is accepted. Client storage and URL markers are not trusted.
export async function hasVerifiedRecoveryAuthentication(expectedUserId?: string | null): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims) return false

    const claims = data.claims as Record<string, any>
    if (expectedUserId && claims.sub !== expectedUserId) return false

    const methods = Array.isArray(claims.amr) ? claims.amr : []
    return methods.some((entry: any) => entry?.method === 'recovery')
  } catch {
    return false
  }
}

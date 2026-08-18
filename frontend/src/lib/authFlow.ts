import type { AuthError, EmailOtpType, Session } from '@supabase/supabase-js'
import { writable } from 'svelte/store'
import { supabase } from './supabaseClient'

const RECOVERY_STORAGE_KEY = 'uneem:password-recovery'

export type AuthFlowKind = 'email' | 'recovery'

export type AuthFlowResult = {
  handled: boolean
  session: Session | null
  error: AuthError | Error | null
}

type RecoveryGrant = {
  userId: string
  expiresAt: number
}

export const passwordRecoveryActive = writable(false)

function getBrowserStorage(): Storage | null {
  return typeof window !== 'undefined' ? window.sessionStorage : null
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
    if (suppliedType && suppliedType !== expected) {
      return { handled: true, session: null, error: new Error('unexpected_auth_flow') }
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: expected as EmailOtpType
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
    window.history.replaceState({}, document.title, clean.pathname + clean.search)
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

export function emailConfirmationRedirectUrl(email?: string): string {
  const url = absoluteAuthUrl('/verify-email')
  const normalized = email?.trim().toLowerCase()
  if (normalized) url.searchParams.set('email', normalized)
  return url.toString()
}

export function passwordRecoveryRedirectUrl(): string {
  return absoluteAuthUrl('/reset-password').toString()
}

// This marker is UX state only. It lets the shell keep a genuine recovery flow
// on the reset route, but it is never sufficient authority to change a password.
// Password mutation additionally verifies the signed Supabase JWT `amr` claim.
export function markPasswordRecovery(session: Session): void {
  const storage = getBrowserStorage()
  if (!storage || !session.user?.id) return

  const grant: RecoveryGrant = {
    userId: session.user.id,
    expiresAt: (session.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000
  }

  storage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(grant))
  passwordRecoveryActive.set(true)
}

export function clearPasswordRecovery(): void {
  getBrowserStorage()?.removeItem(RECOVERY_STORAGE_KEY)
  passwordRecoveryActive.set(false)
}

export function restorePasswordRecovery(userId?: string | null): boolean {
  const storage = getBrowserStorage()
  if (!storage) {
    passwordRecoveryActive.set(false)
    return false
  }

  const raw = storage.getItem(RECOVERY_STORAGE_KEY)
  if (!raw) {
    passwordRecoveryActive.set(false)
    return false
  }

  try {
    const grant = JSON.parse(raw) as RecoveryGrant
    const invalid =
      !grant?.userId ||
      !Number.isFinite(grant.expiresAt) ||
      grant.expiresAt <= Date.now() ||
      (!!userId && grant.userId !== userId)

    if (invalid) {
      clearPasswordRecovery()
      return false
    }

    passwordRecoveryActive.set(true)
    return true
  } catch {
    clearPasswordRecovery()
    return false
  }
}

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

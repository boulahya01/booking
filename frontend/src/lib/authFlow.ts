import type { AuthError, EmailOtpType, Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

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
  window.history.replaceState({}, document.title, clean.pathname + clean.search)
}

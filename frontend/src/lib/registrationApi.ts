import type { AuthError } from '@supabase/supabase-js'
import { emailConfirmationRedirectUrl } from './authFlow'
import { supabase } from './supabaseClient'
import { classifyAuthFailure, type AuthFailureKind } from './ux/authFailure'

export type RegistrationFailure = {
  kind: AuthFailureKind
  message: string
  status?: number
  code?: string
}

export type RegistrationResult = {
  data?: any
  error?: RegistrationFailure
}

function fromAuthError(error: AuthError): RegistrationFailure {
  return {
    kind: classifyAuthFailure(error.message, error.status, error.code),
    message: error.message,
    status: error.status,
    code: error.code
  }
}

async function usernameAvailable(username: string): Promise<{ available: boolean; error?: RegistrationFailure }> {
  const { data, error } = await supabase.rpc('registration_username_available', {
    p_username: username
  })

  if (error) {
    return {
      available: false,
      error: {
        kind: classifyAuthFailure(error.message, undefined, error.code),
        message: error.message,
        code: error.code
      }
    }
  }

  return { available: data === true }
}

export async function registerAccount(input: {
  email: string
  password: string
  studentId: string | null
  fullName: string
  username: string
}): Promise<RegistrationResult> {
  const email = input.email.trim().toLowerCase()
  const username = input.username.trim().toLowerCase()
  const studentId = input.studentId?.replace(/\s+/g, '').toUpperCase() || undefined

  try {
    const preflight = await usernameAvailable(username)
    if (preflight.error) {
      return {
        error: {
          ...preflight.error,
          kind: preflight.error.kind === 'unknown' ? 'service_unavailable' : preflight.error.kind
        }
      }
    }
    if (!preflight.available) {
      return { error: { kind: 'username_taken', message: 'username_taken' } }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        emailRedirectTo: emailConfirmationRedirectUrl(email),
        data: {
          full_name: input.fullName,
          username,
          ...(studentId ? { student_id: studentId } : {})
        }
      }
    })

    if (error) {
      const failure = fromAuthError(error)

      // A concurrent username claim can still race the availability preflight.
      // Recheck after a DB-side signup failure so the user gets a precise action.
      if (failure.kind === 'service_unavailable' || failure.kind === 'unknown') {
        const recheck = await usernameAvailable(username)
        if (!recheck.error && !recheck.available) {
          return { error: { kind: 'username_taken', message: 'username_taken' } }
        }
      }

      return { error: failure }
    }

    // With email confirmation enabled Supabase deliberately returns an
    // obfuscated user for repeat signups. An empty identities array is the
    // supported client signal that this address already has an Auth identity.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: { kind: 'account_exists', message: 'account_exists' } }
    }

    return { data }
  } catch (error: any) {
    return {
      error: {
        kind: classifyAuthFailure(error?.message, error?.status, error?.code),
        message: error?.message || 'registration_failed',
        status: error?.status,
        code: error?.code
      }
    }
  }
}

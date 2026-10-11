import { supabase } from './supabaseClient'
import type { AccountState } from './types'
import { logger } from './logger'
import { getMySessionContext } from './sessionApi'
import { cachedRequest, invalidateRequestCache } from './requestCache'
import { classifyBootstrapError, type BootstrapError } from './accountResolver'
import { withLoading } from './stores/loading'
import {
  clearPasswordRecovery,
  hasVerifiedRecoveryAuthentication,
  passwordRecoveryRedirectUrl,
  restorePasswordRecovery
} from './authFlow'

export interface AuthResponse {
  data?: any
  error?: { message: string }
}

export async function getMyAccountState(force = false): Promise<AccountState | null> {
  return cachedRequest('account-state', 2_000, async () => {
    const { data, error } = await supabase.rpc('get_my_account_state')
    if (error) {
      logger.error('[getMyAccountState] Error:', error.message)
      throw new Error(error.message || 'Error resolving account state')
    }

    const state = Array.isArray(data) ? data[0] : data
    return (state as AccountState | undefined) || null
  }, force)
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResponse> {
  try {
    clearPasswordRecovery()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })

    if (signInError) return { error: { message: signInError.message } }
    if (!data.user) return { error: { message: 'Login failed' } }

    let context
    try {
      context = await getMySessionContext()
    } catch (contextError: any) {
      logger.error('[loginWithEmail] Signed in but account context could not be restored:', contextError?.message || contextError)
      const bootstrapError: Exclude<BootstrapError, null> = classifyBootstrapError(contextError)
      return { data: { user: data.user, bootstrapError } }
    }

    if (!context) {
      return { data: { user: data.user, bootstrapError: 'profile_not_found' as const } }
    }

    return {
      data: {
        user: data.user,
        profile: context.profile,
        accountState: context.account
      }
    }
  } catch (err: any) {
    return { error: { message: err.message || 'Login failed' } }
  }
}

export async function signOut(): Promise<{ error?: any }> {
  return withLoading('action', async () => {
    clearPasswordRecovery()
    invalidateRequestCache()

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('selectedPitchId')
    }
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    return { error }
  })
}

export async function resetPasswordForEmail(email: string): Promise<AuthResponse> {
  return withLoading('action', async () => {
    try {
      clearPasswordRecovery()
      const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: passwordRecoveryRedirectUrl()
      })

      if (error) return { error: { message: error.message } }
      return { data }
    } catch (err: any) {
      return { error: { message: err.message || 'Failed to send reset email' } }
    }
  })
}

// Supabase verifies `current_password` as part of the same credential mutation.
// This keeps an open browser session alone insufficient for changing a password
// without creating a second sign-in request or a duplicate SIGNED_IN event.
export async function updatePassword(newPassword: string, currentPassword?: string): Promise<AuthResponse> {
  return withLoading('action', async () => {
    try {
      if (currentPassword) {
        const { data, error } = await supabase.auth.updateUser({
          password: newPassword,
          current_password: currentPassword
        })
        if (error) {
          const lower = error.message.toLowerCase()
          if (
            lower.includes('current password') ||
            lower.includes('current_password') ||
            lower.includes('invalid password') ||
            lower.includes('password is incorrect')
          ) {
            return { error: { message: 'current_password_invalid' } }
          }
          return { error: { message: error.message } }
        }

        const { error: revokeError } = await supabase.auth.signOut({ scope: 'others' })
        if (revokeError) logger.warn('[updatePassword] Password changed but other-session revocation failed:', revokeError.message)
        return { data }
      }

      const { data, error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) return { error: { message: error.message } }
      return { data }
    } catch (err: any) {
      return { error: { message: err.message || 'Failed to update password' } }
    }
  })
}

export async function updatePasswordFromRecovery(newPassword: string): Promise<AuthResponse> {
  return withLoading('action', async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user || !restorePasswordRecovery(user.id)) {
        clearPasswordRecovery()
        return { error: { message: 'recovery_session_required' } }
      }

      // sessionStorage is only continuity metadata. The actual mutation authority
      // must still come from a Supabase-verified JWT that carries the recovery AMR.
      if (!(await hasVerifiedRecoveryAuthentication(user.id))) {
        clearPasswordRecovery()
        return { error: { message: 'recovery_session_required' } }
      }

      const { data, error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) return { error: { message: error.message } }

      clearPasswordRecovery()
      const { error: globalSignOutError } = await supabase.auth.signOut()
      if (globalSignOutError) {
        logger.warn('[updatePasswordFromRecovery] Password changed but global session revocation failed:', globalSignOutError.message)
        const { error: localSignOutError } = await supabase.auth.signOut({ scope: 'local' })
        if (localSignOutError) {
          logger.warn('[updatePasswordFromRecovery] Local recovery session cleanup also failed:', localSignOutError.message)
        }
      }

      return { data }
    } catch (err: any) {
      return { error: { message: err.message || 'Failed to update password' } }
    }
  })
}

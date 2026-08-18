import { supabase } from './supabaseClient'
import { USE_MOCK, mockProfile, mockDelay } from './mock'
import type { AccountState, Profile } from './types'
import { logger } from './logger'
import { getMySessionContext } from './sessionApi'
import {
  clearPasswordRecovery,
  emailConfirmationRedirectUrl,
  passwordRecoveryRedirectUrl,
  restorePasswordRecovery
} from './authFlow'
import { get } from 'svelte/store'
import { locale } from 'svelte-i18n'
import en from '../locales/en.json'
import ar from '../locales/ar.json'

const PROFILE_AUTH_FIELDS = 'id,student_id,full_name,username,role,status,email_kind,identity_status,restriction_reason,verified_student_id_at,created_at,updated_at'

function t(key: string): string {
  const currentLocale = get(locale) || 'en'
  const dict = currentLocale === 'ar' ? ar : en
  const parts = key.split('.')
  let obj: any = dict
  for (const part of parts) {
    if (obj && typeof obj === 'object') obj = obj[part]
  }
  return typeof obj === 'string' ? obj : key
}

export interface AuthResponse {
  data?: any
  error?: { message: string }
}

export function isAcademicEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@usmba.ac.ma')
}

export async function register(
  email: string,
  password: string,
  studentId: string | null,
  fullName: string,
  username: string
): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay()
    const profile = {
      ...mockProfile,
      email,
      student_id: studentId?.toUpperCase() || null,
      full_name: fullName,
      username: username.toLowerCase(),
      email_kind: isAcademicEmail(email) ? 'academic' : 'personal',
      identity_status: 'required'
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mock_auth_user', JSON.stringify(profile))
    }
    return { data: { user: { id: profile.id, email: profile.email }, profile } }
  }

  try {
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedStudentId = studentId?.replace(/\s+/g, '').toUpperCase() || undefined
    const normalizedUsername = username.trim().toLowerCase()
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: emailConfirmationRedirectUrl(normalizedEmail),
        data: {
          full_name: fullName,
          username: normalizedUsername,
          ...(normalizedStudentId ? { student_id: normalizedStudentId } : {})
        }
      }
    })

    if (error) {
      return { data, error: { message: mapAuthError(error.message, error.status) } }
    }

    return { data, error: undefined }
  } catch (err: any) {
    return { error: { message: mapAuthError(err?.message || '', err?.status) } }
  }
}

export function mapAuthError(message: string, status?: number): string {
  if (!message) return t('register.error_registration_failed')

  const lower = message.toLowerCase()

  if (
    lower.includes('user already registered') ||
    lower.includes('already been registered') ||
    lower.includes('identity_claim_unavailable') ||
    lower.includes('registration_conflict') ||
    lower.includes('profiles_student_id') ||
    lower.includes('profiles_username') ||
    (lower.includes('duplicate') && (lower.includes('email') || lower.includes('student') || lower.includes('username'))) ||
    (lower.includes('unique') && (lower.includes('student') || lower.includes('username'))) ||
    lower.includes('23505') ||
    lower.includes('unique_violation')
  ) {
    return t('register.error_registration_failed')
  }

  if (lower.includes('invalid_student_id')) {
    return t('register.error_invalid_student')
  }

  if (lower.includes('student_id_required_for_personal_email')) {
    return t('register.error_invalid_student')
  }

  if (lower.includes('invalid_username')) {
    return t('register.error_registration_failed')
  }

  if (
    lower.includes('password') && (
      lower.includes('should be') ||
      lower.includes('too short') ||
      lower.includes('weak') ||
      lower.includes('length')
    )
  ) {
    return t('register.error_password_short')
  }

  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('security purposes') ||
    lower.includes('for security') ||
    status === 429
  ) {
    return t('verify_email.resend_error_rate_limit')
  }

  if (
    lower.includes('fetcherror') ||
    lower.includes('network') ||
    lower.includes('connection') ||
    lower.includes('failed to fetch') ||
    lower.includes('500') ||
    lower.includes('internal server error') ||
    lower.includes('database error') ||
    status === 500
  ) {
    return t('register.error_support_contact')
  }

  return t('register.error_registration_failed')
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  if (USE_MOCK) {
    await mockDelay()
    return mockProfile as Profile
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_AUTH_FIELDS)
    .eq('id', userId)
    .single()

  if (error) {
    logger.error('[getUserProfile] Error:', error.message)
    throw new Error(error.message || 'Error fetching profile')
  }

  return data as Profile | null
}

export async function getMyAccountState(): Promise<AccountState | null> {
  if (USE_MOCK) {
    await mockDelay()
    const profile = mockProfile as Profile
    return {
      user_id: profile.id,
      role: profile.role,
      access_status: profile.status,
      email_kind: profile.email_kind || 'academic',
      identity_status: profile.identity_status || 'required',
      student_id: profile.student_id || null,
      restriction_reason: profile.restriction_reason || null,
      can_use_sports: profile.status === 'approved',
      needs_identity_action: (profile.identity_status || 'required') === 'required'
    }
  }

  const { data, error } = await supabase.rpc('get_my_account_state')
  if (error) {
    logger.error('[getMyAccountState] Error:', error.message)
    throw new Error(error.message || 'Error resolving account state')
  }

  const state = Array.isArray(data) ? data[0] : data
  return (state as AccountState | undefined) || null
}

export async function submitIdentityVerification(studentId: string, cardStoragePath: string): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay()
    return { data: { status: 'pending' } }
  }

  const { data, error } = await supabase.rpc('submit_identity_verification', {
    p_student_id: studentId.replace(/\s+/g, '').toUpperCase(),
    p_card_storage_path: cardStoragePath
  })

  if (error) {
    const lower = error.message.toLowerCase()
    if (lower.includes('identity_claim_unavailable')) {
      return { error: { message: t('register.error_registration_failed') } }
    }
    if (lower.includes('invalid_student_id')) {
      return { error: { message: t('register.error_invalid_student') } }
    }
    return { error: { message: t('register.error_support_contact') } }
  }

  return { data }
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay()
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mock_auth_user', JSON.stringify(mockProfile))
    }
    return { data: { user: { id: mockProfile.id, email: mockProfile.email }, profile: mockProfile } }
  }

  try {
    clearPasswordRecovery()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })

    if (signInError) return { error: { message: signInError.message } }
    if (!data.user) return { error: { message: 'Login failed' } }

    const context = await getMySessionContext()
    if (!context) {
      await supabase.auth.signOut({ scope: 'local' })
      return { error: { message: 'Unable to restore account' } }
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
  clearPasswordRecovery()

  if (USE_MOCK) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mock_auth_user')
      localStorage.removeItem('selectedPitchId')
    }
    return {}
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('selectedPitchId')
  }
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  return { error }
}

export async function resetPasswordForEmail(email: string): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay()
    return { data: {} }
  }

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
}

// In-app password changes require the current credential as well as an existing
// session. This avoids treating possession of an open browser session alone as
// sufficient proof for a high-impact credential mutation.
export async function updatePassword(newPassword: string, currentPassword?: string): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay()
    return { data: {} }
  }

  try {
    if (currentPassword) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user?.email) {
        return { error: { message: 'current_password_required' } }
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      })
      if (verifyError) {
        return { error: { message: 'current_password_invalid' } }
      }

      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword
      })
      if (error) return { error: { message: error.message } }

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
}

export async function updatePasswordFromRecovery(newPassword: string): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay()
    clearPasswordRecovery()
    return { data: {} }
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user || !restorePasswordRecovery(user.id)) {
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
}

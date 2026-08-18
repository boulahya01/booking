import { supabase } from './supabaseClient'
import { USE_MOCK, mockProfile, mockDelay } from './mock'
import type { AccountState, Profile } from './types'
import { logger } from './logger'
import { getMySessionContext } from './sessionApi'
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

function getAppUrl(): string {
  const configured = (import.meta.env.VITE_APP_URL || '').trim().replace(/\/$/, '')
  if (configured) return configured
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:5173'
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
        emailRedirectTo: `${getAppUrl()}/verify-email?email=${encodeURIComponent(normalizedEmail)}`,
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

  if (lower.includes('invalid_student_id') || lower.includes('student_id_required_for_personal_email')) {
    return t('register.error_invalid_student')
  }

  if (lower.includes('invalid_username')) return t('register.error_registration_failed')

  if (
    lower.includes('password') &&
    (lower.includes('should be') || lower.includes('too short') || lower.includes('weak') || lower.includes('length'))
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

export function mapLoginAuthError(message: string, status?: number): string {
  const lower = (message || '').toLowerCase()
  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('security purposes') ||
    status === 429
  ) return 'rate_limited'

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid credentials') ||
    lower.includes('email not confirmed') ||
    lower.includes('user not found') ||
    status === 400
  ) return 'invalid_credentials'

  return 'auth_unavailable'
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
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })

    if (signInError) {
      return { error: { message: mapLoginAuthError(signInError.message, signInError.status) } }
    }
    if (!data.user) return { error: { message: 'auth_unavailable' } }

    const context = await getMySessionContext()
    if (!context) {
      await supabase.auth.signOut({ scope: 'local' })
      return { error: { message: 'auth_unavailable' } }
    }

    return {
      data: {
        user: data.user,
        profile: context.profile,
        accountState: context.account
      }
    }
  } catch {
    return { error: { message: 'auth_unavailable' } }
  }
}

export async function signOut(): Promise<{ error?: any }> {
  if (USE_MOCK) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mock_auth_user')
      localStorage.removeItem('selectedPitchId')
    }
    return {}
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('selectedPitchId')
    sessionStorage.removeItem('uneem_password_recovery')
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
    const normalizedEmail = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${getAppUrl()}/reset-password`
    })

    if (error) {
      const lower = error.message.toLowerCase()
      if (lower.includes('rate') || lower.includes('too many') || error.status === 429) {
        return { error: { message: 'rate_limited' } }
      }
      if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection')) {
        return { error: { message: 'network_error' } }
      }
      return { data: {} }
    }
    return { data }
  } catch {
    return { error: { message: 'network_error' } }
  }
}

export async function updatePassword(newPassword: string): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay()
    return { data: {} }
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData.session) {
      return { error: { message: 'recovery_session_required' } }
    }

    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: { message: 'password_update_failed' } }
    return { data }
  } catch {
    return { error: { message: 'password_update_failed' } }
  }
}

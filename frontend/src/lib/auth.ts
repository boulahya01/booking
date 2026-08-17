import { supabase } from './supabaseClient'
import { USE_MOCK, mockProfile, mockDelay } from './mock'
import type { Profile } from './types'
import { logger } from './logger'
import { get } from 'svelte/store'
import { locale } from 'svelte-i18n'
import en from '../locales/en.json'
import ar from '../locales/ar.json'

const PROFILE_AUTH_FIELDS = 'id,student_id,full_name,role,status,created_at,updated_at'

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

export async function register(
  email: string,
  password: string,
  studentId: string,
  fullName: string
): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay()
    const profile = { ...mockProfile, email, student_id: studentId.toUpperCase(), full_name: fullName }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mock_auth_user', JSON.stringify(profile))
    }
    return { data: { user: { id: profile.id, email: profile.email }, profile } }
  }

  try {
    const normalizedStudentId = studentId.replace(/\s+/g, '').toUpperCase()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { student_id: normalizedStudentId, full_name: fullName }
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
    (lower.includes('duplicate') && lower.includes('email')) ||
    (lower.includes('email') && lower.includes('already')) ||
    lower.includes('already been registered')
  ) {
    return t('register.error_email_exists')
  }

  if (
    lower.includes('student id is already registered') ||
    lower.includes('student_id is already registered') ||
    lower.includes('profiles_student_id_key') ||
    lower.includes('invalid_student_id') ||
    (lower.includes('duplicate') && lower.includes('student')) ||
    (lower.includes('unique') && lower.includes('student')) ||
    (lower.includes('duplicate key') && lower.includes('student_id')) ||
    lower.includes('this student id is already')
  ) {
    return lower.includes('invalid_student_id')
      ? t('register.error_invalid_student')
      : t('register.error_student_id_exists')
  }

  if (
    lower.includes('email_domain_not_allowed') ||
    lower.includes('usmba') ||
    lower.includes('university email') ||
    lower.includes('domain not allowed')
  ) {
    return t('register.error_invalid_email_domain')
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
    lower.includes('failed to fetch')
  ) {
    return t('register.error_support_contact')
  }

  if (
    lower.includes('500') ||
    lower.includes('internal server error') ||
    lower.includes('database error') ||
    status === 500
  ) {
    return t('register.error_support_contact')
  }

  if (lower.includes('23505') || lower.includes('unique_violation')) {
    return t('register.error_student_id_exists')
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
      email,
      password
    })

    if (signInError) return { error: { message: signInError.message } }
    if (!data.user) return { error: { message: 'Login failed' } }

    const profile = await getUserProfile(data.user.id)
    if (!profile) {
      await supabase.auth.signOut()
      return { error: { message: 'Profile not found' } }
    }

    return { data: { user: data.user, profile } }
  } catch (err: any) {
    return { error: { message: err.message || 'Login failed' } }
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
  }
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function resetPasswordForEmail(email: string): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay()
    return { data: {} }
  }

  try {
    const appUrl =
      import.meta.env.VITE_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
    const redirectUrl = `${appUrl}/reset-password`

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    })

    if (error) return { error: { message: error.message } }
    return { data }
  } catch (err: any) {
    return { error: { message: err.message || 'Failed to send reset email' } }
  }
}

export async function updatePassword(newPassword: string): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay()
    return { data: {} }
  }

  try {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: { message: error.message } }
    return { data }
  } catch (err: any) {
    return { error: { message: err.message || 'Failed to update password' } }
  }
}

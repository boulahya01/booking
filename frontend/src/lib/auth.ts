import { supabase } from './supabaseClient'
import { USE_MOCK, mockProfile, mockDelay } from './mock'
import type { Profile } from './types'
import { logger } from './logger'

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

  const normalizedStudentId = studentId.replace(/\s+/g, '').toUpperCase()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { student_id: normalizedStudentId, full_name: fullName }
    }
  })

  if (error) {
    logger.error('[register] supabase.auth.signUp error:', error)
  }

  return { data, error: error ? { message: error.message } : undefined }
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

    if (signInError) {
      return { error: { message: signInError.message } }
    }

    if (!data.user) {
      return { error: { message: 'Login failed' } }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      return { error: { message: 'Profile not found' } }
    }

    return { data: { user: data.user, profile } }
  } catch (err: any) {
    return { error: { message: err.message || 'Login failed' } }
  }
}

export async function loginWithStudentId(studentId: string, password: string): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay()
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mock_auth_user', JSON.stringify(mockProfile))
    }
    return { data: { user: { id: mockProfile.id, email: mockProfile.email }, profile: mockProfile } }
  }

  try {
    const normalizedId = studentId.replace(/\s+/g, '').toUpperCase()

    // Use RPC function to get email from auth.users by student_id
    const { data: email, error: profileError } = await supabase
      .rpc('get_email_by_student_id', { p_student_id: normalizedId })

    if (profileError || !email) {
      return { error: { message: 'Student ID not found' } }
    }

    return loginWithEmail(email, password)
  } catch (err: any) {
    return { error: { message: err.message || 'Login failed' } }
  }
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  if (USE_MOCK) {
    await mockDelay()
    return mockProfile as Profile
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      logger.error('[getUserProfile] Error:', error.message)
      throw new Error(error.message || 'Error fetching profile')
    }

    return data as Profile | null
  } catch (err: any) {
    logger.error('[getUserProfile] Exception:', err.message)
    throw err
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

    if (error) {
      return { error: { message: error.message } }
    }

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

    if (error) {
      return { error: { message: error.message } }
    }

    return { data }
  } catch (err: any) {
    return { error: { message: err.message || 'Failed to update password' } }
  }
}

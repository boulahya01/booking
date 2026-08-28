import type { AuthError } from '@supabase/supabase-js'
import { get } from 'svelte/store'
import { emailConfirmationRedirectUrl } from './authFlow'
import { supabase } from './supabaseClient'
import { language } from './stores/ui'
import {
  authRetryAfterSeconds,
  classifyAuthFailure,
  type AuthFailureKind
} from './ux/authFailure'

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

export function isAcademicEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@usmba.ac.ma')
}

function normalizeRegistrationFailureKind(
  kind: AuthFailureKind,
  rawMessage = '',
  status?: number,
  code?: string
): AuthFailureKind {
  // Registration must not disclose whether an email is already registered.
  // Supabase confirmation mode intentionally obscures repeated signups, and
  // any provider-specific duplicate-account error must converge on the same
  // generic registration conflict path.
  if (kind === 'account_exists') return 'registration_conflict'

  // Postgres registration conflicts raised by the profile trigger are wrapped
  // by GoTrue as an unexpected 500. Treat only that known wrapper as a
  // privacy-safe conflict; unrelated server failures remain service outages.
  const wrappedRegistrationConflict =
    status === 500 &&
    code?.toLowerCase() === 'unexpected_failure' &&
    /database error saving new user|registration[_ ]conflict/i.test(rawMessage)

  return wrappedRegistrationConflict ? 'registration_conflict' : kind
}

function userMessage(kind: AuthFailureKind, rawMessage = ''): string {
  const ar = get(language) === 'ar'
  const retry = authRetryAfterSeconds(rawMessage)

  if (ar) {
    if (kind === 'account_exists') return 'هذا البريد مرتبط بحساب موجود. سجّل الدخول، أو استرجع كلمة المرور إذا نسيتها.'
    if (kind === 'registration_conflict') return 'لا يمكن استخدام هذه المعلومات. راجعها أو سجّل الدخول.'
    if (kind === 'username_taken') return 'اسم المستخدم مستعمل بالفعل. اختر اسماً آخر.'
    if (kind === 'weak_password') return 'استخدم 8 أحرف على الأقل مع رقم ورمز.'
    if (kind === 'rate_limited') return retry ? `طلبات كثيرة. انتظر ${retry} ثانية ثم حاول مجدداً.` : 'طلبات كثيرة. انتظر قليلاً ثم حاول مجدداً.'
    if (kind === 'network') return 'تعذر الوصول إلى خدمة تسجيل الدخول. تحقق من اتصالك بالإنترنت ثم حاول مجدداً.'
    if (kind === 'service_unavailable') return 'إنشاء الحساب غير متاح مؤقتاً. حاول بعد قليل.'
    return 'تعذر إنشاء الحساب. راجع المعلومات وحاول مجدداً.'
  }

  if (kind === 'account_exists') return 'An account already uses this email. Sign in instead, or reset your password if you forgot it.'
  if (kind === 'registration_conflict') return 'These details can’t be used. Review them or sign in.'
  if (kind === 'username_taken') return 'That username is already taken. Choose another one.'
  if (kind === 'weak_password') return 'Use at least 8 characters with a number and a symbol.'
  if (kind === 'rate_limited') return retry ? `Too many attempts. Wait ${retry} seconds and try again.` : 'Too many attempts. Wait a moment and try again.'
  if (kind === 'network') return 'UNEEM cannot reach the authentication service. Check your internet connection and try again.'
  if (kind === 'service_unavailable') return 'Account creation is temporarily unavailable. Try again shortly.'
  return 'We could not create your account. Check your information and try again.'
}

function fromAuthError(error: AuthError): RegistrationFailure {
  const kind = normalizeRegistrationFailureKind(
    classifyAuthFailure(error.message, error.status, error.code),
    error.message,
    error.status,
    error.code
  )
  return {
    kind,
    message: userMessage(kind, error.message),
    status: error.status,
    code: error.code
  }
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
      return { error: fromAuthError(error) }
    }

    // With email confirmation enabled Supabase deliberately obscures repeated
    // signups behind the same successful response shape. Do not inspect the
    // returned identities array to turn that privacy boundary into an oracle.
    return { data }
  } catch (error: any) {
    const kind = normalizeRegistrationFailureKind(
      classifyAuthFailure(error?.message, error?.status, error?.code),
      error?.message,
      error?.status,
      error?.code
    )
    const normalizedKind = kind === 'unknown' ? 'service_unavailable' : kind
    return {
      error: {
        kind: normalizedKind,
        message: userMessage(normalizedKind, error?.message),
        status: error?.status,
        code: error?.code
      }
    }
  }
}

export async function register(
  email: string,
  password: string,
  studentId: string | null,
  fullName: string,
  username: string
): Promise<RegistrationResult> {
  return registerAccount({ email, password, studentId, fullName, username })
}

export function mapAuthError(message: string, status?: number): string {
  const kind = normalizeRegistrationFailureKind(classifyAuthFailure(message, status), message, status)
  return userMessage(kind === 'unknown' ? 'service_unavailable' : kind, message)
}

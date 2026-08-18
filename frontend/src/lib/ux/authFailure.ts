export type AuthFailureKind =
  | 'invalid_credentials'
  | 'email_unconfirmed'
  | 'rate_limited'
  | 'network'
  | 'profile_missing'
  | 'unknown'

export function classifyAuthFailure(message?: string, status?: number): AuthFailureKind {
  const normalized = (message || '').trim().toLowerCase()

  if (status === 429 || normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'rate_limited'
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('connection') ||
    normalized.includes('fetcherror')
  ) {
    return 'network'
  }

  if (normalized.includes('profile not found') || normalized.includes('unable to restore account')) {
    return 'profile_missing'
  }

  if (normalized.includes('email not confirmed') || normalized.includes('email_not_confirmed')) {
    return 'email_unconfirmed'
  }

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid credentials') ||
    normalized.includes('login failed')
  ) {
    return 'invalid_credentials'
  }

  return 'unknown'
}

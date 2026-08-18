export type AuthFailureKind =
  | 'invalid_credentials'
  | 'rate_limited'
  | 'network'
  | 'profile_missing'
  | 'unknown'

export function classifyAuthFailure(message?: string, status?: number): AuthFailureKind {
  const normalized = (message || '').trim().toLowerCase()

  if (
    status === 429 ||
    normalized === 'rate_limited' ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests')
  ) {
    return 'rate_limited'
  }

  if (
    normalized === 'network_error' ||
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('connection') ||
    normalized.includes('fetcherror')
  ) {
    return 'network'
  }

  if (normalized === 'profile_missing' || normalized.includes('profile not found')) {
    return 'profile_missing'
  }

  if (
    normalized === 'invalid_credentials' ||
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid credentials') ||
    normalized.includes('email not confirmed') ||
    normalized.includes('login failed')
  ) {
    return 'invalid_credentials'
  }

  return 'unknown'
}

export type AuthFailureKind =
  | 'invalid_credentials'
  | 'email_unconfirmed'
  | 'account_exists'
  | 'registration_conflict'
  | 'username_taken'
  | 'weak_password'
  | 'same_password'
  | 'rate_limited'
  | 'link_invalid'
  | 'network'
  | 'profile_missing'
  | 'service_unavailable'
  | 'unknown'

function normalizedParts(message = '', code = '') {
  return {
    message: message.trim().toLowerCase(),
    code: code.trim().toLowerCase()
  }
}

export function authRetryAfterSeconds(message = ''): number | null {
  const match = message.match(/(?:after|in)\s+(\d+)\s+seconds?/i)
  if (!match) return null
  const seconds = Number(match[1])
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

export function classifyAuthFailure(message?: string, status?: number, code?: string): AuthFailureKind {
  const normalized = normalizedParts(message, code)
  const text = `${normalized.code} ${normalized.message}`

  if (
    status === 429 ||
    text.includes('rate limit') ||
    text.includes('too many requests') ||
    text.includes('security purposes') ||
    text.includes('over_email_send_rate_limit') ||
    text.includes('over_request_rate_limit')
  ) {
    return 'rate_limited'
  }

  if (
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('connection') ||
    text.includes('fetcherror') ||
    text.includes('networkerror')
  ) {
    return 'network'
  }

  if (
    text.includes('user already registered') ||
    text.includes('already been registered') ||
    text.includes('user_already_exists') ||
    text.includes('email_exists') ||
    text.includes('account_exists')
  ) {
    return 'account_exists'
  }

  if (text.includes('registration_conflict')) {
    return 'registration_conflict'
  }

  if (
    text.includes('username_taken') ||
    text.includes('profiles_username')
  ) {
    return 'username_taken'
  }

  if (text.includes('email not confirmed') || text.includes('email_not_confirmed')) {
    return 'email_unconfirmed'
  }

  if (
    text.includes('invalid login credentials') ||
    text.includes('invalid credentials') ||
    text.includes('invalid_credentials') ||
    text.includes('login failed')
  ) {
    return 'invalid_credentials'
  }

  if (
    text.includes('same_password') ||
    text.includes('same password') ||
    text.includes('new password should be different')
  ) {
    return 'same_password'
  }

  if (
    text.includes('weak_password') ||
    (text.includes('password') && (
      text.includes('should be') ||
      text.includes('too short') ||
      text.includes('weak') ||
      text.includes('length')
    ))
  ) {
    return 'weak_password'
  }

  if (
    text.includes('otp_expired') ||
    text.includes('token has expired') ||
    text.includes('token expired') ||
    text.includes('invalid token') ||
    text.includes('invalid otp') ||
    text.includes('flow_state_not_found') ||
    text.includes('recovery_session_required') ||
    text.includes('unexpected_auth_flow')
  ) {
    return 'link_invalid'
  }

  if (
    text.includes('profile not found') ||
    text.includes('profile_missing') ||
    text.includes('unable to restore account') ||
    text.includes('missing_account_state')
  ) {
    return 'profile_missing'
  }

  if (
    status !== undefined && status >= 500 ||
    text.includes('internal server error') ||
    text.includes('database error') ||
    text.includes('unexpected_failure') ||
    text.includes('service unavailable')
  ) {
    return 'service_unavailable'
  }

  return 'unknown'
}

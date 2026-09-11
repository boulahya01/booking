import { accountHome, canBrowse } from './access'
import { afterSignIn } from './inviteNavigation'
import type { AccountState } from './types'

export type BootstrapError = 'profile_not_found' | 'network_error' | 'database_error' | null

export type ResolverContext = {
  hasSession: boolean
  account: AccountState | null
  pathname: string
  recoveryActive: boolean
  bootstrapError: BootstrapError
  requestedPath?: string | null
}

const authPaths = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/logout',
  '/auth-error'
])

const publicPaths = new Set([
  '/',
  '/launch',
  '/help',
  '/privacy',
  '/terms',
  '/data-deletion'
])

export function classifyBootstrapError(error: unknown): Exclude<BootstrapError, null | 'profile_not_found'> {
  const message = String((error as { message?: string })?.message || error || '').toLowerCase()
  if (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('fetcherror') ||
    message.includes('connection')
  ) {
    return 'network_error'
  }
  return 'database_error'
}

export function isAuthPath(pathname: string): boolean {
  return authPaths.has(pathname)
}

export function isPublicPath(pathname: string): boolean {
  return publicPaths.has(pathname)
}

export function resolveAccountRoute(ctx: ResolverContext): string | null {
  const { hasSession, account, pathname, recoveryActive, bootstrapError, requestedPath } = ctx
  const authPath = isAuthPath(pathname)
  const publicPath = isPublicPath(pathname)
  const recoveryPath = pathname === '/reset-password'
  const verifyEmailPath = pathname === '/verify-email'
  const authErrorPath = pathname === '/auth-error'
  const pendingPath = pathname === '/pending-approval'
  const profilePath = pathname === '/profile' || pathname === '/menu'
  const verificationPath = pathname === '/verification'
  const adminPath = pathname === '/admin' || pathname.startsWith('/admin/')
  const sportsPath = pathname.startsWith('/home') ||
    pathname.startsWith('/bookings') ||
    pathname.startsWith('/pitch/') ||
    pathname.startsWith('/matches') ||
    pathname.startsWith('/notifications')

  if (recoveryActive && hasSession && !recoveryPath && !publicPath && pathname !== '/logout') {
    return '/reset-password'
  }

  if (!hasSession) {
    if (authErrorPath) return '/login'
    if (authPath || publicPath) return null
    return '/login'
  }

  if (bootstrapError) {
    if (authErrorPath || publicPath || verifyEmailPath || recoveryPath || pathname === '/logout') return null
    return '/auth-error'
  }

  // A completed bootstrap must always produce an account. Treat a missing
  // account as an initialization failure rather than a normal pending state.
  if (!account) {
    if (authErrorPath || publicPath || verifyEmailPath || recoveryPath || pathname === '/logout') return null
    return '/auth-error'
  }

  if (authErrorPath) return afterSignIn(account, requestedPath)

  if (authPath && pathname !== '/logout' && !verifyEmailPath && !(recoveryPath && recoveryActive)) {
    return afterSignIn(account, requestedPath)
  }

  if (adminPath && account.role !== 'admin') return accountHome(account)

  if (!canBrowse(account) && (sportsPath || adminPath)) return '/pending-approval'

  if (canBrowse(account) && account.can_use_sports && pendingPath) return accountHome(account)

  if (
    !canBrowse(account) &&
    !pendingPath &&
    !profilePath &&
    !verificationPath &&
    !publicPath &&
    !authPath
  ) {
    return '/pending-approval'
  }

  return null
}

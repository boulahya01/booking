import { supabase } from './supabaseClient'
import { getMyAccountState } from './auth'
import { afterSignIn } from './inviteNavigation'
import type { AccountState } from './types'
import { getConnectedProviders, hasPasswordCredential, type AccountIdentity as AccountIdentityType } from './accountIdentity'
import type { User } from '@supabase/supabase-js'

/**
 * Centralized post-authentication account resolver.
 * Determines the correct destination route based on account state.
 * This is the single source of truth for post-auth routing.
 */

export type AccountRouteDestination =
  | '/home'
  | '/pending-approval'
  | '/verification'
  | '/profile'
  | '/menu'
  | '/admin'
  | '/login'
  | '/verify-email'
  | '/reset-password'
  | '/help'
  | '/auth-error'
  | null

export interface ResolverContext {
  hasSession: boolean
  account: AccountState | null
  identity: AccountIdentityType | null
  pathname: string
  recoveryActive: boolean
  isAdminAccount: boolean
  canBrowseApp: boolean
  bootstrapError: 'profile_not_found' | 'network_error' | 'database_error' | null
  requestedPath?: string | null
}

/**
 * Determines if the user can browse the app (approved status, email confirmed, not suspended).
 */
export function canBrowse(account: AccountState | null): boolean {
  return Boolean(account && account.access_status !== 'suspended' && account.restriction_reason !== 'email_confirmation_required')
}

/**
 * Determines if the user can participate in sports (verified identity + approved + email confirmed).
 */
export function canParticipate(account: AccountState | null): boolean {
  return Boolean(canBrowse(account) && account?.can_use_sports && account.identity_status === 'verified')
}

/**
 * Gets the home route for the account based on role and access.
 */
export function accountHome(account: AccountState | null): AccountRouteDestination {
  if (!canBrowse(account)) return '/pending-approval'
  return account?.role === 'admin' ? '/admin' : '/home'
}

/**
 * Main resolver function - determines where to route after authentication.
 * This should be called after any auth event: OAuth, email/password, session restore, email confirmation, PWA launch.
 */
export function resolveAccountRoute(ctx: ResolverContext): AccountRouteDestination {
  const { hasSession, account, identity, pathname, recoveryActive, isAdminAccount, canBrowseApp, bootstrapError } = ctx

  const authPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/logout']
  const publicSupportPaths = ['/help']
  const isAuthPath = authPaths.includes(pathname)
  const isSupportPath = publicSupportPaths.includes(pathname)
  const isPendingPath = pathname === '/pending-approval'
  const isProfilePath = pathname === '/profile' || pathname === '/menu'
  const isVerificationPath = pathname === '/verification'
  const isVerifyEmailPath = pathname === '/verify-email'
  const isRecoveryPath = pathname === '/reset-password'
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
  const isAuthErrorPath = pathname === '/auth-error'
  const isSportsPath = pathname.startsWith('/home') ||
                       pathname.startsWith('/bookings') ||
                       pathname.startsWith('/pitch/') ||
                       pathname.startsWith('/matches') ||
                       pathname.startsWith('/notifications')

  // Recovery flow takes priority - trap user on reset-password until complete
  if (recoveryActive && hasSession && !isRecoveryPath && !isSupportPath && pathname !== '/logout') {
    return '/reset-password'
  }

  // No session - redirect to login (except auth/support pages)
  if (!hasSession && !isAuthPath && !isSupportPath) {
    return '/login'
  }

  // Bootstrap error - show auth error page with retry
  if (hasSession && bootstrapError && !isAuthErrorPath && !isSupportPath && !isVerifyEmailPath && !isRecoveryPath) {
    return '/auth-error'
  }

  // Has session but no account (profile not bootstrapped yet)
  if (hasSession && !account && !isSupportPath && !isVerifyEmailPath && !isRecoveryPath) {
    return '/pending-approval'
  }

  // Authenticated user on auth pages (except logout, verify-email, recovery) -> go to app
  if (hasSession && isAuthPath && pathname !== '/logout' && !isVerifyEmailPath && !(isRecoveryPath && recoveryActive)) {
    return afterSignIn(account, ctx.requestedPath) as AccountRouteDestination
  }

  // Admin route access check
  if (hasSession && isAdminPath && !isAdminAccount) {
    return accountHome(account)
  }

  // Sports routes require full access
  if (hasSession && !canBrowseApp && (isSportsPath || isAdminPath)) {
    return '/pending-approval'
  }

  // User with full access on pending page -> go to home
  if (hasSession && canBrowseApp && account?.can_use_sports && isPendingPath) {
    return '/home'
  }

  // User without browse access on non-profile/verification pages -> pending-approval
  if (hasSession && !canBrowseApp && !isPendingPath && !isProfilePath && !isVerificationPath && !isSupportPath && !isAuthPath) {
    return '/pending-approval'
  }

  // No redirect needed
  return null
}

/**
 * Builds resolver context from current auth state.
 */
export function buildResolverContext(
  hasSession: boolean,
  account: AccountState | null,
  identity: AccountIdentityType | null,
  pathname: string,
  recoveryActive: boolean,
  bootstrapError: 'profile_not_found' | 'network_error' | 'database_error' | null = null,
  requestedPath?: string | null
): ResolverContext {
  return {
    hasSession,
    account,
    identity,
    pathname,
    recoveryActive,
    isAdminAccount: account?.role === 'admin',
    canBrowseApp: canBrowse(account),
    bootstrapError,
    requestedPath
  }
}

/**
 * Async resolver that fetches account state if needed.
 * Use this when you have a session but need to fetch the account state.
 */
export async function resolveAccountRouteAsync(
  session: { user: User } | null,
  pathname: string,
  recoveryActive: boolean
): Promise<AccountRouteDestination> {
  if (!session?.user) {
    const authPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/logout']
    const publicSupportPaths = ['/help']
    if (authPaths.includes(pathname) || publicSupportPaths.includes(pathname)) {
      return null
    }
    return '/login'
  }

  try {
    const identity = await getConnectedProviders(session.user)
    const hasPassword = hasPasswordCredential(session.user)
    const accountIdentity: AccountIdentityType = {
      providers: identity,
      hasPassword,
      primaryEmail: session.user.email || '',
      canAddPassword: !hasPassword && identity.some(p => p.provider !== 'email')
    }

    const account = await getMyAccountState()

    const ctx = buildResolverContext(true, account, accountIdentity, pathname, recoveryActive)
    return resolveAccountRoute(ctx)
  } catch {
    // On error, stay on current page or go to pending-approval
    return '/pending-approval'
  }
}
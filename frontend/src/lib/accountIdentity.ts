import { supabase } from './supabaseClient'
import type { User } from '@supabase/supabase-js'

export type AuthProvider = 'google' | 'facebook' | 'email' | 'phone'

export interface ConnectedProvider {
  provider: AuthProvider
  connected: boolean
  email?: string
  lastSignInAt?: string
}

export interface AccountIdentity {
  providers: ConnectedProvider[]
  hasPassword: boolean
  primaryEmail: string
  canAddPassword: boolean
}

/**
 * Determines the connected authentication providers for the current user.
 * Uses Supabase user identities and app_metadata to detect linked providers.
 */
export async function getConnectedProviders(user: User): Promise<ConnectedProvider[]> {
  const providers: ConnectedProvider[] = []
  const seenProviders = new Set<AuthProvider>()

  // Check identities array (most reliable for linked providers)
  if (user.identities && Array.isArray(user.identities)) {
    for (const identity of user.identities) {
      const provider = identity.provider as AuthProvider
      if (provider && !seenProviders.has(provider)) {
        seenProviders.add(provider)
        providers.push({
          provider,
          connected: true,
          email: identity.identity_data?.email,
          lastSignInAt: identity.last_sign_in_at
        })
      }
    }
  }

  // Fallback: check app_metadata providers
  const appProviders = user.app_metadata?.providers as string[] | undefined
  if (appProviders && Array.isArray(appProviders)) {
    for (const provider of appProviders) {
      const authProvider = provider as AuthProvider
      if (!seenProviders.has(authProvider)) {
        seenProviders.add(authProvider)
        providers.push({
          provider: authProvider,
          connected: true,
          email: user.email
        })
      }
    }
  }

  // Ensure email provider is listed if user has email confirmed
  if (user.email_confirmed_at && !seenProviders.has('email')) {
    seenProviders.add('email')
    providers.push({
      provider: 'email',
      connected: true,
      email: user.email
    })
  }

  return providers
}

/**
 * Checks if the user has a password credential (email provider with password).
 * In Supabase, this means the 'email' provider is in identities or the user
 * was created via email/password signup (not just OAuth).
 */
export function hasPasswordCredential(user: User): boolean {
  // Check identities for email provider (password-based)
  if (user.identities && Array.isArray(user.identities)) {
    return user.identities.some((id) => id.provider === 'email')
  }
  // Fallback: if no OAuth providers and email confirmed, likely has password
  const hasOAuth = user.app_metadata?.providers?.some((p: string) => p !== 'email')
  return !hasOAuth && !!user.email_confirmed_at
}

/**
 * Gets the complete account identity for the current user.
 */
export async function getAccountIdentity(user: User): Promise<AccountIdentity> {
  const providers = await getConnectedProviders(user)
  const hasPassword = hasPasswordCredential(user)

  return {
    providers,
    hasPassword,
    primaryEmail: user.email || '',
    canAddPassword: !hasPassword && providers.some((p) => p.provider !== 'email')
  }
}

/**
 * Determines if a user can add a password (i.e., they only have OAuth providers).
 */
export function canAddPassword(identity: AccountIdentity): boolean {
  return identity.canAddPassword
}

/**
 * Gets display label for a provider.
 */
export function getProviderLabel(provider: AuthProvider): string {
  switch (provider) {
    case 'google':
      return 'Google'
    case 'facebook':
      return 'Facebook'
    case 'email':
      return 'Email & password'
    case 'phone':
      return 'Phone'
    default:
      return provider
  }
}

/**
 * Gets the provider icon name.
 */
export function getProviderIcon(provider: AuthProvider): string {
  switch (provider) {
    case 'google':
      return 'chrome' // Using chrome as generic Google icon
    case 'facebook':
      return 'facebook'
    case 'email':
      return 'mail'
    case 'phone':
      return 'smartphone'
    default:
      return 'user'
  }
}
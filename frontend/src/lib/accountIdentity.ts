import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

export type SupportedAuthProvider = 'google' | 'email'

export type AccountIdentity = {
  providers: SupportedAuthProvider[]
  hasGoogle: boolean
  hasPassword: boolean
  canAddPassword: boolean
  primaryEmail: string
}

function supportedProviders(identities: Array<{ provider?: string }>): SupportedAuthProvider[] {
  const providers = new Set<SupportedAuthProvider>()
  for (const identity of identities) {
    if (identity.provider === 'google' || identity.provider === 'email') {
      providers.add(identity.provider)
    }
  }
  return [...providers]
}

/**
 * Read the server-backed Supabase identity list for the signed-in user.
 * Do not infer password capability from email confirmation: OAuth users can
 * have confirmed email addresses without an email/password credential.
 */
export async function getAccountIdentity(user: User): Promise<AccountIdentity> {
  const { data, error } = await supabase.auth.getUserIdentities()
  if (error) throw new Error(error.message || 'Unable to load sign-in methods')

  const identities = data?.identities ?? user.identities ?? []
  const providers = supportedProviders(identities)
  const hasGoogle = providers.includes('google')
  const hasPassword = providers.includes('email')

  return {
    providers,
    hasGoogle,
    hasPassword,
    canAddPassword: hasGoogle && !hasPassword,
    primaryEmail: user.email ?? ''
  }
}

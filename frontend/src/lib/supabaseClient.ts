import { createClient } from '@supabase/supabase-js'

const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const configuredKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim()

const supabaseUrl = configuredUrl
const supabaseKey = configuredKey

if (!configuredUrl || !configuredKey) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the local or deployment environment.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

export const supabaseClient = supabase

export type SocialProvider = 'google'
// null means we could not reach Auth, not that Google is disabled.
export type SocialProviders = Record<SocialProvider, boolean | null>
let providerRequest: Promise<SocialProviders> | null = null

// Public Auth configuration only. One non-blocking read shared by auth screens.
export function getSocialProviders(): Promise<SocialProviders> {
  if (providerRequest) return providerRequest

  providerRequest = fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: supabaseKey },
    signal: AbortSignal.timeout(5000)
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('auth_settings_unavailable')
      const settings = await response.json()
      return { google: settings.external?.google === true }
    })
    .catch(() => {
      providerRequest = null
      return { google: null }
    })

  return providerRequest
}

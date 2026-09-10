import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

// UNEM Sports production is intentionally pinned to the selected free Supabase project.
// Both values below are public browser configuration, not secrets.
const productionSupabaseUrl = 'https://hudjpcrjoryyhpphonsp.supabase.co'
const productionSupabasePublishableKey = 'sb_publishable_XWFoFTe7RSsEwQ0iivrjWw_7C3BKUcp'

const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const configuredKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim()

const supabaseUrl = import.meta.env.PROD
  ? productionSupabaseUrl
  : configuredUrl || productionSupabaseUrl
const supabaseKey = import.meta.env.PROD
  ? productionSupabasePublishableKey
  : configuredKey || productionSupabasePublishableKey

if (!configuredUrl || !configuredKey) {
  logger.warn('[supabaseClient] Using the committed UNEM Sports free-project browser configuration.')
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
let providerRequest: Promise<Record<SocialProvider, boolean>> | null = null

// Public Auth configuration only. One non-blocking read shared by auth screens.
export function getSocialProviders(): Promise<Record<SocialProvider, boolean>> {
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
      return { google: false }
    })

  return providerRequest
}

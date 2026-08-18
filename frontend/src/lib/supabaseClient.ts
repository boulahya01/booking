import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim()

const configured = Boolean(supabaseUrl && supabaseKey)

if (!configured && import.meta.env.PROD) {
  throw new Error(
    'UNEEM Supabase configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY).'
  )
}

if (!configured) {
  logger.warn('[supabaseClient] Missing Supabase environment variables in development; using a local placeholder client.')
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseKey || 'development-placeholder-key',
  {
    auth: {
      flowType: 'implicit',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)

export const supabaseClient = supabase

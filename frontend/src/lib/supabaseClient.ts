import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  logger.warn('[supabaseClient] Missing Supabase environment variables. Using dummy client.')
}

export const supabase = createClient(supabaseUrl || 'http://localhost:54321', supabaseAnonKey || 'dummy-key', {
  auth: {
    // Prevent lock contention by using a longer timeout and auto refresh
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})
export const supabaseClient = supabase

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
config({ path: join(process.cwd(), '..', '.env.local') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyRLSFix() {
  try {
    console.log('Applying RLS policy fix...')

    // Read the migration SQL
    const migrationPath = join(process.cwd(), 'migrations', '20260427000000_fix_profile_resubmission_rls.sql')
    const sql = readFileSync(migrationPath, 'utf8')

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql })

    if (error) {
      console.error('Error applying RLS fix:', error)
      return
    }

    console.log('RLS policy fix applied successfully!')
  } catch (error) {
    console.error('Failed to apply RLS fix:', error)
  }
}

applyRLSFix()
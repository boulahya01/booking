import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1cGFiYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE0MTcxMTM4MTIsImV4cCI6MTkzNzQ5NzIxMn0.CRXP3ySAOG9OjstxqB8x3XJwQaXW8j-cVHvF3aF_WkU'

export const supabase = createClient(supabaseUrl, supabaseKey)

import { createClient } from '@supabase/supabase-js'

const s = createClient('https://mismymbsavogkuovfyvj.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data, error } = await s
  .from('bookings')
  .select('*')
  .limit(1)

if (error) {
  console.log('Error:', error)
} else if (data && data.length > 0) {
  console.log('Sample booking columns:', Object.keys(data[0]))
} else {
  console.log('No bookings exist yet')
}

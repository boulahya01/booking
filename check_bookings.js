import { createClient } from '@supabase/supabase-js'

const s = createClient('https://mismymbsavogkuovfyvj.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY)

// Check for any active bookings for this user/pitch combo
const userId = '0db82f77-bf7b-447c-bf5f-283af3fed7a2'
const pitchId = '03cd1b68-0b74-488d-a90a-6d6c64b8ab5c'

const { data, error } = await s
  .from('bookings')
  .select('*')
  .eq('user_id', userId)
  .eq('pitch_id', pitchId)
  .eq('status', 'active')

console.log('Active bookings for user/pitch:', data)
if (error) console.log('Error:', error)

// Also check ALL bookings for this user
const { data: allBookings } = await s
  .from('bookings')
  .select('*')
  .eq('user_id', userId)

console.log('\nAll bookings for user:', allBookings)

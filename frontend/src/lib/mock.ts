// Legacy fixture data retained only for development screenshots/tests.
// UNEEM release builds cannot enable mock mode through environment variables.
export const USE_MOCK = false as const

export const mockProfile = {
  id: 'mock-user-1',
  email: 'test@usmba.ac.ma',
  student_id: 'S123456789',
  full_name: 'Test Student',
  username: 'test_student',
  role: 'admin',
  status: 'approved',
  rejection_reason: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

export const mockPitches = [
  { id: '1', name: 'Football Field A', location: 'Main Campus', capacity: 22, open_time: '08:00', close_time: '22:00', sort_order: 0, created_at: new Date().toISOString(), sport_type: 'Football', booking_frequency_enabled: true, booking_frequency_days: 7 },
  { id: '2', name: 'Basketball Court B', location: 'Sports Complex', capacity: 10, open_time: '09:00', close_time: '21:00', sort_order: 1, created_at: new Date().toISOString(), sport_type: 'Basketball', booking_frequency_enabled: false, booking_frequency_days: null },
  { id: '3', name: 'Tennis Court 1', location: 'East Campus', capacity: 4, open_time: '07:00', close_time: '20:00', sort_order: 2, created_at: new Date().toISOString(), sport_type: 'Tennis', booking_frequency_enabled: true, booking_frequency_days: 3 }
]

export const mockBookings = [
  { id: 'b1', user_id: 'mock-user-1', pitch_id: '1', slot_datetime: new Date(Date.now() + 86400000).toISOString(), slot_datetime_end: new Date(Date.now() + 86400000 + 3600000).toISOString(), status: 'active', created_at: new Date().toISOString(), pitches: { name: 'Football Field A', location: 'Main Campus' } },
  { id: 'b2', user_id: 'mock-user-1', pitch_id: '2', slot_datetime: new Date(Date.now() + 172800000).toISOString(), slot_datetime_end: new Date(Date.now() + 172800000 + 3600000).toISOString(), status: 'active', created_at: new Date().toISOString(), pitches: { name: 'Basketball Court B', location: 'Sports Complex' } },
  { id: 'b3', user_id: 'mock-user-1', pitch_id: '1', slot_datetime: new Date(Date.now() - 86400000).toISOString(), slot_datetime_end: new Date(Date.now() - 86400000 + 3600000).toISOString(), status: 'completed', created_at: new Date().toISOString(), pitches: { name: 'Football Field A', location: 'Main Campus' } }
]

export const mockSlots = [
  { datetime_start: new Date(Date.now() + 86400000).toISOString(), datetime_end: new Date(Date.now() + 86400000 + 3600000).toISOString(), is_available: true, pitch_id: '1', pitch_name: 'Football Field A' },
  { datetime_start: new Date(Date.now() + 86400000 + 3600000).toISOString(), datetime_end: new Date(Date.now() + 86400000 + 7200000).toISOString(), is_available: true, pitch_id: '1', pitch_name: 'Football Field A' },
  { datetime_start: new Date(Date.now() + 86400000 + 7200000).toISOString(), datetime_end: new Date(Date.now() + 86400000 + 10800000).toISOString(), is_available: false, pitch_id: '1', pitch_name: 'Football Field A', booker_name: 'Alice' }
]

export const mockUsers = [
  mockProfile,
  { id: 'mock-user-2', email: 'pending@usmba.ac.ma', student_id: 'S987654321', full_name: 'Pending Student', role: 'student', status: 'pending', rejection_reason: null as string | null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'mock-user-3', email: 'student@usmba.ac.ma', student_id: 'S111222333', full_name: 'Regular Student', role: 'student', status: 'approved', rejection_reason: null as string | null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
]

export function mockDelay(ms = 300) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

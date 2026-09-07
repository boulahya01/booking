import { supabase } from './supabaseClient'

export type BookingFailureCode =
  | 'authentication_required'
  | 'account_not_approved'
  | 'active_booking_exists'
  | 'pitch_not_found'
  | 'slot_in_past'
  | 'outside_booking_window'
  | 'invalid_slot'
  | 'booking_frequency_limited'
  | 'slot_unavailable'
  | 'booking_not_found'
  | 'booking_not_owned'
  | 'booking_not_cancellable'
  | 'cancellation_window_closed'
  | 'network'
  | 'unknown'

export class BookingApiError extends Error {
  code: BookingFailureCode

  constructor(code: BookingFailureCode, message?: string) {
    super(message || code)
    this.name = 'BookingApiError'
    this.code = code
  }
}

export type AvailabilitySlot = {
  id: string
  booking_id: string | null
  pitch_id: string
  datetime_start: string
  datetime_end: string
  timezone: string
  is_available: boolean
  booked_by_me: boolean
  booker_name: string | null
  booker_username: string | null
  match_id: string | null
  match_open: boolean
  capacity: number
  reserved_spots: number
  joined_count: number
  spots_left: number
}

export type BookingLifecycle = 'upcoming' | 'in_progress' | 'completed' | 'cancelled'

export type MyBooking = {
  id: string
  pitch_id: string
  starts_at: string
  ends_at: string
  status: 'scheduled' | 'cancelled'
  lifecycle_status: BookingLifecycle
  cancelled_at: string | null
  created_at: string
  pitches: { name: string; location: string; capacity: number; timezone: string | null } | null
}

export type BookingDetails = {
  booking_id: string
  pitch_id: string
  pitch_name: string
  location: string
  timezone: string
  sport_type: string | null
  starts_at: string
  ends_at: string
  booking_status: 'scheduled' | 'cancelled'
  booker_id: string
  booker_name: string
  booker_username: string
  capacity: number
  booked_by_me: boolean
  match_id: string | null
  match_visibility: 'private' | 'open'
  match_open: boolean
  reserved_spots: number
  joined_count: number
  spots_left: number
  participant_by_me: boolean
  reserved_by_me: boolean
}

export type BookingRosterEntry = {
  entry_id: string
  reservation_id: string | null
  user_id: string | null
  display_name: string
  username: string | null
  member_role: 'organizer' | 'player' | 'reserved'
  source: 'account' | 'joined' | 'registered' | 'guest'
  joined_at: string
}

function classifyError(error: any): BookingFailureCode {
  const message = String(error?.message || error || '').toLowerCase()

  const known: BookingFailureCode[] = [
    'authentication_required',
    'account_not_approved',
    'active_booking_exists',
    'pitch_not_found',
    'slot_in_past',
    'outside_booking_window',
    'invalid_slot',
    'booking_frequency_limited',
    'slot_unavailable',
    'booking_not_found',
    'booking_not_owned',
    'booking_not_cancellable',
    'cancellation_window_closed'
  ]

  for (const code of known) {
    if (message.includes(code)) return code
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('fetcherror')
  ) {
    return 'network'
  }

  return 'unknown'
}

function throwApiError(error: any): never {
  throw new BookingApiError(classifyError(error), error?.message)
}

function normalizeAuthoritativeBooking(row: any): MyBooking {
  return {
    id: row.booking_id,
    pitch_id: row.pitch_id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: row.booking_status,
    lifecycle_status: row.lifecycle_status,
    cancelled_at: row.cancelled_at || null,
    created_at: row.created_at,
    pitches: row.pitch_name
      ? {
          name: row.pitch_name,
          location: row.pitch_location,
          capacity: Number(row.pitch_capacity || 0),
          timezone: row.pitch_timezone || null
        }
      : null
  }
}

export async function getPitchAvailability(pitchId: string): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase.rpc('get_pitch_availability', { p_pitch_id: pitchId })

  if (error) throwApiError(error)
  if (!Array.isArray(data)) return []

  return data.map((row: any) => ({
    id: row.booking_id || `${pitchId}:${row.starts_at}`,
    booking_id: row.booking_id || null,
    pitch_id: pitchId,
    datetime_start: row.starts_at,
    datetime_end: row.ends_at,
    timezone: row.timezone || 'Africa/Casablanca',
    is_available: Boolean(row.is_available),
    booked_by_me: Boolean(row.booked_by_me),
    booker_name: row.booker_name || null,
    booker_username: row.booker_username || null,
    match_id: row.match_id || null,
    match_open: Boolean(row.match_open),
    capacity: Number(row.capacity || 1),
    reserved_spots: Number(row.reserved_spots || 0),
    joined_count: Number(row.joined_count || 0),
    spots_left: Number(row.spots_left || 0)
  }))
}

export async function getBookingDetails(bookingId: string): Promise<BookingDetails | null> {
  const { data, error } = await supabase.rpc('get_booking_details', { p_booking_id: bookingId })
  if (error) throwApiError(error)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null

  return {
    booking_id: row.booking_id,
    pitch_id: row.pitch_id,
    pitch_name: row.pitch_name,
    location: row.location,
    timezone: row.timezone || 'Africa/Casablanca',
    sport_type: row.sport_type || null,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    booking_status: row.booking_status,
    booker_id: row.booker_id,
    booker_name: row.booker_name,
    booker_username: row.booker_username,
    capacity: Number(row.capacity || 1),
    booked_by_me: Boolean(row.booked_by_me),
    match_id: row.match_id || null,
    match_visibility: row.match_visibility === 'open' ? 'open' : 'private',
    match_open: Boolean(row.match_open),
    reserved_spots: Number(row.reserved_spots || 0),
    joined_count: Number(row.joined_count || 0),
    spots_left: Number(row.spots_left || 0),
    participant_by_me: Boolean(row.participant_by_me),
    reserved_by_me: Boolean(row.reserved_by_me)
  }
}

export async function listBookingRoster(bookingId: string): Promise<BookingRosterEntry[]> {
  const { data, error } = await supabase.rpc('list_booking_roster', { p_booking_id: bookingId })
  if (error) throwApiError(error)
  return (Array.isArray(data) ? data : []).map((row: any) => ({
    entry_id: String(row.entry_id),
    reservation_id: row.reservation_id || null,
    user_id: row.user_id || null,
    display_name: row.display_name || '',
    username: row.username || null,
    member_role: row.member_role,
    source: row.source,
    joined_at: row.joined_at
  }))
}

export async function createBooking(pitchId: string, startsAt: string) {
  const { data, error } = await supabase.rpc('create_booking', {
    p_pitch_id: pitchId,
    p_starts_at: startsAt
  })

  if (error) throwApiError(error)
  return Array.isArray(data) ? data[0] : data
}

export async function cancelBooking(bookingId: string) {
  const { data, error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId
  })

  if (error) throwApiError(error)
  return Array.isArray(data) ? data[0] : data
}

// userId remains optional for source compatibility with existing components,
// but the database scopes the read exclusively through auth.uid().
export async function getMyBookings(_userId?: string): Promise<MyBooking[]> {
  const { data, error } = await supabase.rpc('list_my_bookings', {
    p_limit: 100
  })

  if (error) throwApiError(error)
  return (Array.isArray(data) ? data : []).map(normalizeAuthoritativeBooking)
}

export async function getNextBooking(_userId?: string): Promise<MyBooking | null> {
  const { data, error } = await supabase.rpc('get_next_booking')

  if (error) throwApiError(error)
  const row = Array.isArray(data) ? data[0] : data
  return row ? normalizeAuthoritativeBooking(row) : null
}

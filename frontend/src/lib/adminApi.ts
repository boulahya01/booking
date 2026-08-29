import { supabase } from './supabaseClient'

export type AdminBookingLifecycle = 'upcoming' | 'in_progress' | 'completed' | 'cancelled'
export type AdminBookingCancelReason = 'maintenance' | 'safety' | 'scheduling_error' | 'university_event' | 'policy' | 'other'
export type FacilityArchiveReason = 'maintenance' | 'retired' | 'duplicate' | 'other'
export type AdminUserStatus = 'pending' | 'approved' | 'suspended'
export type AdminUserSuspendReason = 'conduct' | 'safety' | 'spam' | 'fake_identity' | 'booking_abuse' | 'match_abuse' | 'other'
export type AdminUserRestoreReason = 'review_complete' | 'appeal_approved' | 'other'
export type AdminUserModerationReason = AdminUserSuspendReason | AdminUserRestoreReason

export type AdminBooking = {
  booking_id: string
  user_id: string
  pitch_id: string
  starts_at: string
  ends_at: string
  booking_status: 'scheduled' | 'cancelled'
  lifecycle_status: AdminBookingLifecycle
  created_at: string
  full_name: string
  student_id: string | null
  email: string | null
  pitch_name: string
  pitch_location: string
  total_count: number
}

export type AdminBookingFilters = {
  query?: string
  pitchId?: string
  lifecycle?: AdminBookingLifecycle
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export type AdminUser = {
  user_id: string
  student_id: string | null
  full_name: string
  username: string | null
  role: 'student' | 'admin'
  access_status: AdminUserStatus
  email_kind: 'academic' | 'personal'
  identity_status: 'required' | 'pending' | 'verified' | 'rejected' | 'conflict'
  restriction_reason: string | null
  created_at: string
  total_count: number
}

export type AdminUserFilters = {
  query?: string
  status?: AdminUserStatus
  limit?: number
  offset?: number
}

export type AdminFacility = {
  id: string
  name: string
  location: string
  sport_type: string | null
  capacity: number
  timezone: string
  open_time: string
  close_time: string
  slot_duration_minutes: number
  booking_window_hours: number
  booking_frequency_enabled: boolean
  booking_frequency_days: number
  cancellation_cutoff_minutes: number
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export type AdminFacilityInput = Omit<AdminFacility, 'id' | 'created_at' | 'updated_at'> & { id?: string | null }

function message(error: any, fallback: string) {
  return String(error?.message || fallback)
}

function adminBookingCancelMessage(error: any) {
  const code = String(error?.message || '').toLowerCase()
  if (code.includes('admin_required')) return 'Your admin session no longer has permission for this action. Refresh or sign in again.'
  if (code.includes('booking_not_found')) return 'This booking no longer exists. Refresh the booking list.'
  if (code.includes('booking_already_cancelled')) return 'This booking has already been cancelled. Refresh the booking list.'
  if (code.includes('booking_already_finished')) return 'This booking has already finished and can no longer be cancelled.'
  if (code.includes('invalid_admin_booking_cancel_reason')) return 'Choose a valid cancellation reason and try again.'
  return 'Unable to cancel this booking right now. Please try again.'
}

function adminFacilitySaveMessage(error: any) {
  const code = String(error?.message || '').toLowerCase()
  if (code.includes('admin_required')) return 'Your admin session no longer has permission for this action. Refresh or sign in again.'
  if (code.includes('facility_not_found')) return 'This facility no longer exists. Refresh the facility list.'
  if (code.includes('invalid_facility_name')) return 'Enter a facility name between 1 and 120 characters.'
  if (code.includes('invalid_facility_location')) return 'Enter a facility location between 1 and 180 characters.'
  if (code.includes('invalid_facility_capacity')) return 'Capacity must be between 1 and 200.'
  if (code.includes('invalid_facility_hours')) return 'Closing time must be later than opening time.'
  if (code.includes('invalid_slot_duration')) return 'Slot duration must be between 15 and 240 minutes.'
  if (code.includes('invalid_booking_window')) return 'Booking window must be between 1 and 720 hours.'
  if (code.includes('invalid_booking_frequency')) return 'Booking frequency must be between 1 and 365 days.'
  if (code.includes('invalid_cancellation_cutoff')) return 'Cancellation cutoff must be between 0 and 1,440 minutes.'
  if (code.includes('invalid_timezone')) return 'Choose a valid facility timezone.'
  return 'Unable to save this facility right now. Please try again.'
}

export async function listAdminBookings(filters: AdminBookingFilters = {}): Promise<{ rows: AdminBooking[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_list_bookings', {
    p_query: filters.query?.trim() || null,
    p_pitch_id: filters.pitchId || null,
    p_lifecycle: filters.lifecycle || null,
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_limit: filters.limit ?? 30,
    p_offset: filters.offset ?? 0
  })
  if (error) throw new Error(message(error, 'Unable to load bookings'))
  const rows = (Array.isArray(data) ? data : []) as AdminBooking[]
  return { rows, total: Number(rows[0]?.total_count || 0) }
}

export async function adminCancelBooking(bookingId: string, reason: AdminBookingCancelReason) {
  const { data, error } = await supabase.rpc('admin_cancel_booking', {
    p_booking_id: bookingId,
    p_reason_code: reason
  })
  if (error) throw new Error(adminBookingCancelMessage(error))
  return Array.isArray(data) ? data[0] : data
}

export async function listAdminUsers(filters: AdminUserFilters = {}): Promise<{ rows: AdminUser[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_query: filters.query?.trim() || null,
    p_status: filters.status || null,
    p_limit: filters.limit ?? 50,
    p_offset: filters.offset ?? 0
  })
  if (error) throw new Error(message(error, 'Unable to load users'))
  const rows = (Array.isArray(data) ? data : []) as AdminUser[]
  return { rows, total: Number(rows[0]?.total_count || 0) }
}

export async function adminSetUserAccess(
  userId: string,
  nextStatus: Extract<AdminUserStatus, 'approved' | 'suspended'>,
  reason: AdminUserModerationReason
): Promise<{ user_id: string; access_status: AdminUserStatus; restriction_reason: string | null }> {
  const { data, error } = await supabase.rpc('admin_set_user_access', {
    p_user_id: userId,
    p_next_status: nextStatus,
    p_reason_code: reason
  })
  if (error) throw new Error(message(error, 'Unable to update user access'))
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('User access update returned no data')
  return row
}

export async function listAdminFacilities(): Promise<AdminFacility[]> {
  const { data, error } = await supabase
    .from('pitches')
    .select('id,name,location,sport_type,capacity,timezone,open_time,close_time,slot_duration_minutes,booking_window_hours,booking_frequency_enabled,booking_frequency_days,cancellation_cutoff_minutes,is_active,sort_order,created_at,updated_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(message(error, 'Unable to load facilities'))
  return (data || []) as AdminFacility[]
}

export async function adminSaveFacility(input: AdminFacilityInput): Promise<AdminFacility> {
  const { data, error } = await supabase.rpc('admin_save_pitch', {
    p_pitch_id: input.id || null,
    p_name: input.name,
    p_location: input.location,
    p_sport_type: input.sport_type || null,
    p_capacity: Number(input.capacity),
    p_open_time: input.open_time,
    p_close_time: input.close_time,
    p_slot_duration_minutes: Number(input.slot_duration_minutes),
    p_booking_window_hours: Number(input.booking_window_hours),
    p_booking_frequency_enabled: Boolean(input.booking_frequency_enabled),
    p_booking_frequency_days: Number(input.booking_frequency_days),
    p_cancellation_cutoff_minutes: Number(input.cancellation_cutoff_minutes),
    p_is_active: Boolean(input.is_active),
    p_sort_order: Number(input.sort_order),
    p_timezone: input.timezone || 'Africa/Casablanca'
  })
  if (error) throw new Error(adminFacilitySaveMessage(error))
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('Facility save returned no data')
  return row as AdminFacility
}

export async function adminArchiveFacility(id: string, reason: FacilityArchiveReason): Promise<AdminFacility> {
  const { data, error } = await supabase.rpc('admin_archive_pitch', {
    p_pitch_id: id,
    p_reason_code: reason
  })
  if (error) throw new Error(message(error, 'Unable to archive facility'))
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('Facility archive returned no data')
  return row as AdminFacility
}

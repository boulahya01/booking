import { supabase } from './supabaseClient'
import { cachedRequest, invalidateRequestCache } from './requestCache'

export type MatchFailureCode =
  | 'authentication_required'
  | 'account_not_approved'
  | 'booking_not_found'
  | 'booking_not_owned'
  | 'booking_not_matchable'
  | 'match_not_found'
  | 'match_not_visible'
  | 'match_not_open'
  | 'match_not_active'
  | 'match_started'
  | 'match_full'
  | 'match_capacity_too_small'
  | 'already_joined'
  | 'not_joined'
  | 'organizer_required'
  | 'organizer_already_in_match'
  | 'match_has_public_players'
  | 'invalid_match_visibility'
  | 'invalid_reserved_spots'
  | 'reserved_spots_exceed_capacity'
  | 'invalid_reserved_name'
  | 'reserved_user_not_found'
  | 'reserved_user_already_in_match'
  | 'reserved_user_already_reserved'
  | 'reservation_not_found'
  | 'network'
  | 'unknown'

export class MatchApiError extends Error {
  code: MatchFailureCode
  constructor(code: MatchFailureCode, message?: string) {
    super(message || code)
    this.name = 'MatchApiError'
    this.code = code
  }
}

export type MatchRecord = {
  id: string
  booking_id: string
  organizer_id: string
  visibility: 'private' | 'open'
  reserved_spots: number
  status: 'active' | 'cancelled' | 'completed'
}

export type MatchReservation = {
  id: string
  match_id: string
  profile_id: string | null
  guest_name: string | null
  created_by: string
  created_at: string
}

export type UsernameSuggestion = {
  user_id: string
  username: string
  full_name: string
}

export type OpenMatch = {
  match_id: string
  booking_id: string
  pitch_id: string
  pitch_name: string
  location: string
  timezone: string
  sport_type: string | null
  starts_at: string
  ends_at: string
  organizer_id: string
  organizer_name: string
  organizer_username: string
  capacity: number
  reserved_spots: number
  joined_count: number
  spots_left: number
  joined_by_me: boolean
  organized_by_me: boolean
}

export type MyMatch = {
  match_id: string
  booking_id: string
  pitch_name: string
  location: string
  timezone: string
  sport_type: string | null
  starts_at: string
  ends_at: string
  organizer_name: string
  capacity: number
  reserved_spots: number
  joined_count: number
  member_role: 'organizer' | 'player' | 'reserved'
  visibility: 'private' | 'open'
}

export type MatchRosterMember = {
  user_id: string
  full_name: string
  username: string
  member_role: 'organizer' | 'player'
  joined_at: string
}

const knownCodes: MatchFailureCode[] = [
  'authentication_required','account_not_approved','booking_not_found','booking_not_owned','booking_not_matchable',
  'match_not_found','match_not_visible','match_not_open','match_not_active','match_started','match_full','match_capacity_too_small','already_joined','not_joined','organizer_required',
  'organizer_already_in_match','match_has_public_players','invalid_match_visibility','invalid_reserved_spots','reserved_spots_exceed_capacity',
  'invalid_reserved_name','reserved_user_not_found','reserved_user_already_in_match','reserved_user_already_reserved','reservation_not_found'
]

function throwMatchError(error: any): never {
  const message = String(error?.message || error || '').toLowerCase()
  const code = knownCodes.find((item) => message.includes(item))
    || (message.includes('network') || message.includes('failed to fetch') ? 'network' : 'unknown')
  throw new MatchApiError(code, error?.message)
}

function invalidateMatchData(bookingId?: string): void {
  invalidateRequestCache('open-matches')
  invalidateRequestCache('my-matches')
  invalidateRequestCache('availability:')
  if (bookingId) {
    invalidateRequestCache(`booking-details:${bookingId}`)
    invalidateRequestCache(`booking-roster:${bookingId}`)
  } else {
    invalidateRequestCache('booking-details:')
    invalidateRequestCache('booking-roster:')
  }
}

export async function listOpenMatches(force = false): Promise<OpenMatch[]> {
  return cachedRequest('open-matches', 12_000, async () => {
    const { data, error } = await supabase.rpc('list_open_matches')
    if (error) throwMatchError(error)
    return (Array.isArray(data) ? data : []) as OpenMatch[]
  }, force)
}

export async function listMyMatches(force = false): Promise<MyMatch[]> {
  return cachedRequest('my-matches', 15_000, async () => {
    const { data, error } = await supabase.rpc('list_my_matches')
    if (error) throwMatchError(error)
    return (Array.isArray(data) ? data : []) as MyMatch[]
  }, force)
}

export async function getMatchRoster(matchId: string, force = false): Promise<MatchRosterMember[]> {
  return cachedRequest(`match-roster:${matchId}`, 15_000, async () => {
    const { data, error } = await supabase.rpc('get_match_roster', { p_match_id: matchId })
    if (error) throwMatchError(error)
    return (Array.isArray(data) ? data : []) as MatchRosterMember[]
  }, force)
}

export async function searchUsernames(query: string, limit = 5): Promise<UsernameSuggestion[]> {
  const normalized = query.trim().replace(/^@+/, '').toLowerCase()
  if (normalized.length < 2) return []
  const safeLimit = Math.min(Math.max(limit, 1), 8)

  return cachedRequest(`username-search:${normalized}:${safeLimit}`, 60_000, async () => {
    const { data, error } = await supabase.rpc('search_usernames', {
      p_query: normalized,
      p_limit: safeLimit
    })
    if (error) throwMatchError(error)
    return (Array.isArray(data) ? data : []).map((row: any) => ({
      user_id: String(row.user_id),
      username: String(row.username),
      full_name: String(row.full_name || '')
    }))
  })
}

export async function joinOpenMatch(matchId: string) {
  const { data, error } = await supabase.rpc('join_open_match', { p_match_id: matchId })
  if (error) throwMatchError(error)
  invalidateMatchData()
  return Array.isArray(data) ? data[0] : data
}

export async function leaveOpenMatch(matchId: string) {
  const { error } = await supabase.rpc('leave_open_match', { p_match_id: matchId })
  if (error) throwMatchError(error)
  invalidateMatchData()
}

export async function createOpenMatch(bookingId: string, reservedSpots = 0): Promise<MatchRecord> {
  const { data, error } = await supabase.rpc('create_open_match', {
    p_booking_id: bookingId,
    p_reserved_spots: reservedSpots
  })
  if (error) throwMatchError(error)
  invalidateMatchData(bookingId)
  return (Array.isArray(data) ? data[0] : data) as MatchRecord
}

export async function updateReservedSpots(matchId: string, reservedSpots: number): Promise<MatchRecord> {
  const { data, error } = await supabase.rpc('update_match_reserved_spots', {
    p_match_id: matchId,
    p_reserved_spots: reservedSpots
  })
  if (error) throwMatchError(error)
  invalidateMatchData()
  return (Array.isArray(data) ? data[0] : data) as MatchRecord
}

export async function addMatchReservation(matchId: string, value: string): Promise<MatchReservation> {
  const clean = value.trim()
  const isUsername = clean.startsWith('@')
  const { data, error } = await supabase.rpc('add_match_reservation', {
    p_match_id: matchId,
    p_username: isUsername ? clean.slice(1) : null,
    p_guest_name: isUsername ? null : clean
  })
  if (error) throwMatchError(error)
  invalidateMatchData()
  return (Array.isArray(data) ? data[0] : data) as MatchReservation
}

export async function removeMatchReservation(matchId: string, reservationId: string) {
  const { error } = await supabase.rpc('remove_match_reservation', {
    p_match_id: matchId,
    p_reservation_id: reservationId
  })
  if (error) throwMatchError(error)
  invalidateMatchData()
}

export async function setMatchVisibility(matchId: string, visibility: 'private' | 'open'): Promise<MatchRecord> {
  const { data, error } = await supabase.rpc('set_match_visibility', {
    p_match_id: matchId,
    p_visibility: visibility
  })
  if (error) throwMatchError(error)
  invalidateMatchData()
  return (Array.isArray(data) ? data[0] : data) as MatchRecord
}

export function matchErrorCopy(code: MatchFailureCode, language: string | null | undefined): string {
  const ar = language === 'ar'
  const copy: Record<MatchFailureCode, [string,string]> = {
    authentication_required: ['Sign in to continue.','سجّل الدخول للمتابعة.'],
    account_not_approved: ['Your account cannot join matches yet.','حسابك غير مؤهل للمباريات بعد.'],
    booking_not_found: ['Booking not found.','لم نجد الحجز.'],
    booking_not_owned: ['This booking is not yours.','هذا الحجز ليس لك.'],
    booking_not_matchable: ['This booking cannot become a match.','لا يمكن فتح هذا الحجز للاعبين.'],
    match_not_found: ['Match not found.','لم نجد المباراة.'],
    match_not_visible: ['This match is not available to you.','هذه المباراة غير متاحة لك.'],
    match_not_open: ['This booking is closed.','هذا الحجز مغلق.'],
    match_not_active: ['This match is no longer active.','هذه المباراة لم تعد نشطة.'],
    match_started: ['This match has already started.','بدأت هذه المباراة بالفعل.'],
    match_full: ['This match is full.','المباراة ممتلئة.'],
    match_capacity_too_small: ['This facility does not have enough capacity for an open match.','سعة هذا الملعب غير كافية لفتح الحجز للاعبين.'],
    already_joined: ["You're already in.",'أنت موجود بالفعل.'],
    not_joined: ["You're not in this match.",'أنت غير منضم لهذه المباراة.'],
    organizer_required: ['Only the organizer can do that.','هذا الإجراء للمنظم فقط.'],
    organizer_already_in_match: ["You're the organizer.",'أنت منظم المباراة.'],
    match_has_public_players: ['Players already joined, so it cannot be closed yet.','انضم لاعبون بالفعل، لذلك لا يمكن إغلاق الحجز الآن.'],
    invalid_match_visibility: ['That visibility is not valid.','حالة الحجز غير صالحة.'],
    invalid_reserved_spots: ['Check the reserved spots.','تحقق من الأماكن المحجوزة.'],
    reserved_spots_exceed_capacity: ['Not enough spots left for that change.','لا توجد أماكن كافية لهذا التغيير.'],
    invalid_reserved_name: ['Enter an @username or a guest name.','أدخل @اسم_المستخدم أو اسم الضيف.'],
    reserved_user_not_found: ['That username was not found.','اسم المستخدم غير موجود.'],
    reserved_user_already_in_match: ['That user already joined.','هذا المستخدم منضم بالفعل.'],
    reserved_user_already_reserved: ['That player is already reserved.','هذا اللاعب محجوز بالفعل.'],
    reservation_not_found: ['Reserved player not found.','لم نجد اللاعب المحجوز.'],
    network: ['Connection problem. Try again.','مشكلة في الاتصال. حاول مجدداً.'],
    unknown: ['Something went wrong. Try again.','حدث خطأ. حاول مجدداً.']
  }
  return copy[code][ar ? 1 : 0]
}

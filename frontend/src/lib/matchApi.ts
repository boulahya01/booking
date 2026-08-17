import { supabase } from './supabaseClient'

export type MatchFailureCode =
  | 'authentication_required'
  | 'account_not_approved'
  | 'booking_not_found'
  | 'booking_not_owned'
  | 'booking_not_matchable'
  | 'match_not_found'
  | 'match_not_open'
  | 'match_started'
  | 'match_full'
  | 'already_joined'
  | 'not_joined'
  | 'organizer_required'
  | 'organizer_already_in_match'
  | 'match_has_public_players'
  | 'invalid_reserved_spots'
  | 'reserved_spots_exceed_capacity'
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

export type OpenMatch = {
  match_id: string
  booking_id: string
  pitch_id: string
  pitch_name: string
  location: string
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

export type MatchRosterMember = {
  user_id: string
  full_name: string
  username: string
  member_role: 'organizer' | 'player'
  joined_at: string
}

const knownCodes: MatchFailureCode[] = [
  'authentication_required','account_not_approved','booking_not_found','booking_not_owned','booking_not_matchable',
  'match_not_found','match_not_open','match_started','match_full','already_joined','not_joined','organizer_required',
  'organizer_already_in_match','match_has_public_players','invalid_reserved_spots','reserved_spots_exceed_capacity'
]

function throwMatchError(error: any): never {
  const message = String(error?.message || error || '').toLowerCase()
  const code = knownCodes.find((item) => message.includes(item))
    || (message.includes('network') || message.includes('failed to fetch') ? 'network' : 'unknown')
  throw new MatchApiError(code, error?.message)
}

export async function listOpenMatches(): Promise<OpenMatch[]> {
  const { data, error } = await supabase.rpc('list_open_matches')
  if (error) throwMatchError(error)
  return Array.isArray(data) ? data : []
}

export async function getMatchRoster(matchId: string): Promise<MatchRosterMember[]> {
  const { data, error } = await supabase.rpc('get_match_roster', { p_match_id: matchId })
  if (error) throwMatchError(error)
  return Array.isArray(data) ? data : []
}

export async function joinOpenMatch(matchId: string) {
  const { data, error } = await supabase.rpc('join_open_match', { p_match_id: matchId })
  if (error) throwMatchError(error)
  return Array.isArray(data) ? data[0] : data
}

export async function leaveOpenMatch(matchId: string) {
  const { error } = await supabase.rpc('leave_open_match', { p_match_id: matchId })
  if (error) throwMatchError(error)
}

export async function createOpenMatch(bookingId: string, reservedSpots = 0) {
  const { data, error } = await supabase.rpc('create_open_match', {
    p_booking_id: bookingId,
    p_reserved_spots: reservedSpots
  })
  if (error) throwMatchError(error)
  return Array.isArray(data) ? data[0] : data
}

export async function updateReservedSpots(matchId: string, reservedSpots: number) {
  const { data, error } = await supabase.rpc('update_match_reserved_spots', {
    p_match_id: matchId,
    p_reserved_spots: reservedSpots
  })
  if (error) throwMatchError(error)
  return Array.isArray(data) ? data[0] : data
}

export function matchErrorCopy(code: MatchFailureCode, language: string | null | undefined): string {
  const ar = language === 'ar'
  const copy: Record<MatchFailureCode, [string,string]> = {
    authentication_required: ['Sign in to continue.','سجّل الدخول للمتابعة.'],
    account_not_approved: ['Your account cannot join matches yet.','حسابك غير جاهز للمباريات بعد.'],
    booking_not_found: ['Booking not found.','لم نجد الحجز.'], booking_not_owned: ['This booking is not yours.','هذا الحجز ليس لك.'],
    booking_not_matchable: ['This booking cannot become a match.','لا يمكن تحويل هذا الحجز إلى مباراة.'],
    match_not_found: ['Match not found.','لم نجد المباراة.'], match_not_open: ['This match is not open.','هذه المباراة ليست مفتوحة.'],
    match_started: ['This match has already started.','بدأت هذه المباراة بالفعل.'], match_full: ['This match is full.','المباراة ممتلئة.'],
    already_joined: ["You're already in.",'أنت منضم بالفعل.'], not_joined: ["You're not in this match.",'أنت غير منضم لهذه المباراة.'],
    organizer_required: ['Only the organizer can do that.','هذا الإجراء للمنظم فقط.'],
    organizer_already_in_match: ["You're the organizer.",'أنت منظم المباراة.'],
    match_has_public_players: ['Keep the match open while players are joined.','لا يمكن جعل المباراة خاصة بعد انضمام لاعبين.'],
    invalid_reserved_spots: ['Check the reserved spots.','تحقق من الأماكن المحجوزة.'],
    reserved_spots_exceed_capacity: ['Not enough spots left for that change.','لا توجد أماكن كافية لهذا التغيير.'],
    network: ['Connection problem. Try again.','مشكلة في الاتصال. حاول مجدداً.'], unknown: ['Something went wrong. Try again.','حدث خطأ. حاول مجدداً.']
  }
  return copy[code][ar ? 1 : 0]
}

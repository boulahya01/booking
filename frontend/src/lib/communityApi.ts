import { supabase } from './supabaseClient'
import { authState } from './stores/auth'
import { get } from 'svelte/store'
import { cachedRequest, invalidateRequestCache } from './requestCache'

export type SharedMatch = { booking_id: string; pitch_name: string; location: string; starts_at: string; ends_at: string; timezone: string; sport_type: string | null; spots_left: number }
export type CommunityMessage = { id: string; booking_id: string | null; sender_id: string; username: string; full_name: string; body: string; client_id: string; created_at: string; shared_booking_id: string | null; shared_match: SharedMatch | null }
export type CommunityRoom = { booking_id: string | null; title: string; starts_at?: string; timezone?: string; can_send: boolean; muted: boolean; last_read: string; unread?: number }
export type PlayerProfile = { id: string; username: string; full_name: string; bio: string; sports: string[]; discoverable: boolean; available_until: string | null; blocked: boolean }
export const communitySports = [
  { value: 'football', en: 'Football', ar: 'كرة القدم' }, { value: 'basketball', en: 'Basketball', ar: 'كرة السلة' },
  { value: 'handball', en: 'Handball', ar: 'كرة اليد' }, { value: 'volleyball', en: 'Volleyball', ar: 'الكرة الطائرة' },
  { value: 'tennis', en: 'Tennis', ar: 'التنس' }, { value: 'padel', en: 'Padel', ar: 'البادل' },
  { value: 'badminton', en: 'Badminton', ar: 'الريشة الطائرة' }, { value: 'other', en: 'Other sports', ar: 'رياضات أخرى' }
]
export class CommunityError extends Error {
  constructor(public code: string) { super(code) }
}
async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const owner = get(authState).user?.id
  if (!owner) throw new CommunityError('authentication_required')
  const { data, error } = await supabase.rpc(name, params).abortSignal(AbortSignal.timeout(12_000))
  if (get(authState).user?.id !== owner) throw new CommunityError('authentication_required')
  if (error) {
    const text = String(error.message || '')
    const code = ['community_access_required', 'community_room_closed', 'community_invalid_message', 'community_match_not_open', 'community_rate_limited', 'community_retry_mismatch', 'community_invalid_profile', 'account_not_approved'].find(code => text.includes(code))
    throw new CommunityError(code || 'network')
  }
  return data as T
}
export function communityError(error: unknown, ar: boolean) {
  const code = error instanceof CommunityError ? error.code : 'network'
  const copy: Record<string, [string, string]> = {
    community_access_required: ['This conversation is unavailable. Join the match first.', 'هذه المحادثة غير متاحة. انضم إلى المباراة أولاً.'],
    account_not_approved: ['Verify your student ID to use Community.', 'تحقق من بطاقة الطالب لاستخدام المجتمع.'],
    authentication_required: ['Sign in again to continue.', 'سجّل الدخول مجدداً للمتابعة.'],
    community_room_closed: ['This conversation is now read-only.', 'أصبحت هذه المحادثة للقراءة فقط.'],
    community_match_not_open: ['This match is no longer open. Choose another match.', 'لم تعد هذه المباراة مفتوحة. اختر مباراة أخرى.'],
    community_rate_limited: ['You’re sending quickly. Try again in a minute.', 'ترسل بسرعة. حاول مجدداً بعد دقيقة.'],
    community_invalid_message: ['Write a message of up to 1,000 characters.', 'اكتب رسالة لا تتجاوز ١٠٠٠ حرف.'],
    community_invalid_profile: ['Check your player details and try again.', 'راجع معلومات اللاعب وحاول مجدداً.'],
    community_retry_mismatch: ['Retry the original message before writing another.', 'أعد إرسال الرسالة الأصلية قبل كتابة رسالة أخرى.'],
    network: ['Couldn’t connect. Your message is kept here; retry safely.', 'تعذر الاتصال. رسالتك محفوظة هنا، ويمكنك إعادة المحاولة.']
  }
  return (copy[code] || copy.network)[ar ? 1 : 0]
}
const scope = (bookingId?: string | null) => bookingId || 'lobby'
export const getCommunityRoom = (bookingId?: string | null) => rpc<CommunityRoom>('get_community_room', { p_booking_id: bookingId || null })
export function listCommunityMessages(bookingId?: string | null, before?: string, after?: string, force = false) {
  const params = { p_booking_id: bookingId || null, p_before: before || null, p_after: after || null, p_limit: 30 }
  if (before || after) return rpc<CommunityMessage[]>('list_community_messages', params)
  return cachedRequest('community:messages:' + scope(bookingId), 10_000, () => rpc<CommunityMessage[]>('list_community_messages', params), force)
}
export const getCommunityMessage = (id: string) => rpc<CommunityMessage | null>('get_community_message', { p_id: id })
export async function sendCommunityMessage(input: { body: string; clientId: string; bookingId?: string | null; sharedBookingId?: string | null }) {
  const row = await rpc<CommunityMessage>('send_community_message', { p_body: input.body, p_client_id: input.clientId, p_booking_id: input.bookingId || null, p_shared_booking_id: input.sharedBookingId || null })
  invalidateRequestCache('community:')
  return row
}
export const updateCommunityRead = (bookingId: string | null, lastRead?: string, muted?: boolean) => rpc<void>('update_community_read', { p_booking_id: bookingId, p_last_read: lastRead || null, p_muted: muted ?? null })
export const listCommunityChats = (force = false) => cachedRequest('community:chats', 10_000, () => rpc<CommunityRoom[]>('list_community_chats'), force)
export const getPlayerProfile = (username: string, force = false) => cachedRequest('community:player:' + username, 30_000, () => rpc<PlayerProfile | null>('get_player_profile', { p_username: username }), force)
export const listCommunityPlayers = (query = '', after = '', force = false) => cachedRequest('community:players:' + query + ':' + after, 20_000, () => rpc<PlayerProfile[]>('list_community_players', { p_query: query, p_after: after, p_limit: 24 }), force)
export async function updateCommunityProfile(bio: string, sports: string[], discoverable: boolean, available: boolean) {
  const profile = await rpc<PlayerProfile>('update_community_profile', { p_bio: bio, p_sports: sports, p_discoverable: discoverable, p_available: available })
  invalidateRequestCache('community:'); return profile
}
export async function setCommunityBlock(userId: string, blocked: boolean) {
  await rpc<void>('set_community_block', { p_user_id: userId, p_blocked: blocked }); invalidateRequestCache('community:')
}
export async function hideCommunityMessage(id: string) {
  await rpc<void>('hide_community_message', { p_id: id }); invalidateRequestCache('community:')
}
export function subscribeCommunity(bookingId: string | null, receive: (id: string) => void, reconnect: () => void) {
  const channel = supabase.channel('community:' + scope(bookingId), { config: { private: true } })
    .on('broadcast', { event: 'message' }, ({ payload }) => { if (/^[0-9]+$/.test(String(payload?.id || ''))) receive(String(payload.id)) })
    .subscribe(status => { if (status === 'SUBSCRIBED') reconnect() })
  return () => { void supabase.removeChannel(channel) }
}

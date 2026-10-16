import { writable } from 'svelte/store'
import { authState } from './auth'
import type { CommunityRoom } from '$lib/communityApi'
export const communityUnread = writable(0)
export const communityDrafts = new Map<string, { body: string; clientId?: string; sharedBookingId?: string | null }>()
const rooms = new Map<string, { unread: number; muted: boolean }>()
const publish = () => communityUnread.set([...rooms.values()].reduce((sum, room) => sum + (room.muted ? 0 : room.unread), 0))
export function setCommunityRooms(values: CommunityRoom[]) {
  rooms.clear(); values.forEach(room => rooms.set(room.booking_id || 'lobby', { unread: Number(room.unread || 0), muted: room.muted })); publish()
}
export function setCommunityRoomUnread(bookingId: string | null, unread: number, muted: boolean) {
  rooms.set(bookingId || 'lobby', { unread, muted }); publish()
}
let identity: string | null = null
authState.subscribe(state => {
  const next = state.user?.id || null
  if (next !== identity) { communityDrafts.clear(); rooms.clear(); communityUnread.set(0); identity = next }
})

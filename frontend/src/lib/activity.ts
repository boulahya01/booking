import type { MyBooking } from './bookingApi'
import type { MyMatch } from './matchApi'

export type Activity = {
  id: string
  title: string
  startsAt: string
  endsAt: string
  timezone: string
  role: 'booked' | 'hosting' | 'joined' | 'reserved'
  cancelled: boolean
}

export function buildActivities(bookings: MyBooking[], matches: MyMatch[]): Activity[] {
  const items = new Map<string, Activity>()
  for (const booking of bookings) {
    items.set(booking.id, {
      id: booking.id, title: booking.pitches?.name || 'Facility', startsAt: booking.starts_at,
      endsAt: booking.ends_at, timezone: booking.pitches?.timezone || 'Africa/Casablanca',
      role: 'booked', cancelled: booking.status === 'cancelled'
    })
  }
  for (const match of matches) {
    const owned = items.get(match.booking_id)
    if (owned) {
      if (match.member_role === 'organizer') owned.role = 'hosting'
      continue
    }
    items.set(match.booking_id, {
      id: match.booking_id, title: match.pitch_name, startsAt: match.starts_at,
      endsAt: match.ends_at, timezone: match.timezone || 'Africa/Casablanca',
      role: match.member_role === 'organizer' ? 'hosting' : match.member_role === 'reserved' ? 'reserved' : 'joined',
      cancelled: false
    })
  }
  return [...items.values()].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
}

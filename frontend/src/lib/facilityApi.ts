import { supabase } from './supabaseClient'
import { cachedRequest, invalidateRequestCache } from './requestCache'

export type FacilitySummary = {
  id: string
  name: string
  location: string
  open_time: string
  close_time: string
  capacity: number
  sport_type: string | null
}

export type FacilityDetails = FacilitySummary & {
  timezone: string
  booking_frequency_enabled: boolean
  booking_frequency_days: number
}

const FACILITY_TTL = 5 * 60 * 1000

export async function listActiveFacilities(force = false): Promise<FacilitySummary[]> {
  return cachedRequest('facilities:active', FACILITY_TTL, async () => {
    const { data, error } = await supabase
      .from('pitches')
      .select('id,name,location,open_time,close_time,capacity,sport_type')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return (data ?? []) as FacilitySummary[]
  }, force)
}

export async function getFacility(facilityId: string, force = false): Promise<FacilityDetails | null> {
  return cachedRequest(`facility:${facilityId}`, FACILITY_TTL, async () => {
    const { data, error } = await supabase
      .from('pitches')
      .select('id,name,location,open_time,close_time,capacity,sport_type,timezone,booking_frequency_enabled,booking_frequency_days')
      .eq('id', facilityId)
      .maybeSingle()

    if (error) throw error
    return (data as FacilityDetails | null) ?? null
  }, force)
}

export function invalidateFacilities(facilityId?: string): void {
  invalidateRequestCache('facilities:')
  if (facilityId) invalidateRequestCache(`facility:${facilityId}`)
  else invalidateRequestCache('facility:')
}

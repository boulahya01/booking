// @ts-ignore Import works in Deno runtime
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
// @ts-ignore Import works in Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// @ts-ignore Deno global available at runtime
const supabaseUrl = Deno.env.get("SUPABASE_URL")
// @ts-ignore Deno global available at runtime
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[available-slots] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl || "", supabaseServiceKey || "")

interface VirtualSlot {
    id: string
    pitch_id: string
    pitch_name: string
    datetime_start: string
    datetime_end: string
    is_available: boolean
    booker_id?: string
    booker_name?: string
}

interface Pitch {
    id: string
    name: string
    open_time: string
    close_time: string
}

interface Booking {
    id: string
    pitch_id: string
    slot_datetime: string
    status: string
    user_id: string
    profiles: {
        id: string
        full_name: string
    }
}

const parseHourFromTime = (timeStr: string): number => {
    if (!timeStr) return 8
    const parts = timeStr.split(":")
    return parseInt(parts[0], 10) || 8
}

function getCorsHeaders(req: Request) {
    const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || "*"
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS, HEAD",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Accept, x-client-info",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
    }
}

// Cleanup function: mark past bookings as completed (fallback if job scheduler doesn't run)
async function cleanupPastBookings() {
    try {
        const now = new Date()

        // Call the database function to auto-complete past bookings
        const { data, error } = await supabase
            .rpc('auto_complete_past_bookings')

        if (error) {
            console.warn("[available-slots] Warning: Could not auto-complete past bookings:", error)
            return
        }

        console.log(`[available-slots] Auto-completion executed successfully`)
    } catch (error) {
        console.warn("[available-slots] Cleanup error (non-fatal):", error)
    }
}

serve(async (req: Request): Promise<Response> => {
    const corsHeaders = getCorsHeaders(req)

    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (req.method !== "POST" && req.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        })
    }

    try {
        // Run cleanup as background task (don't wait for it, don't fail if it errors)
        cleanupPastBookings().catch(err => console.warn("[available-slots] Cleanup failed silently:", err))

        console.log("[available-slots] Starting slot generation")

        let pitchId: string | undefined

        if (req.method === "POST") {
            const body = (await req.json()) as { pitch_id?: string }
            pitchId = body.pitch_id
        } else {
            // @ts-ignore URL is available in Deno runtime
            const url = new URL(req.url)
            pitchId = url.searchParams.get("pitch_id") || undefined
        }

        console.log(`[available-slots] Requested pitch_id: ${pitchId}`)

        let query = supabase.from("pitches").select("id,name,open_time,close_time")

        if (pitchId) {
            query = query.eq("id", pitchId)
        }

        const { data: pitches, error: pitchError } = await query

        if (pitchError) {
            console.error(`[available-slots] Failed to fetch pitches:`, pitchError)
            return new Response(JSON.stringify([]), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            })
        }

        if (!pitches || pitches.length === 0) {
            console.warn(`[available-slots] No pitches found`)
            return new Response(JSON.stringify([]), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            })
        }

        console.log(`[available-slots] Found ${pitches.length} pitch(es)`)
        console.log(`[available-slots] Slot generation logic: slots start from openHour and go up to (but not including) closeHour`)

        const virtualSlots: VirtualSlot[] = []
        const now = new Date()

        console.log(`[available-slots] Current time (UTC): ${now.toISOString()}`)
        console.log(`[available-slots] Current time (Local): ${now.toString()}`)
        console.log(`[available-slots] Current UTC Hour: ${now.getUTCHours()}, Local Hour: ${now.getHours()}`)

        // Calculate 24-hour window
        const cutoffTime = new Date(now)
        cutoffTime.setUTCHours(cutoffTime.getUTCHours() + 24)
        console.log(`[available-slots] 24-hour window: ${now.toISOString()} to ${cutoffTime.toISOString()}`)

        // Compute first showable slot using UTC so comparisons are consistent
        // RULE: If current time is past :00:00 (e.g. 01:35 UTC), the current hour's slot is NOT bookable.
        // Users can only book future hours. Current hour slot is always excluded if any minutes passed.
        const firstShowable = new Date(now)
        if (now.getUTCMinutes() > 0 || now.getUTCSeconds() > 0 || now.getUTCMilliseconds() > 0) {
            // Any minutes past the hour — current hour slot is NO LONGER AVAILABLE
            // Move to next hour start
            firstShowable.setUTCHours(now.getUTCHours() + 1, 0, 0, 0)
            console.log(`[available-slots] Current UTC time has passed :00 mark. Current hour slot EXCLUDED. First showable: ${firstShowable.toISOString()}`)
        } else {
            // Exactly on the hour boundary — current hour slot is still available
            firstShowable.setUTCHours(now.getUTCHours(), 0, 0, 0)
            console.log(`[available-slots] Current UTC time is exactly at :00 mark. Current hour slot still available. First showable: ${firstShowable.toISOString()}`)
        }
        console.log(`[available-slots] First showable slot (UTC): ${firstShowable.toISOString()}`)

        for (const pitch of pitches) {
            console.log(`[available-slots] Processing pitch: ${pitch.name} (${pitch.id})`)

            const openHour = parseHourFromTime(pitch.open_time)
            const closeHour = parseHourFromTime(pitch.close_time)

            console.log(
                `[available-slots] Operating hours: ${openHour}:00 - ${closeHour}:00 (open_time: ${pitch.open_time}, close_time: ${pitch.close_time})`
            )
            console.log(`[available-slots] Generating slots: hour >= ${openHour} AND hour < ${closeHour}`)

            const { data: bookings, error: bookingError } = await supabase
                .from("bookings")
                .select("id,pitch_id,slot_datetime,status,user_id,profiles(id,full_name)")
                .eq("pitch_id", pitch.id)
                .eq("status", "active")

            if (bookingError) {
                console.warn(`[available-slots] Warning: Failed to fetch bookings for pitch ${pitch.id}:`, bookingError)
            }

            const bookingsList = bookings || []
            console.log(`[available-slots] Fetched ${bookingsList.length} active bookings for pitch ${pitch.id}`)

            // Generate slots for next 24 hours only (using absolute time, not calendar days)
            const slots24HoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

            // Generate slots using UTC to ensure consistent epoch-based comparisons.
            for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
                const dayStart = new Date(now)
                dayStart.setUTCDate(dayStart.getUTCDate() + dayOffset)
                dayStart.setUTCHours(0, 0, 0, 0) // Midnight UTC

                const dayEnd = new Date(dayStart)
                dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

                // Only process days within cutoff
                if (dayEnd <= now || dayStart >= cutoffTime) {
                    continue
                }

                console.log(`[available-slots] Generating slots for day offset ${dayOffset}: ${dayStart.toISOString()}`)

                // Generate slots from openHour (inclusive) to closeHour (exclusive)
                for (let hour = openHour; hour < closeHour; hour++) {
                    const slotStart = new Date(dayStart)
                    slotStart.setUTCHours(hour, 0, 0, 0) // Use UTC hours
                    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000)

                    const dayName = slotStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    const slotHour = slotStart.getUTCHours()
                    const slotTimeStr = `${slotHour}:00 on ${dayName}`

                    // Only include slots that are on-or-after the first showable boundary
                    if (slotStart < firstShowable || slotStart >= cutoffTime) {
                        console.log(`[available-slots] SKIPPING slot ${slotTimeStr}: slotStart=${slotStart.toISOString()}, firstShowable=${firstShowable.toISOString()}, cutoff=${cutoffTime.toISOString()}`)
                        continue
                    }

                    const slotId = `${pitch.id}-${slotStart.toISOString()}`
                    console.log(`[available-slots] INCLUDING slot ${slotTimeStr}: slotStart=${slotStart.toISOString()}, firstShowable=${firstShowable.toISOString()}`)

                    // Check if this slot has an active booking (match on UTC date and hour for consistency)
                    const booking = bookingsList.find((booking) => {
                        if (!booking.slot_datetime) return false
                        const bookingTime = new Date(booking.slot_datetime)
                        return (
                            bookingTime.getUTCFullYear() === slotStart.getUTCFullYear() &&
                            bookingTime.getUTCMonth() === slotStart.getUTCMonth() &&
                            bookingTime.getUTCDate() === slotStart.getUTCDate() &&
                            bookingTime.getUTCHours() === slotStart.getUTCHours()
                        )
                    })
                    const isBooked = !!booking

                    // Use canonical UTC ISO strings for start/end so clients can
                    // reliably parse with `new Date(...)` and compare epochs.
                    const slot: VirtualSlot = {
                        id: slotId,
                        pitch_id: pitch.id,
                        pitch_name: pitch.name,
                        datetime_start: slotStart.toISOString(),
                        datetime_end: slotEnd.toISOString(),
                        is_available: !isBooked,
                    }

                    // Add booker info if slot is booked
                    if (booking && booking.profiles) {
                        slot.booker_id = booking.user_id
                        slot.booker_name = booking.profiles.full_name
                    }

                    virtualSlots.push(slot)
                }
            }
        }

        virtualSlots.sort(
            (a, b) => new Date(a.datetime_start).getTime() - new Date(b.datetime_start).getTime()
        )

        console.log(`[available-slots] Returning ${virtualSlots.length} total virtual slots`)

        return new Response(JSON.stringify(virtualSlots), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        })
    } catch (error: unknown) {
        console.error("[available-slots] Error:", error)
        const errorMsg = error instanceof Error ? error.message : String(error)
        return new Response(JSON.stringify({ error: "Failed to fetch available slots", details: errorMsg }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        })
    }
})


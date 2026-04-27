// @ts-ignore Import works in Deno runtime
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
// @ts-ignore Import works in Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// @ts-ignore Deno global available at runtime
const supabaseUrl = Deno.env.get("SUPABASE_URL")
// @ts-ignore Deno global available at runtime
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
// @ts-ignore Deno global available at runtime
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173"

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("[available-slots] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  throw new Error("Missing required environment variables")
}

const supabase = createClient(supabaseUrl || "", supabaseServiceKey || "")

interface VirtualSlot {
  id: string
  pitch_id: string
  pitch_name: string
  datetime_start: string
  datetime_end: string
  is_available: boolean
  // PII removed - booker info not returned to clients
}

interface Pitch {
  id: string
  name: string
  open_time: string
  close_time: string
}

const parseHourFromTime = (timeStr: string): number => {
  if (!timeStr) return 8
  const parts = timeStr.split(":")
  return parseInt(parts[0], 10) || 8
}

// Rate limiting
const RATE_LIMIT_WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 60
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) return false
  record.count++
  return true
}

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown"
}

// CORS headers
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin")
  const allowed = origin === allowedOrigin ? origin : allowedOrigin
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Accept, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  }
}

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Auth verification helper
async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const token = authHeader.split("Bearer ")[1]
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user.id
  } catch {
    return null
  }
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  // Rate limiting
  const ip = getClientIP(req)
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  // Require authentication
  const userId = await verifyAuth(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  try {
    let pitchId: string | undefined

    if (req.method === "POST") {
      const body = await req.json() as { pitch_id?: string }
      pitchId = body.pitch_id
    } else {
      // @ts-ignore URL is available in Deno runtime
      const url = new URL(req.url)
      pitchId = url.searchParams.get("pitch_id") || undefined
    }

    // Validate pitch_id format if provided
    if (pitchId && !UUID_REGEX.test(pitchId)) {
      return new Response(JSON.stringify({ error: "Invalid pitch ID format" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

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
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const virtualSlots: VirtualSlot[] = []
    const now = new Date()

    // Calculate 24-hour window
    const cutoffTime = new Date(now)
    cutoffTime.setUTCHours(cutoffTime.getUTCHours() + 24)

    // Compute first showable slot using UTC so comparisons are consistent
    const firstShowable = new Date(now)
    if (now.getUTCMinutes() > 0 || now.getUTCSeconds() > 0 || now.getUTCMilliseconds() > 0) {
      firstShowable.setUTCHours(now.getUTCHours() + 1, 0, 0, 0)
    } else {
      firstShowable.setUTCHours(now.getUTCHours(), 0, 0, 0)
    }

    for (const pitch of pitches) {
      let openHour = parseHourFromTime(pitch.open_time)
      let closeHour = parseHourFromTime(pitch.close_time)

      if (pitch.close_time === '24:00') {
        closeHour = 24
      }

      // Fetch bookings WITHOUT profile info (no PII leak)
      const { data: bookings, error: bookingError } = await supabase
        .from("bookings")
        .select("id,pitch_id,slot_datetime,status")
        .eq("pitch_id", pitch.id)
        .eq("status", "active")

      if (bookingError) {
        console.warn(`[available-slots] Warning: Failed to fetch bookings for pitch ${pitch.id}:`, bookingError)
      }

      const bookingsList = bookings || []

      // Generate slots for next 24 hours only
      const slots24HoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
        const dayStart = new Date(now)
        dayStart.setUTCDate(dayStart.getUTCDate() + dayOffset)
        dayStart.setUTCHours(0, 0, 0, 0)

        const dayEnd = new Date(dayStart)
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

        if (dayEnd <= now || dayStart >= cutoffTime) {
          continue
        }

        for (let hour = openHour; hour < closeHour; hour++) {
          const slotStart = new Date(dayStart)
          slotStart.setUTCHours(hour, 0, 0, 0)
          const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000)

          if (slotStart < firstShowable || slotStart >= cutoffTime) {
            continue
          }

          const slotId = `${pitch.id}-${slotStart.toISOString()}`

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

          virtualSlots.push({
            id: slotId,
            pitch_id: pitch.id,
            pitch_name: pitch.name,
            datetime_start: slotStart.toISOString(),
            datetime_end: slotEnd.toISOString(),
            is_available: !isBooked,
          })
        }
      }
    }

    virtualSlots.sort(
      (a, b) => new Date(a.datetime_start).getTime() - new Date(b.datetime_start).getTime()
    )

    return new Response(JSON.stringify(virtualSlots), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (error: unknown) {
    console.error("[available-slots] Error:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch available slots" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
})

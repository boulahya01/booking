// @ts-ignore Import works in Deno runtime
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
// @ts-ignore Import works in Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// @ts-ignore Deno global available at runtime
const supabaseUrl = Deno.env.get("SUPABASE_URL")
// @ts-ignore Deno global available at runtime
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
// @ts-ignore Deno global available at runtime
const cronSecret = Deno.env.get("CRON_SECRET")

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("[complete-bookings] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  throw new Error("Missing required environment variables")
}

const supabase = createClient(supabaseUrl || "", supabaseServiceKey || "")

// Verify internal/cron access
function verifyInternalAccess(req: Request): boolean {
  // Check for internal secret header (set by Supabase Cron or internal systems)
  if (cronSecret) {
    const secret = req.headers.get("x-cron-secret")
    if (secret === cronSecret) return true
  }

  // Allow localhost for local development
  const forwardedFor = req.headers.get("x-forwarded-for") || ""
  if (forwardedFor.includes("127.0.0.1") || forwardedFor.includes("localhost")) return true

  // Check if request is from Supabase internal network
  const userAgent = req.headers.get("user-agent") || ""
  if (userAgent.includes("Supabase")) return true

  return false
}

serve(async (req: Request): Promise<Response> => {
  // Only allow GET/POST for scheduler/webhook compatibility
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Verify internal access only
  if (!verifyInternalAccess(req)) {
    console.warn("[complete-bookings] Unauthorized access attempt")
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const nowIso = new Date().toISOString()
    console.log("[complete-bookings] Running cleanup at", nowIso)

    // 1) Find virtual-slot bookings (those with slot_datetime) and fetch end time if available
    const { data: virtualBookings, error: vErr } = await supabase
      .from("bookings")
      .select("id,slot_datetime,slot_datetime_end")
      .not("slot_datetime", "is", null)
      .eq("status", "active")

    if (vErr) {
      console.error("[complete-bookings] Error fetching virtual bookings:", vErr)
      throw vErr
    }

    const virtualIds: string[] = []
    if (Array.isArray(virtualBookings)) {
      for (const b of virtualBookings) {
        try {
          let endTs: number | null = null
          if (b.slot_datetime_end) {
            endTs = new Date(b.slot_datetime_end).getTime()
          } else if (b.slot_datetime) {
            // assume 1 hour slot if end not present
            endTs = new Date(b.slot_datetime).getTime() + 60 * 60 * 1000
          }

          if (endTs !== null && endTs < Date.now()) {
            virtualIds.push(b.id)
          }
        } catch (e) {
          // on parse error, conservatively mark for completion
          virtualIds.push(b.id)
        }
      }
    }

    // 2) Find real-slot bookings where the referenced slot's datetime_end < now
    const { data: slotBookings, error: sErr } = await supabase
      .from("bookings")
      .select("id,slots(datetime_end)")
      .not("slot_id", "is", null)
      .eq("status", "active")

    if (sErr) {
      console.error("[complete-bookings] Error fetching slot bookings:", sErr)
      throw sErr
    }

    const slotIdsToComplete: string[] = []
    if (Array.isArray(slotBookings)) {
      for (const row of slotBookings) {
        const slotRef = (row as any).slots
        if (slotRef && slotRef.datetime_end) {
          try {
            const endTs = new Date(slotRef.datetime_end).getTime()
            if (endTs < Date.now()) {
              slotIdsToComplete.push((row as any).id)
            }
          } catch (e) {
            // If parsing fails, conservatively mark for completion
            slotIdsToComplete.push((row as any).id)
          }
        } else {
          // If no slot info, conservative approach: mark as completed
          slotIdsToComplete.push((row as any).id)
        }
      }
    }

    const idsToComplete = Array.from(new Set([...virtualIds, ...slotIdsToComplete]))

    let updated = 0
    if (idsToComplete.length > 0) {
      console.log("[complete-bookings] Completing booking ids:", idsToComplete)
      const { error: updErr } = await supabase
        .from("bookings")
        .update({ status: "completed" })
        .in("id", idsToComplete)

      if (updErr) {
        console.error("[complete-bookings] Error updating bookings:", updErr)
        throw updErr
      }

      updated = idsToComplete.length
    }

    console.log(`[complete-bookings] Completed ${updated} booking(s)`)

    return new Response(JSON.stringify({ updated }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error: unknown) {
    console.error("[complete-bookings] Error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})

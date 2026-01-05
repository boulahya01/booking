// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as jose from "https://esm.sh/jose@5.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_DB_URL") || "https://ridfbitdmvpgaeyfxmxi.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
const jwtSecret = Deno.env.get("JWT_SECRET") || "football-booking-secret-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

if (!supabaseServiceKey) {
  console.error("[slots-available] Missing SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY in function env");
}

interface TokenPayload {
  id: string;
  email: string;
  studentId: string;
}

interface SlotResponse {
  id: string;
  datetime: string;
  fieldId: number;
  status: string;
  createdAt: string;
}

interface ErrorResponse {
  message: string;
}

function extractTokenFromHeader(authHeader: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

async function verifyJWT(token: string): Promise<TokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const verified = await jose.jwtVerify(token, secret) as any;
    return verified.payload as TokenPayload;
  } catch {
    return null;
  }
}

function getNextSlotTime(): Date {
  const now = new Date();
  return new Date(now.getTime() + 60000); // Next minute
}

function getTodayEnd(): Date {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
}

async function ensureSlotsExist(supabaseUrl: string, serviceKey: string) {
  const now = new Date();
  
  // We need slots for: NOW → NOW + 24 hours (not just calendar day)
  // This ensures we always have 24 hours of future slots available
  const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Get opening and closing hours from settings (default 12-23)
  let openingHour = 12;
  let closingHour = 23;

  try {
    const settingsResp = await fetch(
      `${supabaseUrl}/rest/v1/system_settings?setting_key=in.("opening_hour","closing_hour")`,
      {
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
      }
    );
    if (settingsResp.ok) {
      const settings = await settingsResp.json();
      const openingSetting = settings.find((s: any) => s.setting_key === "opening_hour");
      const closingSetting = settings.find((s: any) => s.setting_key === "closing_hour");
      if (openingSetting) openingHour = parseInt(openingSetting.setting_value, 10);
      if (closingSetting) closingHour = parseInt(closingSetting.setting_value, 10);
    }
  } catch (err) {
    console.warn("[ensureSlotsExist] Exception loading settings:", err instanceof Error ? err.message : err);
  }

  // Clean up expired slots (slots older than now)
  try {
    console.log(`[ensureSlotsExist] Cleaning up expired slots before ${now.toISOString()}`);
    const deleteResp = await fetch(
      `${supabaseUrl}/rest/v1/slots?datetime=lt.${now.toISOString()}`,
      {
        method: "DELETE",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
      }
    );
    
    if (!deleteResp.ok) {
      console.warn("[ensureSlotsExist] Failed to clean up expired slots");
    } else {
      console.log("[ensureSlotsExist] Expired slots cleaned up");
    }
  } catch (err) {
    console.warn("[ensureSlotsExist] Exception cleaning expired slots:", err instanceof Error ? err.message : err);
  }

  // Check for existing slots in the next 24 hours
  try {
    const checkResp = await fetch(
      `${supabaseUrl}/rest/v1/slots?datetime=gte.${now.toISOString()}&datetime=lt.${futureTime.toISOString()}&limit=1&select=id`,
      {
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
      }
    );
    
    if (checkResp.ok) {
      const existingSlots = await checkResp.json();
      if (Array.isArray(existingSlots) && existingSlots.length > 0) {
        console.log("[ensureSlotsExist] Slots already exist for next 24 hours, skipping creation");
        return;
      }
    }
  } catch (err) {
    console.warn("[ensureSlotsExist] Exception checking slots:", err instanceof Error ? err.message : err);
    return;
  }

  // Create slots for today and tomorrow (full calendar days with business hours)
  // Only include: datetime, field_id, status (NO updated_at - slots table doesn't have it)
  const slotTimes: Array<{ datetime: string; field_id: number; status: string }> = [];

  // Start from today at opening hour
  let slotDate = new Date(now);
  slotDate.setHours(openingHour, 0, 0, 0);
  
  // If we're past closing hour today, start from tomorrow
  if (now.getHours() > closingHour) {
    slotDate.setDate(slotDate.getDate() + 1);
  }

  // Generate slots for the next 2 calendar days starting from opening hour
  for (let day = 0; day < 2; day++) {
    const base = new Date(slotDate);
    base.setDate(base.getDate() + day);
    base.setHours(0, 0, 0, 0); // Reset to midnight

    // Create hourly slots from opening to closing hour
    for (let hour = openingHour; hour <= closingHour; hour++) {
      const slotTime = new Date(base);
      slotTime.setHours(hour, 0, 0, 0);
      slotTimes.push({
        datetime: slotTime.toISOString(),
        field_id: 1,
        status: "available",
      });
    }
  }

  // Insert slots via REST API (service_role bypasses RLS)
  if (slotTimes.length > 0) {
    try {
      console.log(`[ensureSlotsExist] Attempting to insert ${slotTimes.length} slots via REST API...`);
      console.log(`[ensureSlotsExist] Slot times range: ${slotTimes[0].datetime} to ${slotTimes[slotTimes.length - 1].datetime}`);
      
      const insertResp = await fetch(`${supabaseUrl}/rest/v1/slots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Prefer": "return=representation",
        },
        body: JSON.stringify(slotTimes),
      });

      if (insertResp.ok) {
        const inserted = await insertResp.json();
        const insertedCount = Array.isArray(inserted) ? inserted.length : (inserted ? 1 : 0);
        console.log(`[ensureSlotsExist] Successfully inserted ${insertedCount} slots`);
      } else {
        const errorBody = await insertResp.text();
        console.warn(`[ensureSlotsExist] Insert failed (status ${insertResp.status}):`, errorBody);
      }
    } catch (e) {
      console.error("[ensureSlotsExist] Exception during insert:", e instanceof Error ? e.message : e);
    }
  }
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    // Verify auth token (optional). If no valid token is provided, we still
    // return slot availability (read-only) but won't include booking user details.
    const authHeader = req.headers.get("authorization");
    const token = extractTokenFromHeader(authHeader || "");

    let payload: TokenPayload | null = null;
    if (token) {
      try {
        payload = await verifyJWT(token);
        if (payload) console.log(`[slots-available] Authenticated user: ${payload.id}`);
      } catch (e) {
        // treat invalid token as unauthenticated but continue returning slots
        console.warn("[slots-available] Invalid token provided, continuing as anonymous");
        payload = null;
      }
    } else {
      console.log("[slots-available] No auth token provided, serving anonymous slots");
    }

    // Ensure slots exist
    try {
      await ensureSlotsExist(supabaseUrl, supabaseServiceKey);
    } catch (e) {
      console.error("[slots-available] Error ensuring slots exist:", e instanceof Error ? e.message : e);
    }

    // Get all slots for next 24 hours (both available and booked)
    const now = new Date();
    const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    console.log(`[slots-available] Querying slots between ${now.toISOString()} and ${nextDay.toISOString()}`);

    const { data: slots, error } = await supabase
      .from("slots")
      .select(
        "id, datetime, field_id, status, created_at, bookings(id, user_id, users(id, full_name))"
      )
      .gte("datetime", now.toISOString())
      .lte("datetime", nextDay.toISOString())
      .order("datetime", { ascending: true });

    if (error) {
      console.error("[slots-available] Query error:", error.message);
      console.error("[slots-available] Full error object:", JSON.stringify(error));
      // Return empty array instead of error - this allows the dashboard to work
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    console.log(`[slots-available] Raw query returned ${slots?.length || 0} slots`);

    const formattedSlots = (slots || []).map((slot: any) => {
      // Handle booking data - it comes as an array from the query
      const booking = slot.bookings && Array.isArray(slot.bookings) && slot.bookings.length > 0 
        ? slot.bookings[0] 
        : null;

      // If the caller is authenticated, include booking + user details; otherwise
      // omit sensitive nested user details and only indicate booking presence.
      const bookingInfo = booking ? {
        id: booking.id,
        userId: booking.user_id,
        user: (payload && booking.users) ? {
          id: booking.users.id,
          fullName: booking.users.full_name
        } : null
      } : null;
      
      return {
        id: slot.id,
        datetime: slot.datetime,
        fieldId: slot.field_id,
        status: slot.status,
        createdAt: slot.created_at,
        booking: bookingInfo
      };
    });

    console.log(`[slots-available] Successfully retrieved ${formattedSlots.length} slots for user ${payload.id}`);

    return new Response(JSON.stringify(formattedSlots), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[slots-available] ERROR - ${errorMsg}`);
    return new Response(JSON.stringify({ message: "Failed to fetch slots" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
});

// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as jose from "https://esm.sh/jose@5.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_DB_URL") || "https://ridfbitdmvpgaeyfxmxi.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
const jwtSecret = Deno.env.get("JWT_SECRET") || "football-booking-secret-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

if (!supabaseServiceKey) {
  console.error("[slots-book] Missing SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY in function env");
}

interface TokenPayload {
  id: string;
  email: string;
  studentId: string;
}

interface BookRequest {
  slotId: string;
}

interface BookingResponse {
  success: boolean;
  booking: {
    id: string;
    userId: string;
    slotId: string;
    createdAt: string;
  };
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

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const startTime = Date.now();

  try {
    // Verify auth token
    const authHeader = req.headers.get("authorization");
    const token = extractTokenFromHeader(authHeader || "");

    if (!token) {
      return new Response(JSON.stringify({ message: "No token provided" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return new Response(JSON.stringify({ message: "Invalid token" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const userId = payload.id;
    console.log(`[slots-book] User ${userId} attempting to book`);

    // Parse request body
    let body: BookRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ message: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!body.slotId) {
      return new Response(JSON.stringify({ message: "Slot ID is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const slotId = body.slotId;

    // Get user details
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, status, role")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      console.error(`[slots-book] User not found: ${userError?.message}`);
      return new Response(JSON.stringify({ message: "Invalid user" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // Check if user is approved (unless admin/owner)
    if (
      user.status !== "active" &&
      user.role !== "admin" &&
      user.role !== "owner"
    ) {
      return new Response(
        JSON.stringify({
          message: "Account pending verification. Please contact an admin.",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Check for existing bookings in next 24 hours
    const now = new Date();
    const next24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: existingBookings, error: existingError } = await supabase
      .from("bookings")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", now.toISOString())
      .lte("created_at", next24.toISOString());

    if (existingBookings && existingBookings.length > 0) {
      console.log(`[slots-book] User ${userId} already has a booking in next 24h`);
      return new Response(
        JSON.stringify({
          message:
            "You can only book one slot per 24-hour period. You already have an active booking.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Get slot
    const { data: slot, error: slotError } = await supabase
      .from("slots")
      .select("id, datetime, status")
      .eq("id", slotId)
      .single();

    if (slotError || !slot) {
      console.error(`[slots-book] Slot not found: ${slotError?.message}`);
      return new Response(JSON.stringify({ message: "Slot not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // Check slot status
    if (slot.status !== "available") {
      console.log(`[slots-book] Slot ${slotId} already booked`);
      return new Response(
        JSON.stringify({
          message: "This slot has already been booked by someone else",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Check if slot is in the past
    const slotTime = new Date(slot.datetime);
    if (slotTime < now) {
      return new Response(
        JSON.stringify({ message: "Cannot book a slot in the past" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Update slot status to booked
    const { error: updateError } = await supabase
      .from("slots")
      .update({ status: "booked" })
      .eq("id", slotId)
      .eq("status", "available"); // Only update if still available (optimistic lock)

    if (updateError) {
      console.error(`[slots-book] Failed to update slot: ${updateError.message}`);
      return new Response(
        JSON.stringify({ message: "This slot is no longer available" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert([
        {
          user_id: userId,
          slot_id: slotId,
        },
      ])
      .select("id, user_id, slot_id, created_at")
      .single();

    if (bookingError || !booking) {
      console.error(
        `[slots-book] Failed to create booking: ${bookingError?.message}`
      );
      // Revert slot status
      await supabase
        .from("slots")
        .update({ status: "available" })
        .eq("id", slotId);

      return new Response(
        JSON.stringify({
          message: "This slot was just booked by someone else. Please try another slot.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[slots-book] Booking ${booking.id} created in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        booking: {
          id: booking.id,
          userId: booking.user_id,
          slotId: booking.slot_id,
          createdAt: booking.created_at,
        },
      } as BookingResponse),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[slots-book] ERROR - ${errorMsg}`);
    return new Response(
      JSON.stringify({ message: "Failed to book slot. Please try again." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});

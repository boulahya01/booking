// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as jose from "https://esm.sh/jose@5.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_DB_URL") || "https://ridfbitdmvpgaeyfxmxi.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
const jwtSecret = Deno.env.get("JWT_SECRET") || "football-booking-secret-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

if (!supabaseServiceKey) {
  console.error("[bookings-cancel] Missing SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY in function env");
}

interface TokenPayload {
  id: string;
  email: string;
  studentId: string;
}

interface CancelResponse {
  success: boolean;
  message: string;
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

serve(async (req: Request) => {
  function getCorsHeaders() {
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

  const corsHeaders = getCorsHeaders();

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

    // Parse request body to get bookingId from path parameter
    // Since this is a Supabase Edge Function, we'll get it from the request URL
    const url = new URL(req.url);
    const bookingId = url.searchParams.get("bookingId");

    if (!bookingId) {
      return new Response(JSON.stringify({ message: "Booking ID is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    console.log(`[bookings-cancel] User ${userId} cancelling booking ${bookingId}`);

    // Get the booking with slot details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, user_id, slot_id, slots(datetime)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error(
        `[bookings-cancel] Booking not found: ${bookingError?.message}`
      );
      return new Response(
        JSON.stringify({
          message: "Booking not found or does not belong to you",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Verify booking belongs to user
    if (booking.user_id !== userId) {
      console.error(`[bookings-cancel] Booking does not belong to user`);
      return new Response(
        JSON.stringify({
          message: "Booking not found or does not belong to you",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Check if slot is in the past
    const slotTime = new Date(booking.slots?.datetime || 0);
    const now = new Date();
    if (slotTime < now) {
      console.log(
        `[bookings-cancel] Slot is in the past, cannot cancel`
      );
      return new Response(
        JSON.stringify({
          message: "Cannot cancel a booking for a past slot",
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

    // Delete booking
    const { error: deleteError } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId);

    if (deleteError) {
      console.error(
        `[bookings-cancel] Failed to delete booking: ${deleteError.message}`
      );
      return new Response(
        JSON.stringify({ message: "Failed to cancel booking" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Update slot status back to available
    const { error: slotError } = await supabase
      .from("slots")
      .update({ status: "available" })
      .eq("id", booking.slot_id);

    if (slotError) {
      console.error(`[bookings-cancel] Failed to update slot: ${slotError.message}`);
      // Don't fail the response - booking is already deleted
    }

    const duration = Date.now() - startTime;
    console.log(`[bookings-cancel] Booking ${bookingId} cancelled in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Booking cancelled successfully",
      } as CancelResponse),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[bookings-cancel] ERROR - ${errorMsg}`);
    return new Response(
      JSON.stringify({ message: "Failed to cancel booking" }),
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

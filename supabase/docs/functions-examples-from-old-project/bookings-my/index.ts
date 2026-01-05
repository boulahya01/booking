// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as jose from "https://esm.sh/jose@5.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_DB_URL") || "https://ridfbitdmvpgaeyfxmxi.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
const jwtSecret = Deno.env.get("JWT_SECRET") || "football-booking-secret-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

if (!supabaseServiceKey) {
  console.error("[bookings-my] Missing SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY in function env");
}

interface TokenPayload {
  id: string;
  email: string;
  studentId: string;
}

interface SlotData {
  id: string;
  datetime: string;
  fieldId: number;
  status: string;
  createdAt: string;
}

interface BookingResponse {
  id: string;
  userId: string;
  slotId: string;
  createdAt: string;
  slot: SlotData;
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
    console.log(`[bookings-my] Fetching bookings for user ${userId}`);

    // Get user's bookings with slot details
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(
        "id, user_id, slot_id, created_at, slots(id, datetime, field_id, status, created_at)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch bookings:", error);
      return new Response(
        JSON.stringify({ message: "Failed to fetch bookings" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const formattedBookings = (bookings || []).map((booking: any) => ({
      id: booking.id,
      userId: booking.user_id,
      slotId: booking.slot_id,
      createdAt: booking.created_at,
      slot: {
        id: booking.slots?.id || "",
        datetime: booking.slots?.datetime || "",
        fieldId: booking.slots?.field_id || 0,
        status: booking.slots?.status || "",
        createdAt: booking.slots?.created_at || "",
      },
    }));

    const duration = Date.now() - startTime;
    console.log(
      `[bookings-my] Retrieved ${formattedBookings.length} bookings in ${duration}ms`
    );

    return new Response(JSON.stringify(formattedBookings), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[bookings-my] ERROR - ${errorMsg}`);
    return new Response(
      JSON.stringify({ message: "Failed to fetch bookings" }),
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

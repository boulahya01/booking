// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as jose from "https://esm.sh/jose@5.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_DB_URL") || "https://ridfbitdmvpgaeyfxmxi.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
const jwtSecret = Deno.env.get("JWT_SECRET") || "football-booking-secret-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

if (!supabaseServiceKey) {
  console.error("[admin-settings-post] Missing SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY");
}

interface TokenPayload {
  id: string;
  email: string;
  studentId: string;
}

interface SettingsRequest {
  openingHour: number;
  closingHour: number;
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return new Response(JSON.stringify({ message: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if user is owner
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", payload.id)
      .single();

    if (!user || user.role !== "owner") {
      console.error(`[admin-settings-post] Access denied - user ${payload.id} is not owner`);
      return new Response(JSON.stringify({ message: "Owner access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Parse request body
    let body: SettingsRequest = { openingHour: 12, closingHour: 23 };
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return new Response(JSON.stringify({ message: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Validate inputs
    if (typeof body.openingHour !== 'number' || typeof body.closingHour !== 'number') {
      return new Response(JSON.stringify({ message: "Invalid input types" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (body.openingHour < 0 || body.openingHour > 23 || body.closingHour < 0 || body.closingHour > 23) {
      return new Response(JSON.stringify({ message: "Hours must be between 0 and 23" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (body.openingHour >= body.closingHour) {
      return new Response(JSON.stringify({ message: "Opening hour must be before closing hour" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[admin-settings-post] Owner ${payload.id} updating settings to ${body.openingHour}-${body.closingHour}`);

    // Update or insert opening_hour
    const { error: openingError } = await supabase
      .from("system_settings")
      .upsert({ key: "opening_hour", value: String(body.openingHour) }, { onConflict: "key" });

    if (openingError) {
      console.error(`[admin-settings-post] Error updating opening_hour:`, openingError);
      return new Response(JSON.stringify({ message: "Failed to update settings" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Update or insert closing_hour
    const { error: closingError } = await supabase
      .from("system_settings")
      .upsert({ key: "closing_hour", value: String(body.closingHour) }, { onConflict: "key" });

    if (closingError) {
      console.error(`[admin-settings-post] Error updating closing_hour:`, closingError);
      return new Response(JSON.stringify({ message: "Failed to update settings" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[admin-settings-post] Settings updated in ${Date.now() - startTime}ms`);

    const response = {
      success: true,
      openingHour: body.openingHour,
      closingHour: body.closingHour,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error(`[admin-settings-post] Error:`, error);
    return new Response(
      JSON.stringify({
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

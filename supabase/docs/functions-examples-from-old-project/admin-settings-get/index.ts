// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as jose from "https://esm.sh/jose@5.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_DB_URL") || "https://ridfbitdmvpgaeyfxmxi.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
const jwtSecret = Deno.env.get("JWT_SECRET") || "football-booking-secret-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

if (!supabaseServiceKey) {
  console.error("[admin-settings-get] Missing SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY");
}

interface TokenPayload {
  id: string;
  email: string;
  studentId: string;
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
      console.error(`[admin-settings-get] Access denied - user ${payload.id} is not owner`);
      return new Response(JSON.stringify({ message: "Owner access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[admin-settings-get] Owner ${payload.id} fetching settings`);

    // Get system settings
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value");

    if (settingsError && settingsError.code !== "PGRST116") {
      // PGRST116 is "no rows found" which is fine
      console.error(`[admin-settings-get] Query error:`, settingsError);
    }

    let openingHour = 12;
    let closingHour = 23;

    if (settings && Array.isArray(settings)) {
      settings.forEach((s: any) => {
        if (s.key === "opening_hour") {
          openingHour = parseInt(s.value, 10);
        } else if (s.key === "closing_hour") {
          closingHour = parseInt(s.value, 10);
        }
      });
    }

    const response = { openingHour, closingHour };

    console.log(`[admin-settings-get] Retrieved settings in ${Date.now() - startTime}ms:`, response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error(`[admin-settings-get] Error:`, error);
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

// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as jose from "https://esm.sh/jose@5.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_DB_URL") || "https://ridfbitdmvpgaeyfxmxi.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
const jwtSecret = Deno.env.get("JWT_SECRET") || "football-booking-secret-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

if (!supabaseServiceKey) {
  console.error("[admin-audit-logs] Missing SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY");
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

    // Check if user is admin or owner
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", payload.id)
      .single();

    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      console.error(`[admin-audit-logs] Access denied - user ${payload.id} is not admin/owner`);
      return new Response(JSON.stringify({ message: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get query parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const action = url.searchParams.get("action");
    const adminId = url.searchParams.get("adminId");

    console.log(`[admin-audit-logs] Admin ${payload.id} fetching logs (limit=${limit}, offset=${offset})`);

    let query = supabase
      .from("audit_logs")
      .select("id, admin_id, action, target_user_id, details, ip_address, user_agent, created_at");

    // Apply filters
    if (action) {
      query = query.eq("action", action);
    }
    if (adminId) {
      query = query.eq("admin_id", adminId);
    }

    // Apply pagination and sorting
    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      console.error(`[admin-audit-logs] Query error:`, logsError);
      return new Response(JSON.stringify({ message: "Failed to fetch audit logs" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch admin and target user details for enrichment
    const enrichedLogs = await Promise.all(
      (logs || []).map(async (log: any) => {
        let admin = null;
        let targetUser = null;

        // Fetch admin details
        if (log.admin_id) {
          const { data: adminData } = await supabase
            .from("users")
            .select("id, email, full_name")
            .eq("id", log.admin_id)
            .single();
          if (adminData) {
            admin = {
              id: adminData.id,
              email: adminData.email,
              name: adminData.full_name || adminData.email,
            };
          }
        }

        // Fetch target user details
        if (log.target_user_id) {
          const { data: targetData } = await supabase
            .from("users")
            .select("id, email, full_name")
            .eq("id", log.target_user_id)
            .single();
          if (targetData) {
            targetUser = {
              id: targetData.id,
              email: targetData.email,
              name: targetData.full_name || targetData.email,
            };
          }
        }

        return {
          id: log.id,
          adminId: log.admin_id,
          action: log.action,
          targetUserId: log.target_user_id,
          details: log.details,
          ipAddress: log.ip_address,
          userAgent: log.user_agent,
          createdAt: log.created_at,
          admin,
          targetUser,
        };
      })
    );

    console.log(`[admin-audit-logs] Retrieved ${enrichedLogs.length} logs in ${Date.now() - startTime}ms`);

    return new Response(JSON.stringify(enrichedLogs), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error(`[admin-audit-logs] Error:`, error);
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

// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as jose from "https://esm.sh/jose@5.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_DB_URL") || "https://ridfbitdmvpgaeyfxmxi.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
const jwtSecret = Deno.env.get("JWT_SECRET") || "football-booking-secret-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

if (!supabaseServiceKey) {
  console.error("[admin-approve] Missing SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY");
}

interface TokenPayload {
  id: string;
  email: string;
  studentId: string;
}


interface ApproveRequest {
  note?: string;
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

    // Check if user is admin
    const { data: admin, error: adminError } = await supabase
      .from("users")
      .select("role")
      .eq("id", payload.id)
      .single();

    if (!admin || admin.role !== "admin") {
      console.error(`[admin-approve] Access denied - user ${payload.id} is not admin`);
      return new Response(JSON.stringify({ message: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Extract userId from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];

    if (!userId) {
      return new Response(JSON.stringify({ message: "User ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Parse request body
    let body: ApproveRequest = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Continue with empty body
    }

    console.log(`[admin-approve] Admin ${payload.id} approving user ${userId}`);

    // Update user status to active
    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update({
        status: "active",
        approved_by: payload.id,
        approved_at: new Date().toISOString(),
        approval_note: body.note || null,
      })
      .eq("id", userId)
      .select("id, email, full_name, student_id, status, role, created_at, updated_at, approved_at, approved_by");

    if (updateError) {
      console.error(`[admin-approve] Update error:`, updateError);
      return new Response(JSON.stringify({ message: "Failed to approve user" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!updated || updated.length === 0) {
      return new Response(JSON.stringify({ message: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const user = updated[0];
    const response = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      studentId: user.student_id,
      status: user.status,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      approvedAt: user.approved_at,
      approvedBy: user.approved_by,
    };

    console.log(`[admin-approve] User ${userId} approved in ${Date.now() - startTime}ms`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error(`[admin-approve] Error:`, error);
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

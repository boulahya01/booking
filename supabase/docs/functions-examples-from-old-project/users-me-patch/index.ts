// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
import * as jose from "https://esm.sh/jose@5.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_DB_URL") || "https://ridfbitdmvpgaeyfxmxi.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
const jwtSecret = Deno.env.get("JWT_SECRET") || "football-booking-secret-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

if (!supabaseServiceKey) {
  console.error("[users-me-patch] Missing SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY");
}

interface TokenPayload {
  id: string;
  email: string;
  studentId: string;
}

interface UpdateProfileRequest {
  email?: string;
  fullName?: string;
  studentId?: string;
  password?: string;
  currentPassword?: string;
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

async function signJWT(userId: string, email: string, studentId: string): Promise<string> {
  const payload = {
    id: userId,
    email,
    studentId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
  };
  const secret = new TextEncoder().encode(jwtSecret);
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(secret);
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
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

  if (req.method !== "PATCH") {
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

    const userId = payload.id;

    // Parse request body
    let body: UpdateProfileRequest = {};
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

    // Get current user
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, student_id, status, role, password_hash, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (userError || !currentUser) {
      console.error(`[users-me-patch] User not found: ${userError?.message}`);
      return new Response(JSON.stringify({ message: "Invalid user" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Prevent changing fullName or studentId after approval
    const fullNameChanged = typeof body.fullName === 'string' && body.fullName !== currentUser.full_name;
    const studentIdChanged = typeof body.studentId === 'string' && body.studentId !== currentUser.student_id;
    
    if ((fullNameChanged || studentIdChanged) && currentUser.status !== 'pending') {
      return new Response(
        JSON.stringify({ message: 'Name and Student ID cannot be changed after approval. Contact an admin.' }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate email uniqueness if changing
    if (typeof body.email === 'string' && body.email.toLowerCase() !== currentUser.email) {
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("email", body.email.toLowerCase())
        .single();
      
      if (existing && existing.id !== userId) {
        return new Response(JSON.stringify({ message: 'Email already in use' }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Prepare updates
    const updates: any = {};

    if (typeof body.email === 'string') {
      updates.email = body.email.toLowerCase();
    }
    if (typeof body.fullName === 'string') {
      updates.full_name = body.fullName;
    }
    if (typeof body.studentId === 'string') {
      updates.student_id = body.studentId;
    }

    // Handle password change
    if (typeof body.password === 'string') {
      if (typeof body.currentPassword !== 'string') {
        return new Response(JSON.stringify({ message: 'Current password is required to change password' }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const passwordMatches = await bcrypt.compare(body.currentPassword, currentUser.password_hash);
      if (!passwordMatches) {
        return new Response(JSON.stringify({ message: 'Current password is incorrect' }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const hashedPassword = await bcrypt.hash(body.password, 10);
      updates.password_hash = hashedPassword;
    }

    // If no updates, return current user
    if (Object.keys(updates).length === 0) {
      const response = {
        success: true,
        user: {
          id: currentUser.id,
          email: currentUser.email,
          fullName: currentUser.full_name,
          studentId: currentUser.student_id,
          status: currentUser.status,
          role: currentUser.role,
          createdAt: currentUser.created_at,
          updatedAt: currentUser.updated_at,
        },
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Apply updates
    updates.updated_at = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select("id, email, full_name, student_id, status, role, created_at, updated_at");

    if (updateError || !updated || updated.length === 0) {
      console.error(`[users-me-patch] Update error:`, updateError);
      return new Response(JSON.stringify({ message: 'Failed to update profile' }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const user = updated[0];
    const response: any = {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        studentId: user.student_id,
        status: user.status,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    };

    // If email changed, re-issue token
    if (updates.email && updates.email !== currentUser.email) {
      response.token = await signJWT(user.id, user.email, user.student_id);
    }

    console.log(`[users-me-patch] Updated user ${userId} in ${Date.now() - startTime}ms`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error(`[users-me-patch] Error:`, error);
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

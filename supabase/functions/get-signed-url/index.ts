// @ts-ignore Import works in Deno runtime
// @deno-types="https://deno.land/std@0.208.0/http/server.ts"
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
// @ts-ignore Import works in Deno runtime
// @deno-types="https://esm.sh/@supabase/supabase-js@2"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// @ts-ignore Import works in Deno runtime
// @deno-types="https://esm.sh/zod@3.22.4"
import { z } from "https://esm.sh/zod@3.22.4"

// @ts-ignore Deno global available at runtime
const supabaseUrl = Deno.env.get("SUPABASE_URL")!
// @ts-ignore Deno global available at runtime
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
// @ts-ignore Deno global available at runtime
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173"

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Rate limiting
const RATE_LIMIT_WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 20
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) return false
  record.count++
  return true
}

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown"
}

// CORS headers - STRICT origin checking
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin")
  if (origin && origin === allowedOrigin) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    }
  }
  return {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  }
}

// Auth verification
async function verifyAuth(req: Request) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const token = authHeader.split("Bearer ")[1]
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) return null
  return user
}

// Path validation - prevent directory traversal
function validateStoragePath(path: string): boolean {
  // No directory traversal
  if (path.includes("..")) return false
  // No absolute paths
  if (path.startsWith("/")) return false
  // Only allow alphanumeric, hyphens, underscores, dots, slashes
  if (!/^[a-zA-Z0-9\-_./]+$/.test(path)) return false
  // Limit length
  if (path.length > 500) return false
  return true
}

// Zod schema
const SignedUrlSchema = z.object({
  path: z.string().min(1).max(500),
  expires: z.number().min(60).max(3600).optional().default(3600),
})

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req)

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  // Rate limiting
  const ip = getClientIP(req)
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  // Verify authentication
  const user = await verifyAuth(req)
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  try {
    const body = await req.json()
    const result = SignedUrlSchema.safeParse(body)

    if (!result.success) {
      return new Response(JSON.stringify({ error: "Invalid request data" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const { path, expires } = result.data

    // Validate path to prevent directory traversal
    if (!validateStoragePath(path)) {
      console.warn("[get-signed-url] Invalid path attempted:", path)
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // Restrict to user's own files only (path must start with user ID)
    if (!path.startsWith(user.id + "/")) {
      console.warn("[get-signed-url] User tried to access another user's file:", path)
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // Create signed URL for private bucket access
    const { data, error } = await supabase.storage.from("id-photos").createSignedUrl(path, expires)

    if (error || !data) {
      console.error("[get-signed-url] Storage error:", error)
      return new Response(JSON.stringify({ error: "Failed to create signed URL" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const signedUrl = (data as any).signedUrl ?? (data as any).signedURL ?? (data as any).signed_url

    return new Response(JSON.stringify({ signedUrl }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    })
  } catch (err) {
    console.error("[get-signed-url] Error:", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
})

// @ts-ignore Import works in Deno runtime
// @deno-types="https://deno.land/std@0.208.0/http/server.ts"
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
// @ts-ignore Import works in Deno runtime
// @deno-types="https://esm.sh/@supabase/supabase-js@2.38.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// @ts-ignore Deno global available at runtime
const supabaseUrl = Deno.env.get("SUPABASE_URL")!
// @ts-ignore Deno global available at runtime
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json()
    const path: string | undefined = body?.path
    const expires: number = body?.expires ?? 3600

    if (!path || path.trim() === "") {
      return new Response(JSON.stringify({ error: "path is required" }), { status: 400, headers: { "Content-Type": "application/json" } })
    }

    // Create signed URL for private bucket access (requires service role key)
    const { data, error } = await supabase.storage.from("id-photos").createSignedUrl(path, expires)

    if (error || !data) {
      console.error("Signed URL error:", error)
      return new Response(JSON.stringify({ error: "Failed to create signed URL" }), { status: 500, headers: { "Content-Type": "application/json" } })
    }

    // data may contain signedURL or signedUrl depending on SDK
    const signedUrl = (data as any).signedUrl ?? (data as any).signedURL ?? (data as any).signed_url

    return new Response(JSON.stringify({ signedUrl }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (err) {
    console.error("get-signed-url error:", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})

// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

serve(async (req: Request) => {
  return new Response(
    JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      env: {
        SUPABASE_URL: Deno.env.get("SUPABASE_URL") ? "SET" : "NOT SET",
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") ? "SET" : "NOT SET",
        JWT_SECRET: Deno.env.get("JWT_SECRET") ? "SET" : "NOT SET",
      }
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});

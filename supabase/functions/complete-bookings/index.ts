// V2 derives booking lifecycle from timestamps and does not use a completion
// cron. Keep the V1 function inert so spoofable header checks and service-role
// updates cannot be reintroduced by an accidental deployment.
// @ts-ignore Import works in the Deno runtime.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

serve(() => new Response(JSON.stringify({ error: "legacy_endpoint_retired" }), {
  status: 410,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
}))

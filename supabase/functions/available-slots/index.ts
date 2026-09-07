// V2 owns availability through the database RPC contract. This V1 function
// remains only as an explicit retirement marker so it cannot be re-deployed as
// a service-role, fail-open availability endpoint.
// @ts-ignore Import works in the Deno runtime.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

serve(() => new Response(JSON.stringify({ error: "legacy_endpoint_retired" }), {
  status: 410,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
}))

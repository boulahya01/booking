/**
 * Retired V1 cron endpoint.
 *
 * V2 derives booking lifecycle from timestamps and does not use a completion
 * cron. Keep this route explicit and inert so stale deployments cannot invoke
 * a service-role function with an unset or outdated secret.
 */
import type { RequestHandler } from './$types'

export const GET: RequestHandler = () =>
  new Response(JSON.stringify({ error: 'legacy_endpoint_retired' }), {
    status: 410,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

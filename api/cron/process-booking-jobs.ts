/**
 * Retired V1 cron endpoint.
 *
 * V2 derives booking lifecycle from timestamps and does not use a completion
 * or booking-jobs cron.
 */
export default function handler() {
    return new Response(JSON.stringify({ error: 'legacy_endpoint_retired' }), {
        status: 410,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
    })
}

/**
 * Vercel Cron API Handler
 * Scheduled to run every 5 minutes via vercel.json
 * Invokes the Supabase process-booking-jobs edge function
 *
 * SECURITY:
 * - Uses SUPABASE_SERVICE_ROLE_KEY (server-side only, never expose to browser)
 * - This key has admin privileges and should only be used on the server
 * - Verifies cron request with a shared secret (CRON_SECRET)
 */
export default async function handler(req: Request) {
    // Verify cron request using shared secret
    if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    try {
        console.log('[cron] Starting booking jobs processor at', new Date().toISOString())

        const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_PUBLIC_SUPABASE_URL')
        }

        // Invoke the Supabase edge function using SERVICE ROLE KEY
        // Service role key has admin privileges and is server-only
        const functionUrl = `${supabaseUrl}/functions/v1/process-booking-jobs`

        const response = await fetch(functionUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`,
            },
        })

        const data = await response.json()
        console.log('[cron] Function response:', data)

        return new Response(JSON.stringify({
            success: true,
            message: 'Booking jobs processor invoked',
            result: data,
            timestamp: new Date().toISOString(),
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    } catch (error) {
        console.error('[cron] Error invoking function:', error)
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
}

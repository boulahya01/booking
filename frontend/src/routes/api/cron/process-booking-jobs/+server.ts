/**
 * Vercel Cron API Handler - Process Booking Jobs
 * Scheduled to run every 5 minutes via vercel.json
 * Invokes the Supabase process-booking-jobs edge function
 *
 * SECURITY:
 * - Uses SUPABASE_SERVICE_ROLE_KEY (server-side only, never expose to browser)
 * - Verifies cron request with a shared secret (CRON_SECRET)
 */
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ request }) => {
  // Verify cron request using shared secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL')
    }

    // Invoke the Supabase edge function
    const functionUrl = `${supabaseUrl}/functions/v1/process-booking-jobs`

    const response = await fetch(functionUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'x-cron-secret': process.env.CRON_SECRET || '',
      },
    })

    const data = await response.json()

    return new Response(JSON.stringify({
      success: true,
      message: 'Booking jobs processor invoked',
      result: data,
      timestamp: new Date().toISOString(),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

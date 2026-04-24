// @ts-ignore Import works in Deno runtime
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
// @ts-ignore Import works in Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// @ts-ignore Deno global available at runtime
const supabaseUrl = Deno.env.get('SUPABASE_URL')
// @ts-ignore Deno global available at runtime
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[process-booking-jobs] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '')

serve(async (req: Request) => {
    try {
        if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'OPTIONS') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
        }

        console.log('[process-booking-jobs] Running job processor at', new Date().toISOString())

        // Fetch due jobs (pending) up to a reasonable limit
        const { data: jobs, error: jobErr } = await supabase
            .from('booking_jobs')
            .select('id,booking_id')
            .eq('status', 'pending')
            .lte('run_at', new Date().toISOString())
            .limit(100)

        if (jobErr) {
            console.error('[process-booking-jobs] Failed to fetch jobs:', jobErr)
            throw jobErr
        }

        if (!jobs || jobs.length === 0) {
            return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
        }

        const processedIds: string[] = []

        for (const job of jobs) {
            const bookingId = job.booking_id

            // Mark booking completed if still active
            const { data: booking, error: bErr } = await supabase
                .from('bookings')
                .select('id,status')
                .eq('id', bookingId)
                .maybeSingle()

            if (bErr) {
                console.error('[process-booking-jobs] Error fetching booking', bookingId, bErr)
                continue
            }

            if (!booking) {
                // booking missing; mark job processed
                await supabase.from('booking_jobs').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', job.id)
                processedIds.push(job.id)
                continue
            }

            if (booking.status === 'active') {
                const { error: updErr } = await supabase
                    .from('bookings')
                    .update({ status: 'completed' })
                    .eq('id', bookingId)

                if (updErr) {
                    console.error('[process-booking-jobs] Failed to complete booking', bookingId, updErr)
                    continue
                }
            }

            // Mark job processed
            const { error: markErr } = await supabase
                .from('booking_jobs')
                .update({ status: 'processed', processed_at: new Date().toISOString() })
                .eq('id', job.id)

            if (markErr) {
                console.error('[process-booking-jobs] Failed to mark job processed', job.id, markErr)
                continue
            }

            processedIds.push(job.id)
        }

        console.log('[process-booking-jobs] Processed jobs count:', processedIds.length)
        return new Response(JSON.stringify({ processed: processedIds.length }), { status: 200 })
    } catch (error) {
        console.error('[process-booking-jobs] Error:', error)
        const msg = error instanceof Error ? error.message : String(error)
        return new Response(JSON.stringify({ error: msg }), { status: 500 })
    }
})

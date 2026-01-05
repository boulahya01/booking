#!/usr/bin/env node

/**
 * Test script to verify booking_jobs trigger works
 * Creates a test booking and checks if a job is auto-inserted
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL || 'https://mismymbsavogkuovfyvj.supabase.co'
// Do NOT hardcode keys here. Set `VITE_PUBLIC_SUPABASE_ANON_KEY` in your local env for development.
const supabaseAnonKey = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set')
    console.error('   Set it from your Supabase project settings (Service Role Key)')
    process.exit(1)
}

if (!supabaseAnonKey) {
    console.warn('⚠️  Warning: VITE_PUBLIC_SUPABASE_ANON_KEY not set. Some operations may be limited in local testing.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function runTest() {
    try {
        console.log('🧪 Testing booking_jobs trigger...\n')

        // 1. Get a test user ID (or create one for testing)
        console.log('Step 1: Fetching a test user...')
        const { data: users, error: userErr } = await supabase
            .from('profiles')
            .select('id')
            .limit(1)

        if (userErr) {
            console.error('❌ Error fetching users:', userErr)
            return
        }

        if (!users || users.length === 0) {
            console.error('❌ No users found in profiles table')
            return
        }

        const userId = users[0].id
        console.log(`✓ Found user: ${userId}\n`)

        // 2. Get a test pitch ID
        console.log('Step 2: Fetching a test pitch...')
        const { data: pitches, error: pitchErr } = await supabase
            .from('pitches')
            .select('id')
            .limit(1)

        if (pitchErr) {
            console.error('❌ Error fetching pitches:', pitchErr)
            return
        }

        if (!pitches || pitches.length === 0) {
            console.error('❌ No pitches found in pitches table')
            return
        }

        const pitchId = pitches[0].id
        console.log(`✓ Found pitch: ${pitchId}\n`)

        // 3. Create a test booking (future slot)
        console.log('Step 3: Creating a test booking...')
        const now = new Date()
        const slotStart = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours from now
        const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000) // 1 hour duration

        const bookingData = {
            user_id: userId,
            pitch_id: pitchId,
            slot_datetime: slotStart.toISOString(),
            slot_datetime_end: slotEnd.toISOString(),
            status: 'active'
        }

        console.log(`  Booking data:`)
        console.log(`    user_id: ${bookingData.user_id}`)
        console.log(`    pitch_id: ${bookingData.pitch_id}`)
        console.log(`    slot_datetime: ${bookingData.slot_datetime}`)
        console.log(`    slot_datetime_end: ${bookingData.slot_datetime_end}`)

        // Try without upsert conflict handling - just insert
        const { data: booking, error: bookErr } = await supabase
            .from('bookings')
            .insert([bookingData])
            .select()

        if (bookErr) {
            console.error('❌ Error creating booking:', bookErr.message)
            console.error('Error code:', bookErr.code)

            if (bookErr.code === '42P10' || bookErr.code === '23505') {
                console.log('\nThis suggests a unique constraint violation.')
                console.log('Possible causes:')
                console.log('  1. User already has an active booking for this slot')
                console.log('  2. The unique index is enforcing duplicates')
                console.log('  3. RLS policy is blocking the insert')
            }
            return
        }

        if (!booking || booking.length === 0) {
            console.error('❌ No booking returned')
            return
        }

        const bookingId = booking[0].id
        console.log(`✓ Booking created: ${bookingId}\n`)

        // 4. Check if a job was created by the trigger
        console.log('Step 4: Checking if booking_jobs trigger created a job...')
        await new Promise(resolve => setTimeout(resolve, 500)) // Wait 500ms for trigger

        const { data: jobs, error: jobErr } = await supabase
            .from('booking_jobs')
            .select('*')
            .eq('booking_id', bookingId)

        if (jobErr) {
            console.error('❌ Error fetching jobs:', jobErr)
            return
        }

        if (!jobs || jobs.length === 0) {
            console.error('❌ No job found! Trigger may not have fired.\n')
            console.log('Troubleshooting:')
            console.log('  1. Check that the migration 20251221002100_create_booking_jobs_trigger.sql ran')
            console.log('  2. Verify trigger exists: SELECT * FROM information_schema.triggers WHERE trigger_name = \'trg_upsert_booking_job\'')
            console.log('  3. Check Supabase logs for trigger errors')
            return
        }

        const job = jobs[0]
        console.log(`✓ Job created by trigger!\n`)
        console.log(`  Job details:`)
        console.log(`    id: ${job.id}`)
        console.log(`    booking_id: ${job.booking_id}`)
        console.log(`    run_at: ${job.run_at}`)
        console.log(`    status: ${job.status}`)
        console.log(`    created_at: ${job.created_at}\n`)

        // 5. Verify job run_at matches slot end
        const jobRunAt = new Date(job.run_at)
        const expectedRunAt = new Date(slotEnd)
        const timeDiff = Math.abs(jobRunAt.getTime() - expectedRunAt.getTime())

        if (timeDiff < 1000) {
            console.log(`✅ SUCCESS! Job run_at matches slot end time (within 1 second)\n`)
        } else {
            console.log(`⚠️  Warning: Job run_at differs from slot_datetime_end by ${timeDiff}ms\n`)
        }

        // 6. Clean up test booking and job
        console.log('Step 5: Cleaning up test data...')
        const { error: delErr } = await supabase
            .from('bookings')
            .delete()
            .eq('id', bookingId)

        if (delErr) {
            console.error('⚠️  Warning: Could not delete test booking:', delErr)
        } else {
            console.log(`✓ Test booking deleted\n`)
        }

        console.log('🎉 Test complete! The trigger is working correctly.')
    } catch (error) {
        console.error('❌ Unexpected error:', error)
    }
}

// Run test
runTest()

<script lang="ts">
  import { onMount } from 'svelte'
  import { user } from '$lib/stores/auth'
  import { supabase } from '$lib/supabaseClient'
  import NeonCard from '$lib/components/NeonCard.svelte'

  let booking: any = null
  let loading = true

  onMount(() => {
    const unsub = user.subscribe(async (u) => {
      if (!u) {
        booking = null
        loading = false
        return
      }
      loading = true
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('id,pitch_id,slot_datetime,status')
          .eq('user_id', u.id)
          .eq('status', 'active')
          .order('slot_datetime', { ascending: true })
          .limit(1)

        if (!error && data && data.length) {
          booking = data[0]
          // fetch pitch name (best-effort)
          const { data: pitchData } = await supabase.from('pitches').select('name').eq('id', booking.pitch_id).maybeSingle()
          booking.pitch_name = pitchData?.name || booking.pitch_id
        } else {
          booking = null
        }
      } catch (err) {
        console.warn('NextBookingCard fetch error', err)
        booking = null
      }
      loading = false
    })

    return () => unsub()
  })
</script>

<NeonCard>
  {#if loading}
    <div>Loading upcoming booking…</div>
  {:else if booking}
    <div>
      <div style="font-weight:700">Next Booking</div>
      <div style="margin-top:6px">{booking.pitch_name}</div>
      <div style="margin-top:6px;color:var(--muted)">{new Date(booking.slot_datetime).toLocaleString()}</div>
      <div style="margin-top:8px"><a class="neon-button" href="/bookings">View booking</a></div>
    </div>
  {:else}
    <div>
      <div style="font-weight:700">No upcoming bookings</div>
      <div style="margin-top:8px"><a class="neon-button" href="/home">Browse Pitches</a></div>
    </div>
  {/if}
</NeonCard>

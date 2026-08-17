<script lang="ts">
  import { onMount } from 'svelte'
  import { user } from '$lib/stores/auth'
  import { supabase } from '$lib/supabaseClient'
  import { _ } from 'svelte-i18n'
  import { locale } from 'svelte-i18n'
  import { USE_MOCK, mockBookings, mockPitches } from '$lib/mock'
  import Icon from './Icon.svelte'

  let booking: any = null
  let loading = true

  onMount(() => {
    if (USE_MOCK) {
      const active = mockBookings.find(b => b.status === 'active')
      if (active) {
        const pitch = mockPitches.find(p => p.id === active.pitch_id)
        booking = { ...active, pitch_name: pitch?.name || active.pitch_id }
      }
      loading = false
      return
    }

    const unsub = user.subscribe(async (u) => {
      if (!u) {
        booking = null
        loading = false
        return
      }

      loading = true
      try {
        const now = new Date().toISOString()
        const { data, error } = await supabase
          .from('bookings')
          .select('id,pitch_id,slot_datetime,status,pitches(name)')
          .eq('user_id', u.id)
          .eq('status', 'active')
          .gt('slot_datetime', now)
          .order('slot_datetime', { ascending: true })
          .limit(1)

        if (!error && data && data.length) {
          const row: any = data[0]
          const relatedPitch = Array.isArray(row.pitches) ? row.pitches[0] : row.pitches
          booking = {
            id: row.id,
            pitch_id: row.pitch_id,
            slot_datetime: row.slot_datetime,
            status: row.status,
            pitch_name: relatedPitch?.name || row.pitch_id
          }
        } else {
          booking = null
        }
      } catch {
        booking = null
      }
      loading = false
    })

    return () => unsub()
  })

  function formatBookingTime(dateString: string) {
    const date = new Date(dateString)
    const currentLocale = $locale || 'en'
    return {
      day: date.getDate(),
      month: date.toLocaleDateString(currentLocale, { month: 'short' }),
      weekday: date.toLocaleDateString(currentLocale, { weekday: 'long' }),
      time: date.toLocaleTimeString(currentLocale, { hour: '2-digit', minute: '2-digit', hour12: false })
    }
  }
</script>

<div class="rounded-xl p-4 transition-all duration-200"
     style={booking
       ? 'background: var(--primary-light/40); box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.12);'
       : 'background: var(--surface-level-1/40); box-shadow: 0 0 0 1px var(--border);'}>
  {#if loading}
    <div class="flex items-center gap-3" style="color: var(--text-muted);">
      <div class="w-10 h-10 rounded-full animate-pulse" style="background: var(--surface-level-1);"></div>
      <div class="h-4 w-32 animate-pulse rounded" style="background: var(--surface-level-1);"></div>
    </div>
  {:else if booking}
    {@const time = formatBookingTime(booking.slot_datetime)}
    <a href="/bookings" class="flex items-center gap-4 group">
      <div class="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
           style="background: var(--primary-light/60); color: var(--primary); box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.1);">
        <span class="text-[10px] font-semibold uppercase tracking-wide">{time.month}</span>
        <span class="text-lg font-bold leading-none">{time.day}</span>
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold truncate" style="color: var(--text);">{booking.pitch_name}</h3>
        <p class="text-sm" style="color: var(--text-secondary);">{time.weekday} at {time.time}</p>
      </div>
      <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:-translate-y-0.5"
           style="background: var(--primary-light); color: var(--primary);">
        <Icon name="arrow-right" size={20} />
      </div>
    </a>
  {:else}
    <div class="flex items-center gap-4">
      <div class="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
           style="background: var(--surface-level-1); color: var(--text-muted);">
        <Icon name="calendar-x" size={24} />
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold" style="color: var(--text);">{$_('home.no_upcoming_bookings')}</p>
        <p class="text-sm" style="color: var(--text-muted);">{$_('home.no_upcoming_bookings_hint')}</p>
      </div>
    </div>
  {/if}
</div>

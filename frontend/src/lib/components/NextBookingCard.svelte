<script lang="ts">
  import { onMount } from 'svelte'
  import { authState } from '$lib/stores/auth'
  import { _ } from 'svelte-i18n'
  import { locale } from 'svelte-i18n'
  import { USE_MOCK } from '$lib/mock'
  import Icon from './Icon.svelte'
  import { getNextBooking, BookingApiError, type MyBooking } from '$lib/bookingApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'

  let booking: MyBooking | null = null
  let loading = true
  let error: string | null = null
  let currentUserId: string | null = null
  let requestVersion = 0

  onMount(() => {
    if (USE_MOCK) {
      booking = null
      loading = false
      return
    }

    const unsubscribe = authState.subscribe((state) => {
      if (state.loading) {
        loading = true
        return
      }

      const userId = state.user?.id ?? null
      if (userId === currentUserId) return

      currentUserId = userId
      requestVersion += 1

      if (!userId) {
        booking = null
        error = null
        loading = false
        return
      }

      void loadBooking(userId)
    })

    return unsubscribe
  })

  async function loadBooking(userId: string) {
    const version = requestVersion
    loading = true
    error = null

    try {
      const next = await getNextBooking(userId)
      if (version !== requestVersion || userId !== currentUserId) return
      booking = next
    } catch (loadError) {
      if (version !== requestVersion || userId !== currentUserId) return
      const code = loadError instanceof BookingApiError ? loadError.code : 'unknown'
      booking = null
      error = bookingFailureMessage(code, $locale)
    } finally {
      if (version === requestVersion) loading = false
    }
  }

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
  {:else if error}
    <div class="flex items-center gap-4">
      <div class="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style="background: var(--danger-light); color: var(--danger);">
        <Icon name="alert-circle" size={22} />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium" style="color: var(--danger);">{error}</p>
        {#if currentUserId}
          <button on:click={() => void loadBooking(currentUserId!)} class="mt-1 text-sm font-medium hover:underline" style="color: var(--primary);">{$_('common.retry')}</button>
        {/if}
      </div>
    </div>
  {:else if booking}
    {@const time = formatBookingTime(booking.starts_at)}
    <a href="/bookings" class="flex items-center gap-4 group">
      <div class="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
           style="background: var(--primary-light/60); color: var(--primary); box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.1);">
        <span class="text-[10px] font-semibold uppercase tracking-wide">{time.month}</span>
        <span class="text-lg font-bold leading-none">{time.day}</span>
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold truncate" style="color: var(--text);">{booking.pitches?.name || $_('bookings.unknown_pitch')}</h3>
        <p class="text-sm" style="color: var(--text-secondary);">{time.weekday} at {time.time}</p>
      </div>
      <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:-translate-y-0.5"
           style="background: var(--primary-light); color: var(--primary);">
        <Icon name="arrow-right" size={20} />
      </div>
    </a>
  {:else}
    <div class="flex items-center gap-4">
      <div class="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style="background: var(--surface-level-1); color: var(--text-muted);">
        <Icon name="calendar-x" size={24} />
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold" style="color: var(--text);">{$_('home.no_upcoming_bookings')}</p>
        <p class="text-sm" style="color: var(--text-muted);">{$_('home.no_upcoming_bookings_hint')}</p>
      </div>
    </div>
  {/if}
</div>

<script lang="ts">
  import { onMount } from 'svelte'
  import { authState } from '$lib/stores/auth'
  import { _ , locale } from 'svelte-i18n'
  import { USE_MOCK } from '$lib/mock'
  import Icon from './Icon.svelte'
  import { getNextBooking, BookingApiError, type MyBooking } from '$lib/bookingApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'

  let booking: MyBooking | null = null
  let loading = true
  let error: string | null = null
  let currentUserId: string | null = null
  let requestVersion = 0

  $: isArabic = ($locale || 'en').startsWith('ar')

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

  function formatBookingTime(dateString: string, timezone: string) {
    const date = new Date(dateString)
    const currentLocale = $locale || 'en'
    return {
      day: date.toLocaleDateString(currentLocale, { day: 'numeric', timeZone: timezone }),
      month: date.toLocaleDateString(currentLocale, { month: 'short', timeZone: timezone }),
      weekday: date.toLocaleDateString(currentLocale, { weekday: 'short', timeZone: timezone }),
      time: date.toLocaleTimeString(currentLocale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone })
    }
  }
</script>

<section class="uneem-card">
  {#if loading}
    <div class="flex items-center gap-3" aria-busy="true">
      <div class="h-12 w-12 animate-pulse rounded-2xl bg-surface-level-1"></div>
      <div class="flex-1 space-y-2">
        <div class="h-4 w-28 animate-pulse rounded-full bg-surface-level-1"></div>
        <div class="h-4 w-40 animate-pulse rounded-full bg-surface-level-1"></div>
      </div>
    </div>
  {:else if error}
    <div class="flex items-center gap-3">
      <div class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger-light text-danger"><Icon name="alert-circle" size={19} /></div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-text">{error}</p>
        {#if currentUserId}<button on:click={() => void loadBooking(currentUserId!)} class="mt-1 min-h-8 text-sm font-bold text-primary">{$_('common.retry')}</button>{/if}
      </div>
    </div>
  {:else if booking}
    {@const time = formatBookingTime(booking.starts_at, booking.pitches?.timezone || 'Africa/Casablanca')}
    <a href="/bookings" class="group flex items-center gap-3.5">
      <div class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-light text-primary">
        <span class="text-[10px] font-extrabold uppercase tracking-wide">{time.month}</span>
        <span class="text-xl font-extrabold leading-none">{time.day}</span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-bold uppercase tracking-[0.1em] text-primary">{isArabic ? 'حجزك الجاي' : 'Next booking'}</p>
        <h3 class="mt-1 truncate font-bold text-text">{booking.pitches?.name || $_('bookings.unknown_pitch')}</h3>
        <p class="mt-0.5 text-sm text-text-secondary">{time.weekday} · {time.time}</p>
      </div>
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-text-muted transition-colors group-hover:bg-primary-light group-hover:text-primary">
        <Icon name={isArabic ? 'arrow-left' : 'arrow-right'} size={18} />
      </span>
    </a>
  {:else}
    <div class="flex items-center gap-3.5">
      <div class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-level-1 text-text-muted"><Icon name="calendar-x" size={21} /></div>
      <div class="min-w-0 flex-1">
        <p class="font-bold text-text">{isArabic ? 'ما عندك حتى حجز جاي' : 'No booking yet'}</p>
        <a href="/home" class="mt-1 inline-flex min-h-8 items-center text-sm font-bold text-primary">{isArabic ? 'اختار مرفق' : 'Find a facility'}</a>
      </div>
    </div>
  {/if}
</section>

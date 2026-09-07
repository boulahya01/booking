<script lang="ts">
  import { onMount } from 'svelte'
  import { authState } from '$lib/stores/auth'
  import { _, locale } from 'svelte-i18n'
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

{#if loading}
  <section class="mb-6 flex items-center gap-3 rounded-[18px] border border-border-light bg-surface p-3" aria-busy="true">
    <div class="h-11 w-11 animate-pulse rounded-[14px] bg-surface-level-1"></div>
    <div class="flex-1 space-y-2"><div class="h-3 w-24 animate-pulse rounded bg-surface-level-1"></div><div class="h-4 w-36 animate-pulse rounded bg-surface-level-1"></div></div>
  </section>
{:else if error}
  <div class="mb-5 flex items-center justify-between gap-3 py-2">
    <p class="text-sm font-semibold text-danger">{error}</p>
    {#if currentUserId}<button on:click={() => void loadBooking(currentUserId!)} class="min-h-9 text-sm font-bold text-primary">{$_('common.retry')}</button>{/if}
  </div>
{:else if booking}
  {@const time = formatBookingTime(booking.starts_at, booking.pitches?.timezone || 'Africa/Casablanca')}
  <section class="mb-6">
    <p class="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-text-muted">{isArabic ? 'الحجز القادم' : 'Next booking'}</p>
    <a href="/bookings" class="group flex items-center gap-3 rounded-[18px] border border-border-light bg-surface p-3.5 transition-colors hover:bg-surface-level-1">
      <div class="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[14px] bg-primary-light text-primary">
        <span class="text-[9px] font-extrabold uppercase">{time.month}</span>
        <span class="text-lg font-extrabold leading-none">{time.day}</span>
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="truncate font-bold text-text">{booking.pitches?.name || $_('bookings.unknown_pitch')}</h3>
        <p class="mt-0.5 text-sm text-text-secondary">{time.weekday} · {time.time}</p>
      </div>
      <Icon name={isArabic ? 'chevron-left' : 'chevron-right'} size={18} className="shrink-0 text-text-muted" />
    </a>
  </section>
{/if}

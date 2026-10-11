<script lang="ts">
  import { onMount } from 'svelte'
  import { authState } from '$lib/stores/auth'
  import { _, locale } from 'svelte-i18n'
  import { USE_MOCK } from '$lib/mock'
  import Icon from './Icon.svelte'
  import Button from './Button.svelte'
  import LoadingShape from './LoadingShape.svelte'
  import { getNextBooking, BookingApiError, type MyBooking } from '$lib/bookingApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'

  let booking: MyBooking | null = null
  let loading = true
  let error: string | null = null
  let currentUserId: string | null = null
  let requestVersion = 0
  $: isArabic = ($locale || 'en').startsWith('ar')

  onMount(() => {
    if (USE_MOCK) { booking = null; loading = false; return }
    const unsubscribe = authState.subscribe((state) => {
      const userId = state.user?.id ?? null
      if (state.loading) {
        // A background session refresh must not replace an already loaded card.
        if (userId !== currentUserId) loading = true
        return
      }
      if (userId === currentUserId) { if (!userId) loading = false; return }
      currentUserId = userId
      requestVersion += 1
      booking = null
      error = null
      if (!userId) { loading = false; return }
      void loadBooking(userId)
    })
    return () => { requestVersion += 1; unsubscribe() }
  })

  async function loadBooking(userId: string, force = false) {
    const version = ++requestVersion
    loading = true
    error = null
    try {
      const next = await getNextBooking(userId, force)
      if (version !== requestVersion || userId !== currentUserId) return
      booking = next
    } catch (loadError) {
      if (version !== requestVersion || userId !== currentUserId) return
      const code = loadError instanceof BookingApiError ? loadError.code : 'unknown'
      error = bookingFailureMessage(code, $locale)
    } finally {
      if (version === requestVersion) loading = false
    }
  }

  function formatBookingTime(value: string, timezone: string) {
    const date = new Date(value)
    const currentLocale = $locale || 'en'
    return {
      day: date.toLocaleDateString(currentLocale, { day: 'numeric', timeZone: timezone }),
      month: date.toLocaleDateString(currentLocale, { month: 'short', timeZone: timezone }),
      weekday: date.toLocaleDateString(currentLocale, { weekday: 'long', timeZone: timezone }),
      time: date.toLocaleTimeString(currentLocale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone })
    }
  }
</script>

{#if loading}
  <section class="next-booking loading-card" aria-busy="true" aria-label={$_('common.loading')}>
    <LoadingShape className="h-14 w-14 rounded-2xl" />
    <div class="min-w-0 flex-1 space-y-3"><LoadingShape className="h-3 w-24" /><LoadingShape className="h-4 w-3/4" /><LoadingShape className="h-3 w-28" /></div>
  </section>
{:else if error}
  <div class="booking-load-error" role="alert">
    <p>{error}</p>
    {#if currentUserId}<Button variant="secondary" size="sm" on:click={() => void loadBooking(currentUserId!, true)}>{$_('common.retry')}</Button>{/if}
  </div>
{:else if booking}
  {@const time = formatBookingTime(booking.starts_at, booking.pitches?.timezone || 'Africa/Casablanca')}
  <a href={`/bookings/${booking.id}`} class="next-booking">
    <div class="booking-date"><span>{time.month}</span><strong>{time.day}</strong></div>
    <div class="booking-copy">
      <p class="booking-eyebrow">{booking.lifecycle_status === 'in_progress' ? (isArabic ? 'حجزك الحالي' : 'Current booking') : (isArabic ? 'الحجز القادم' : 'Next booking')}</p>
      <h2>{booking.pitches?.name || $_('bookings.unknown_pitch')}</h2>
      <p class="booking-schedule">{time.weekday} · <span dir="ltr">{time.time}</span></p>
    </div>
    <Icon name={isArabic ? 'chevron-left' : 'chevron-right'} size={20} className="text-text-muted" />
  </a>
{:else}
  <section class="next-booking booking-empty">
    <div class="booking-empty-icon" aria-hidden="true"><Icon name="calendar" size={28} /></div>
    <div class="booking-copy">
      <h2>{isArabic ? 'لا يوجد حجز قادم' : 'No booking yet'}</h2>
      <p class="booking-schedule">{isArabic ? 'اختر مرفقاً أدناه للبدء.' : 'Choose a facility below to get started.'}</p>
    </div>
  </section>
{/if}

<style>
  .next-booking { display: flex; min-height: 112px; align-items: center; gap: 14px; margin-bottom: 24px; padding: 16px; border-radius: var(--radius-lg); background: var(--surface); transition: transform var(--motion-fast), background var(--motion-fast); }
  .booking-empty-icon { display: grid; place-items: center; width: 56px; height: 56px; flex-shrink: 0; border-radius: 16px; color: var(--text-secondary); background: var(--surface-level-1); }
  a.next-booking:active { transform: scale(.99); }
  a.next-booking:hover { background: var(--surface-raised); }
  .booking-date { display: flex; width: 64px; min-height: 72px; flex-shrink: 0; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 4px; border-radius: 18px; background: var(--primary-light); color: var(--primary); }
  .booking-date span { font-size: 12px; font-weight: 650; }
  .booking-date strong { font-size: 30px; line-height: 1; font-weight: 650; letter-spacing: -.04em; }
  .booking-copy { min-width: 0; flex: 1; }
  .booking-eyebrow { margin-bottom: 4px; color: var(--primary); font-size: 12px; font-weight: 600; }
  h2 { color: var(--text); font-size: 18px; line-height: 1.3; font-weight: 650; letter-spacing: -.025em; overflow-wrap: anywhere; }
  .booking-schedule { margin-top: 6px; color: var(--text-secondary); font-size: 13px; }
  .booking-load-error { display: flex; min-height: 112px; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 24px; padding: 16px; border-radius: var(--radius-lg); background: var(--danger-light); }
  .booking-load-error p { min-width: 0; flex: 1 1 180px; color: var(--danger); font-size: 14px; }
  @media (max-width: 359px) { .next-booking { padding: 16px; gap: 12px; } .booking-date { width: 54px; min-height: 64px; } }
  @media (prefers-reduced-motion: reduce) { .next-booking { transition: none; } }
</style>

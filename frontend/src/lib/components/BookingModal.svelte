<script lang="ts">
  import { _, locale } from 'svelte-i18n'
  import { onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import { uiState } from '$lib/stores/ui'
  import { hasFullAccess, authState } from '$lib/stores/auth'
  import { createBooking, getMyBookings, getPitchAvailability, BookingApiError, type AvailabilitySlot, type CreatedBooking } from '$lib/bookingApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'
  import Icon from './Icon.svelte'
  import Modal from './Modal.svelte'
  import Button from './Button.svelte'
  import ActionLink from './ActionLink.svelte'

  export let slotData: AvailabilitySlot & { pitch_name?: string; booking_blocked?: boolean; booking_block_label?: string }
  export let onClose: () => void
  export let onBooked: (booking: CreatedBooking) => void | Promise<void> = () => {}
  export let onUnavailable: () => void | Promise<void> = () => {}

  let open = true
  let blockedByServer = false
  let loading = false
  let error: string | null = null
  let uncertain = false
  let disposed = false
  const operationUser = get(authState).user?.id
  onDestroy(() => { disposed = true })
  function current() { return !disposed && get(authState).user?.id === operationUser }
  $: slot = slotData
  $: ar = ($locale || 'en').startsWith('ar')
  $: blocked = Boolean(slot.booking_blocked) || blockedByServer || !$hasFullAccess

  function formatDate(value: string) {
    return new Intl.DateTimeFormat($locale || 'en', {
      timeZone: slot.timezone || 'Africa/Casablanca', weekday: 'long', month: 'short', day: 'numeric'
    }).format(new Date(value))
  }

  function formatTime(value: string) {
    return new Intl.DateTimeFormat($locale || 'en', {
      timeZone: slot.timezone || 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(value))
  }

  async function confirmBooking() {
    if (loading || !slot.is_available || blocked || !$hasFullAccess) return
    loading = true
    error = null
    try {
      if (uncertain) { await reconcile(); return }
      const booking = await createBooking(slot.pitch_id, slot.datetime_start)
      complete(booking)
    } catch (err) {
      const code = err instanceof BookingApiError ? err.code : 'unknown'
      if (!current()) return
      if (code === 'network' || code === 'unknown') {
        uncertain = true
        await reconcile()
        return
      }
      if (code === 'active_booking_exists' || code === 'booking_frequency_limited' || code === 'account_not_approved' || code === 'slot_unavailable') blockedByServer = true
      if (code === 'slot_unavailable') void Promise.resolve(onUnavailable()).catch(() => undefined)
      error = bookingFailureMessage(code, $locale)
    } finally { loading = false }
  }

  function complete(booking: CreatedBooking) {
    if (!current()) return
    // Paint the confirmed result before waiting for any unrelated refresh.
    void Promise.resolve(onBooked(booking)).catch(() => undefined)
    uiState.addToast(ar ? 'تم الحجز' : 'Booking confirmed', 'success')
    onClose()
  }

  async function reconcile() {
    // The acknowledgement may have been lost. Bound the check as well, leaving
    // the explicit Check booking action available if the network stays down.
    let recovered = false
    function recover(booking: CreatedBooking) {
      if (recovered || !current()) return
      recovered = true
      complete(booking)
    }
    const [, availability] = await Promise.allSettled([
      getMyBookings(undefined, true).then(rows => {
        const booking = rows.find(item => item.pitch_id === slot.pitch_id && Date.parse(item.starts_at) === Date.parse(slot.datetime_start) && item.status === 'scheduled')
        if (booking) recover({ id: booking.id, pitch_id: booking.pitch_id, starts_at: booking.starts_at, ends_at: booking.ends_at, status: 'scheduled' })
      }),
      getPitchAvailability(slot.pitch_id, true).then(rows => {
        const fresh = rows.find(item => Date.parse(item.datetime_start) === Date.parse(slot.datetime_start))
        if (fresh?.booked_by_me && fresh.booking_id && !fresh.is_available) recover({ id: fresh.booking_id, pitch_id: fresh.pitch_id, starts_at: fresh.datetime_start, ends_at: fresh.datetime_end, status: 'scheduled' })
        return fresh
      })
    ])
    if (recovered || !current()) return
    const fresh = availability.status === 'fulfilled' ? availability.value : undefined
    if (fresh && !fresh.is_available && !fresh.booked_by_me) {
      uncertain = false
      blockedByServer = true
      error = bookingFailureMessage('slot_unavailable', $locale)
      void Promise.resolve(onUnavailable()).catch(() => undefined)
      return
    }
    uncertain = true
    error = ar ? 'لم نتمكن من تأكيد الحجز. تحقق من حالته قبل المحاولة مجدداً.' : 'We couldn’t confirm the booking. Check its status before trying again.'
  }
</script>

<Modal bind:open title={ar ? 'تأكيد الحجز' : 'Confirm booking'} closeDisabled={loading} on:close={onClose}>
  <div class="booking-summary">
    <div class="booking-summary-icon"><Icon name="calendar-check" size={24} /></div>
    <h3>{slot.pitch_name || $_('bookings.unknown_pitch')}</h3>
    <p>{formatDate(slot.datetime_start)}</p>
    <p class="booking-time" dir="ltr">{formatTime(slot.datetime_start)}{#if slot.datetime_end}<span>–</span>{formatTime(slot.datetime_end)}{/if}</p>
  </div>
  {#if !$hasFullAccess}
    <p class="booking-notice" role="status">{ar ? 'أكد هويتك الطلابية قبل الحجز.' : 'Verify your student ID before booking.'}</p>
  {:else if slot.booking_block_label && blocked}
    <p class="booking-notice" role="status">{slot.booking_block_label}</p>
  {/if}
  {#if error}<p class="booking-error" role="alert">{error}</p>{/if}
  <svelte:fragment slot="footer">
    {#if !$hasFullAccess}
      <ActionLink href="/verification" variant="primary" size="lg" fullWidth>{ar ? 'تحقق من هويتك' : 'Verify student ID'}</ActionLink>
    {:else}
      <Button on:click={confirmBooking} disabled={!slot.is_available || blocked} {loading} loadingLabel={uncertain ? (ar ? 'جارٍ التحقق…' : 'Checking booking…') : (ar ? 'جارٍ الحجز…' : 'Booking…')} size="lg" fullWidth>
        {#if blocked || !slot.is_available}{ar ? 'غير متاح' : 'Unavailable'}{:else if uncertain}{ar ? 'تحقق من الحجز' : 'Check booking'}{:else}{$_('pitch.confirm_booking')}{/if}
      </Button>
    {/if}
  </svelte:fragment>
</Modal>

<style>
  .booking-summary { padding: 24px 16px; border-radius: var(--radius-lg); background: var(--surface-level-1); text-align: center; }
  .booking-summary-icon { display: grid; width: 48px; height: 48px; margin: 0 auto 16px; place-items: center; border-radius: 16px; color: var(--primary); background: var(--surface); }
  h3 { font-size: 20px; font-weight: 500; line-height: 1.3; letter-spacing: var(--tracking-tight); overflow-wrap: anywhere; }
  .booking-summary p { margin-top: 8px; font-size: 14px; color: var(--text-secondary); }
  .booking-summary .booking-time { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; color: var(--text); font-size: 26px; line-height: 1.3; font-weight: 500; letter-spacing: var(--tracking-tight); }
  .booking-time span { color: var(--text-muted); font-weight: 400; }
  .booking-notice, .booking-error { margin-top: 16px; padding: 12px 16px; border-radius: var(--radius-md); font-size: 14px; line-height: 1.5; }
  .booking-notice { background: var(--warning-light); color: var(--text); }
  .booking-error { background: var(--danger-light); color: var(--danger); }
</style>

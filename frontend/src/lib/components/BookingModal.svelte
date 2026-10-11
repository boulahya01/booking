<script lang="ts">
  import { _, locale } from 'svelte-i18n'
  import { USE_MOCK, mockDelay } from '$lib/mock'
  import { uiState } from '$lib/stores/ui'
  import { hasFullAccess } from '$lib/stores/auth'
  import { createBooking, BookingApiError, type AvailabilitySlot } from '$lib/bookingApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'
  import Icon from './Icon.svelte'
  import Modal from './Modal.svelte'
  import Button from './Button.svelte'
  import ActionLink from './ActionLink.svelte'

  export let slotData: AvailabilitySlot & { pitch_name?: string; booking_blocked?: boolean; booking_block_label?: string }
  export let onClose: () => void
  export let onBooked: () => void | Promise<void> = () => {}

  let open = true
  let blockedByServer = false
  let loading = false
  let error: string | null = null
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
      if (USE_MOCK) await mockDelay()
      else await createBooking(slot.pitch_id, slot.datetime_start)
      uiState.addToast(ar ? 'تم الحجز' : 'Booking confirmed', 'success')
      onClose()
      void Promise.resolve(onBooked()).catch(() => undefined)
    } catch (err) {
      const code = err instanceof BookingApiError ? err.code : 'unknown'
      if (code === 'active_booking_exists' || code === 'booking_frequency_limited' || code === 'account_not_approved') blockedByServer = true
      error = bookingFailureMessage(code, $locale)
    } finally { loading = false }
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
      <Button on:click={confirmBooking} disabled={!slot.is_available || blocked} {loading} size="lg" fullWidth>
        {#if blocked || !slot.is_available}{ar ? 'غير متاح' : 'Unavailable'}{:else}{$_('pitch.confirm_booking')}{/if}
      </Button>
    {/if}
  </svelte:fragment>
</Modal>

<style>
  .booking-summary { padding: 24px 16px; border-radius: var(--radius-lg); background: var(--surface-level-1); text-align: center; }
  .booking-summary-icon { display: grid; width: 48px; height: 48px; margin: 0 auto 16px; place-items: center; border-radius: 16px; color: var(--primary); background: var(--surface); }
  h3 { font-size: 20px; font-weight: 650; line-height: 1.3; letter-spacing: -.025em; overflow-wrap: anywhere; }
  .booking-summary p { margin-top: 8px; font-size: 14px; color: var(--text-secondary); }
  .booking-summary .booking-time { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; color: var(--text); font-size: 26px; line-height: 1.3; font-weight: 650; letter-spacing: -.03em; }
  .booking-time span { color: var(--text-muted); font-weight: 400; }
  .booking-notice, .booking-error { margin-top: 16px; padding: 12px 16px; border-radius: var(--radius-md); font-size: 14px; line-height: 1.5; }
  .booking-notice { background: var(--warning-light); color: var(--text); }
  .booking-error { background: var(--danger-light); color: var(--danger); }
</style>

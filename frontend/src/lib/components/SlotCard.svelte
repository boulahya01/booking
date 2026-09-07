<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  export let slotData: any
  export let onBook: (s: any) => void
  export let onCancel: (s: any) => void = () => {}

  $: slot = slotData
  $: bookedByMe = Boolean(slot.booked_by_me)
  $: state = bookedByMe ? 'mine' : slot.is_available ? 'available' : 'occupied'
  $: blocked = Boolean(slot.booking_blocked)
  $: cancellationBlocked = Boolean(slot.cancellation_blocked)
  $: ar = ($locale || 'en').startsWith('ar')

  function formatTime(value: string) {
    return new Intl.DateTimeFormat($locale || 'en', {
      timeZone: slot.timezone || 'Africa/Casablanca',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(value))
  }
</script>

<article class="flex min-h-[88px] items-center gap-3 rounded-[16px] border border-border-light bg-surface px-4 py-3">
  <div class="min-w-0 flex-1">
    <div class="flex items-end gap-2">
      <span class="text-2xl font-extrabold leading-none tracking-[-0.04em] text-text">{formatTime(slot.datetime_start)}</span>
      {#if slot.datetime_end}<span class="pb-0.5 text-xs font-semibold text-text-muted">{formatTime(slot.datetime_end)}</span>{/if}
    </div>

    {#if state === 'mine'}
      <p class="mt-2 text-xs font-bold text-warning">{ar ? 'حجزك' : 'Your booking'}</p>
    {:else if state === 'occupied'}
      <p class="mt-2 text-xs font-semibold text-text-muted">{$_('pitch.booked')}</p>
    {:else if blocked}
      <p class="mt-2 truncate text-xs font-semibold text-text-muted">{slot.booking_block_label || (ar ? 'الحجز غير متاح دابا' : 'Booking is not available yet')}</p>
    {:else}
      <p class="mt-2 text-xs font-bold text-success">{ar ? 'متاح' : 'Available'}</p>
    {/if}
  </div>

  {#if state === 'mine' && slot.booking_id && !cancellationBlocked}
    <button on:click={() => onCancel(slot)} class="min-h-10 rounded-[12px] px-3 text-sm font-bold text-danger hover:bg-danger-light">{$_('pitch.cancel_booking')}</button>
  {:else if state === 'mine' && cancellationBlocked}
    <span class="max-w-[108px] text-end text-xs font-bold leading-5 text-warning">{slot.cancellation_block_label || (ar ? 'قريب بزاف' : 'Starts soon')}</span>
  {:else if state === 'available' && !blocked}
    <button on:click={() => onBook(slot)} class="min-h-10 min-w-[76px] rounded-[12px] bg-[var(--primary-action)] px-4 text-sm font-extrabold text-white hover:bg-[var(--primary-action-hover)]">{$_('pitch.book')}</button>
  {:else if state === 'available' && blocked}
    <span class="inline-flex min-h-9 min-w-[68px] items-center justify-center rounded-full bg-surface-level-1 px-3 text-sm font-extrabold text-text-secondary">{slot.booking_block_countdown || '—'}</span>
  {:else}
    <span class="min-w-[68px] text-end text-sm font-semibold text-text-muted">{ar ? 'محجوز' : 'Booked'}</span>
  {/if}
</article>

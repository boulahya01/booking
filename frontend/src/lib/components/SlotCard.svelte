<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  export let slotData: any
  export let onBook: (s: any) => void
  export let onCancel: (s: any) => void = () => {}

  $: slot = slotData
  $: bookedByMe = Boolean(slot.booked_by_me)
  $: state = bookedByMe ? 'mine' : slot.is_available ? 'available' : 'occupied'
  $: blocked = Boolean(slot.booking_blocked)
  $: ar = ($locale || 'en').startsWith('ar')

  function formatTime(value: string) {
    return new Intl.DateTimeFormat($locale || 'en', {
      timeZone: slot.timezone || 'Africa/Casablanca',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(value))
  }
</script>

<div class="flex min-h-[68px] items-center gap-3 border-b border-border-light px-1 py-2.5 last:border-b-0">
  <div class="min-w-0 flex-1">
    <p class="text-[17px] font-bold tracking-[-0.02em] text-text">
      {formatTime(slot.datetime_start)}{#if slot.datetime_end}<span class="font-medium text-text-muted">–{formatTime(slot.datetime_end)}</span>{/if}
    </p>
    {#if state === 'mine'}
      <p class="mt-0.5 text-xs font-semibold text-warning">{ar ? 'حجزك' : 'Your booking'}</p>
    {:else if state === 'occupied'}
      <p class="mt-0.5 text-xs font-semibold text-text-muted">{$_('pitch.booked')}</p>
    {:else if blocked}
      <p class="mt-0.5 text-xs font-semibold text-text-muted">{slot.booking_block_label || (ar ? 'غير متاح ليك دابا' : 'Not available for you')}</p>
    {:else}
      <p class="mt-0.5 text-xs font-semibold text-success">{ar ? 'متاح' : 'Available'}</p>
    {/if}
  </div>

  {#if state === 'mine' && slot.booking_id}
    <button on:click={() => onCancel(slot)} class="min-h-10 rounded-[12px] px-3 text-sm font-bold text-danger hover:bg-danger-light">{$_('pitch.cancel_booking')}</button>
  {:else if state === 'available' && !blocked}
    <button on:click={() => onBook(slot)} class="min-h-10 rounded-[12px] bg-[var(--primary-action)] px-4 text-sm font-bold text-white hover:bg-[var(--primary-action-hover)]">{$_('pitch.book')}</button>
  {:else}
    <span class="min-w-[66px] text-end text-sm font-semibold text-text-muted">{state === 'occupied' ? (ar ? 'محجوز' : 'Booked') : (ar ? 'غير متاح' : 'Unavailable')}</span>
  {/if}
</div>

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
    return new Intl.DateTimeFormat($locale || 'en', { timeZone: slot.timezone || 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
  }
</script>

<article class="flex min-h-[64px] items-center gap-3 bg-surface px-3.5 py-2.5">
  <div class="min-w-0 flex-1">
    <div class="flex items-baseline gap-1.5">
      <span class="text-lg font-extrabold tracking-[-0.03em] text-text">{formatTime(slot.datetime_start)}</span>
      {#if slot.datetime_end}<span class="text-sm font-semibold text-text-muted">– {formatTime(slot.datetime_end)}</span>{/if}
    </div>
    {#if state === 'mine'}<p class="mt-0.5 text-xs font-bold text-primary">{ar ? 'حجزك' : 'Your booking'}</p>{/if}
  </div>

  {#if state === 'mine' && slot.booking_id && !cancellationBlocked}
    <button on:click={() => onCancel(slot)} class="min-h-10 rounded-[11px] px-3 text-sm font-bold text-danger hover:bg-danger-light">{ar ? 'إلغاء' : 'Cancel'}</button>
  {:else if state === 'mine' && cancellationBlocked}
    <span class="max-w-[108px] text-end text-xs font-bold leading-5 text-warning">{slot.cancellation_block_label || (ar ? 'قريب بزاف' : 'Starts soon')}</span>
  {:else if state === 'available' && !blocked}
    <button on:click={() => onBook(slot)} class="min-h-10 min-w-[72px] rounded-[11px] bg-[var(--primary-action)] px-4 text-sm font-extrabold text-white hover:bg-[var(--primary-action-hover)]">{$_('pitch.book')}</button>
  {:else if state === 'available' && blocked}
    <span class="text-xs font-semibold text-text-muted">{ar ? 'لاحقاً' : 'Later'}</span>
  {:else}
    <span class="text-xs font-semibold text-text-muted">{ar ? 'محجوز' : 'Booked'}</span>
  {/if}
</article>

<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  export let slotData: any
  export let onBook: (s: any) => void
  export let onView: (s: any) => void = () => {}

  $: slot = slotData
  $: ar = ($locale || 'en').startsWith('ar')
  $: available = Boolean(slot.is_available)
  $: blocked = Boolean(slot.booking_blocked)
  $: open = Boolean(slot.match_open)
  $: usedSpots = Math.min(
    Number(slot.capacity || 1),
    1 + Number(slot.reserved_spots || 0) + Number(slot.joined_count || 0)
  )

  function formatTime(value: string) {
    return new Intl.DateTimeFormat($locale || 'en', {
      timeZone: slot.timezone || 'Africa/Casablanca',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(value))
  }
</script>

<article class="flex min-h-[82px] items-center gap-3 bg-surface px-3.5 py-3">
  <div class="w-[112px] shrink-0">
    <div class="flex items-baseline gap-1.5">
      <span class="text-[25px] font-extrabold leading-none tracking-[-0.04em] text-text">
        {formatTime(slot.datetime_start)}
      </span>
      {#if slot.datetime_end}
        <span class="text-xs font-semibold text-text-muted">– {formatTime(slot.datetime_end)}</span>
      {/if}
    </div>
  </div>

  <div class="min-w-0 flex-1">
    {#if available}
      <p class="flex items-center gap-2 text-sm font-semibold text-text-secondary">
        <span class="h-2 w-2 rounded-full bg-success"></span>
        {ar ? 'متاح' : 'Available'}
      </p>
      {#if blocked}
        <p class="mt-1 truncate text-xs font-semibold text-text-muted">
          {slot.booking_block_label || (ar ? 'يمكنك الحجز لاحقاً' : 'Available later')}
        </p>
      {/if}
    {:else}
      <p class="truncate text-sm font-semibold text-text-secondary">
        {ar ? 'محجوز بواسطة' : 'Booked by'}
        <span class="font-bold text-text">
          {slot.booker_username ? `@${slot.booker_username}` : slot.booker_name || (ar ? 'طالب' : 'student')}
        </span>
      </p>
      {#if open}
        <p class="mt-1 flex items-center gap-1.5 text-xs font-bold text-success">
          <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
          {ar ? 'مفتوح' : 'Open'} · {usedSpots}/{slot.capacity}
        </p>
      {/if}
    {/if}
  </div>

  {#if available}
    <button
      type="button"
      disabled={blocked}
      on:click={() => onBook(slot)}
      class="min-h-10 min-w-[72px] rounded-[11px] bg-[var(--primary-action)] px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-35"
    >
      {$_('pitch.book')}
    </button>
  {:else}
    <button
      type="button"
      on:click={() => onView(slot)}
      class="min-h-10 min-w-[72px] rounded-[11px] bg-surface-level-1 px-4 text-sm font-extrabold text-text hover:bg-surface-level-2"
    >
      {ar ? 'عرض' : 'View'}
    </button>
  {/if}
</article>

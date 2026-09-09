<script lang="ts">
  import Button from './Button.svelte'
  import ActionLink from './ActionLink.svelte'
  import { hasFullAccess } from '$lib/stores/auth'
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
  $: placesLeft = Math.max(0, Number(slot.capacity || 1) - usedSpots)

  function formatTime(value: string) {
    return new Intl.DateTimeFormat($locale || 'en', {
      timeZone: slot.timezone || 'Africa/Casablanca',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(value))
  }
</script>

<article class="slot-card" aria-label={`${formatTime(slot.datetime_start)} – ${formatTime(slot.datetime_end)}`}>
  <div class="slot-top">
    <div class="slot-time" dir="ltr">
      <time datetime={slot.datetime_start}>{formatTime(slot.datetime_start)}</time>
      <span aria-hidden="true">–</span>
      <time class="slot-end" datetime={slot.datetime_end}>{formatTime(slot.datetime_end)}</time>
    </div>
    <span class="slot-status" class:slot-status--available={available} class:slot-status--open={!available && open && placesLeft > 0}>
      <span class="slot-dot" aria-hidden="true"></span>
      {available ? (ar ? 'متاح' : 'Available') : open && placesLeft > 0 ? (ar ? 'مفتوح' : 'Open') : (ar ? 'محجوز' : 'Booked')}
    </span>
  </div>
  {#if !available || blocked}
  <div class="slot-details">
    {#if available}
      {#if blocked}<p class="slot-policy">{slot.booking_block_label || (ar ? 'يمكنك الحجز لاحقاً' : 'Available later')}</p>{/if}
    {:else}
      <p>{ar ? 'محجوز بواسطة' : 'Booked by'} <strong>{slot.booker_username ? `@${slot.booker_username}` : slot.booker_name || (ar ? 'طالب' : 'student')}</strong></p>
      {#if open}
        <p>{placesLeft > 0 ? (ar ? `${placesLeft} أماكن متاحة` : `${placesLeft} places left`) : (ar ? 'مكتمل' : 'Full')}</p>
      {/if}
    {/if}
  </div>
  {/if}
  <div class="slot-action">
    {#if available && !$hasFullAccess}
      <ActionLink href="/verification" variant="secondary" size="sm" fullWidth>{ar ? 'تحقق' : 'Verify'}</ActionLink>
    {:else if available}
      <Button fullWidth size="sm" disabled={blocked} on:click={() => onBook(slot)}>{$_('pitch.book')}</Button>
    {:else}
      <Button fullWidth size="sm" variant="secondary" disabled={!slot.booking_id} on:click={() => onView(slot)}>{ar ? 'عرض الحجز' : 'View booking'}</Button>
    {/if}
  </div>
</article>

<style>
  .slot-card { display: flex; min-width: 0; height: 100%; flex-direction: column; gap: 14px; padding: 16px; border-radius: var(--radius-lg); background: var(--surface); }
  .slot-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .slot-status { display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px; border-radius: 99px; background: var(--surface-level-1); color: var(--text-secondary); font-size: 12px; font-weight: 650; line-height: 18px; }
  .slot-status--available { color: var(--success); background: var(--success-light); }
  .slot-status--open { color: var(--primary); background: var(--primary-light); }
  .slot-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
  .slot-time { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px; align-self: flex-start; font-variant-numeric: tabular-nums; }
  .slot-time time { font-size: 26px; font-weight: 650; letter-spacing: -.035em; line-height: 1.2; }
  .slot-time > span { font-size: 18px; color: var(--text-muted); }
  .slot-time .slot-end { font-size: 18px; font-weight: 500; color: var(--text-secondary); }
  .slot-details { display: grid; gap: 4px; color: var(--text-secondary); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
  .slot-details strong { font-weight: 600; color: var(--text); }
  .slot-policy { font-size: 13px; }
  .slot-action { margin-top: auto; }
</style>

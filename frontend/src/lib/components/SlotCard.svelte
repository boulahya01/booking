<script lang="ts">
  import Button from './Button.svelte'
  import ActionLink from './ActionLink.svelte'
  import Icon from './Icon.svelte'
  import { hasFullAccess } from '$lib/stores/auth'
  import { _, locale } from 'svelte-i18n'

  export let slotData: any
  export let onBook: (s: any) => void
  export let onView: (s: any) => void = () => {}

  $: slot = slotData
  $: ar = ($locale || 'en').startsWith('ar')
  $: available = Boolean(slot.is_available)
  $: mine = !available && Boolean(slot.booked_by_me)
  $: joined = !available && !mine && Boolean(slot.joined_by_me)
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

<article class="slot-card" class:slot-card--mine={mine} class:slot-card--joined={joined} aria-label={`${formatTime(slot.datetime_start)} – ${formatTime(slot.datetime_end)}`}>
  <div class="slot-top">
    <div class="slot-time" dir="ltr">
      <time datetime={slot.datetime_start}>{formatTime(slot.datetime_start)}</time>
      <span aria-hidden="true">–</span>
      <time class="slot-end" datetime={slot.datetime_end}>{formatTime(slot.datetime_end)}</time>
    </div>
    {#if !available}
    <span class="slot-status" class:slot-status--open={mine || joined || (open && placesLeft > 0)}>
      {#if mine || joined}<Icon name={mine ? 'calendar-check' : 'users'} size={14}/>{:else}<span class="slot-dot" aria-hidden="true"></span>{/if}
      {mine ? (ar ? 'حجزك' : 'Your booking') : joined ? (ar ? 'أنت مشارك' : 'You’re playing') : open && placesLeft > 0 ? (ar ? 'مباراة مفتوحة' : 'Open match') : open ? (ar ? 'مكتمل' : 'Full') : (ar ? 'محجوز' : 'Booked')}
    </span>
    {/if}
  </div>
  {#if !available}
  <div class="slot-details">
      {#if !mine}<p>{ar ? 'محجوز بواسطة' : 'Booked by'} <span>{slot.booker_username ? `@${slot.booker_username}` : slot.booker_name || (ar ? 'طالب' : 'student')}</span></p>{/if}
      {#if mine && open}<p>{ar ? 'مباراتك مفتوحة للاعبين' : 'Your match is open to players'}</p>{/if}
      {#if open}
        <p>{placesLeft > 0 ? (ar ? `${placesLeft} أماكن متاحة` : `${placesLeft} places left`) : (ar ? 'مكتمل' : 'Full')}</p>
      {/if}
  </div>
  {/if}
  <div class="slot-action">
    {#if available && !$hasFullAccess}
      <ActionLink href="/verification" variant="secondary" size="sm" fullWidth>{ar ? 'تحقق' : 'Verify'}</ActionLink>
    {:else if available}
      <Button fullWidth size="sm" variant={blocked ? 'secondary' : 'primary'} disabled={blocked} aria-describedby={blocked ? 'booking-policy' : undefined} on:click={() => onBook(slot)}>{blocked ? (ar ? 'احجز لاحقاً' : 'Book later') : $_('pitch.book')}</Button>
    {:else}
      <Button fullWidth size="sm" variant="secondary" disabled={!slot.booking_id} on:click={() => onView(slot)}>{mine ? (ar ? 'عرض حجزك' : 'View your booking') : open || joined ? (ar ? 'عرض المباراة' : 'View match') : (ar ? 'عرض الحجز' : 'View booking')}</Button>
    {/if}
  </div>
</article>

<style>
  .slot-card { display: flex; min-width: 0; height: 100%; flex-direction: column; gap: 14px; padding: 16px; border-radius: var(--radius-lg); background: var(--surface); }
  .slot-card--mine { background: var(--primary-light); box-shadow: inset 0 0 0 1px var(--primary); }
  .slot-card--joined { box-shadow: inset 0 0 0 1px var(--border); }
  .slot-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .slot-status { display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px; border-radius: 99px; background: var(--surface-level-1); color: var(--text-secondary); font-size: 12px; font-weight: 500; line-height: 18px; }
  .slot-status--open { color: var(--primary); background: var(--primary-light); }
  .slot-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
  .slot-time { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px; align-self: flex-start; font-variant-numeric: tabular-nums; }
  .slot-time time { font-size: 26px; font-weight: 500; letter-spacing: var(--tracking-tight); line-height: 1.2; }
  .slot-time > span { font-size: 18px; color: var(--text-muted); }
  .slot-time .slot-end { font-size: 18px; font-weight: 500; color: var(--text-secondary); }
  .slot-details { display: grid; gap: 4px; color: var(--text-secondary); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
  .slot-action { margin-top: auto; }
</style>

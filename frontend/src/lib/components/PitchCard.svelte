<script lang="ts">
  import { _, locale } from 'svelte-i18n'
  import Icon from './Icon.svelte'

  export let pitch: any

  $: closeTime = pitch.close_time ? pitch.close_time.slice(0, 5) : ''
  $: isMidnight = closeTime === '00:00' && pitch.open_time?.slice(0, 5) !== '00:00'
  $: displayCloseTime = isMidnight ? '24:00' : closeTime
  $: isArabic = ($locale || 'en').startsWith('ar')
</script>

<a href={`/pitch/${pitch.id}`} class="group flex min-h-[78px] items-center gap-3 rounded-[18px] border border-border-light bg-surface px-3.5 py-3 transition-colors hover:bg-surface-level-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
  <div class="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-primary-light text-primary">
    <Icon name="trophy" size={19} />
  </div>

  <div class="min-w-0 flex-1">
    <h3 class="truncate text-[15px] font-bold tracking-[-0.015em] text-text">{pitch.name}</h3>
    <p class="mt-0.5 flex items-center gap-1.5 text-sm text-text-secondary">
      <Icon name="map-pin" size={13} className="shrink-0" />
      <span class="truncate">{pitch.location || $_('bookings.unknown_location')}</span>
    </p>
    {#if pitch.open_time && pitch.close_time}
      <p class="mt-1 text-xs font-medium text-text-muted">{pitch.open_time.slice(0, 5)}–{displayCloseTime}</p>
    {/if}
  </div>

  <Icon name={isArabic ? 'chevron-left' : 'chevron-right'} size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
</a>

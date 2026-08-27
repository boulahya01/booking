<script lang="ts">
  import { _ , locale } from 'svelte-i18n'
  import Icon from './Icon.svelte'

  export let pitch: any

  $: closeTime = pitch.close_time ? pitch.close_time.slice(0, 5) : ''
  $: isMidnight = closeTime === '00:00' && pitch.open_time?.slice(0, 5) !== '00:00'
  $: displayCloseTime = isMidnight ? '24:00' : closeTime
  $: isArabic = ($locale || 'en').startsWith('ar')
</script>

<a href={`/pitch/${pitch.id}`} class="group block rounded-[22px] border border-border-light bg-surface p-4 shadow-xs transition-colors hover:bg-surface-level-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
  <div class="flex items-start gap-3.5">
    <div class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary">
      <Icon name="trophy" size={21} />
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="truncate text-base font-bold tracking-[-0.015em] text-text">{pitch.name}</h3>
          <p class="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
            <Icon name="map-pin" size={13} className="shrink-0" />
            <span class="truncate">{pitch.location || $_('bookings.unknown_location')}</span>
          </p>
        </div>
        <Icon name={isArabic ? 'arrow-left' : 'arrow-right'} size={17} className="mt-1 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-text-muted">
        {#if pitch.sport_type}
          <span class="capitalize font-semibold text-primary">{pitch.sport_type}</span>
        {/if}
        {#if pitch.open_time && pitch.close_time}
          <span class="inline-flex items-center gap-1.5"><Icon name="clock" size={12} />{pitch.open_time.slice(0, 5)}–{displayCloseTime}</span>
        {/if}
        {#if pitch.capacity}
          <span class="inline-flex items-center gap-1.5"><Icon name="users" size={12} />{pitch.capacity}</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="mt-4 flex min-h-11 items-center justify-between rounded-2xl bg-primary-light px-3.5 text-sm font-bold text-primary">
    <span>{isArabic ? 'شوف الأوقات' : 'View times'}</span>
    <Icon name="clock" size={16} />
  </div>
</a>

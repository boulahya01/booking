<script lang="ts">
  import { _ , locale } from 'svelte-i18n'
  import Icon from './Icon.svelte'

  export let pitch: any

  $: closeTime = pitch.close_time ? pitch.close_time.slice(0, 5) : ''
  $: isMidnight = closeTime === '00:00' && pitch.open_time?.slice(0, 5) !== '00:00'
  $: displayCloseTime = isMidnight ? '24:00' : closeTime
  $: isArabic = ($locale || 'en').startsWith('ar')
</script>

<a
  href={`/pitch/${pitch.id}`}
  class="group block overflow-hidden rounded-2xl transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
  style="background: var(--surface); border: 1px solid var(--border);"
>
  <div class="relative flex min-h-[92px] items-end overflow-hidden px-4 py-3" style="background: var(--surface-level-1);">
    <div class="absolute -right-5 -top-5 h-24 w-24 rounded-full opacity-70" style="background: var(--primary-light);"></div>
    <div class="relative flex w-full items-end justify-between gap-3">
      <div class="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm" style="background: var(--surface); color: var(--primary);">
        <Icon name="trophy" size={20} />
      </div>

      {#if pitch.sport_type}
        <span class="rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize" style="background: var(--surface); color: var(--text-secondary);">
          {pitch.sport_type}
        </span>
      {/if}
    </div>
  </div>

  <div class="p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate text-base font-semibold tracking-[-0.01em] transition-colors group-hover:text-primary" style="color: var(--text);">
          {pitch.name}
        </h3>
        <p class="mt-1 flex items-center gap-1.5 text-sm" style="color: var(--text-secondary);">
          <Icon name="map-pin" size={13} className="flex-shrink-0" />
          <span class="truncate">{pitch.location || $_('bookings.unknown_location')}</span>
        </p>
      </div>

      <span class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors group-hover:bg-primary-light group-hover:text-primary" style="color: var(--text-muted);">
        <Icon name="chevron-right" size={16} />
      </span>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      {#if pitch.open_time && pitch.close_time}
        <span class="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium" style="background: var(--surface-level-1); color: var(--text-secondary);">
          <Icon name="clock" size={12} />
          {pitch.open_time.slice(0, 5)}–{displayCloseTime}
        </span>
      {/if}
      {#if pitch.capacity}
        <span class="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium" style="background: var(--surface-level-1); color: var(--text-secondary);">
          <Icon name="users" size={12} />
          {pitch.capacity}
        </span>
      {/if}
    </div>

    <div class="mt-4 flex min-h-[44px] items-center justify-between rounded-xl px-3.5 transition-colors group-hover:bg-primary-light" style="background: var(--surface-level-1);">
      <span class="text-sm font-semibold" style="color: var(--primary);">
        {isArabic ? 'شوف الأوقات' : 'See available times'}
      </span>
      <Icon name="arrow-right" size={15} className="text-primary" />
    </div>
  </div>
</a>

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import Icon from './Icon.svelte'

  export let pitch: any

  $: closeTime = pitch.close_time ? pitch.close_time.slice(0, 5) : ''
  $: isMidnight = closeTime === '00:00' && pitch.open_time?.slice(0, 5) !== '00:00'
  $: displayCloseTime = isMidnight ? '24:00' : closeTime
</script>

<a
  href={`/pitch/${pitch.id}`}
  class="group relative block overflow-hidden rounded-xl bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
>
  <!-- Top accent gradient -->
  <div class="h-1 bg-gradient-to-r from-primary/60 via-primary/40 to-transparent"></div>

  <div class="p-4">
    <div class="flex items-start gap-3.5">
      <!-- Icon -->
      <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-primary/15 to-primary/5 text-primary group-hover:from-primary/25 group-hover:to-primary/10 transition-all duration-300">
        <Icon name="trophy" size={22} />
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold truncate group-hover:text-primary transition-colors">
          {pitch.name}
        </h3>

        <!-- Location -->
        <p class="text-sm flex items-center gap-1.5 mt-1 text-text-secondary">
          <Icon name="map-pin" size={13} />
          <span class="truncate">{pitch.location || $_('bookings.unknown_location')}</span>
        </p>

        <!-- Hours -->
        {#if pitch.open_time && pitch.close_time}
          <div class="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-md bg-surface-level-1/60">
            <Icon name="clock" size={12} className="text-text-muted" />
            <span class="text-[11px] font-medium text-text-muted">
              {pitch.open_time.slice(0, 5)} — {displayCloseTime}
            </span>
          </div>
        {/if}
      </div>

      <!-- Chevron -->
      <div class="flex-shrink-0 self-center">
        <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-surface-level-1/80 text-text-muted group-hover:bg-primary group-hover:text-white transition-all duration-300">
          <Icon name="chevron-right" size={14} />
        </span>
      </div>
    </div>
  </div>
</a>

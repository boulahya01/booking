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
  class="group block rounded-xl bg-surface transition duration-200 hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
  style="border: 1px solid var(--border);"
>
  <div class="p-4">
    <div class="flex items-start gap-3">
      <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-light text-primary">
        <Icon name="trophy" size={19} />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-semibold truncate text-text group-hover:text-primary transition-colors">
              {pitch.name}
            </h3>
            {#if pitch.sport_type}
              <p class="mt-0.5 text-xs font-medium text-text-muted capitalize">{pitch.sport_type}</p>
            {/if}
          </div>

          <span class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-text-muted group-hover:text-primary group-hover:bg-primary-light transition-colors">
            <Icon name="chevron-right" size={16} />
          </span>
        </div>

        <div class="mt-3 space-y-1.5">
          <p class="text-sm flex items-center gap-1.5 text-text-secondary">
            <Icon name="map-pin" size={13} className="flex-shrink-0" />
            <span class="truncate">{pitch.location || $_('bookings.unknown_location')}</span>
          </p>

          {#if pitch.open_time && pitch.close_time}
            <p class="text-sm flex items-center gap-1.5 text-text-muted">
              <Icon name="clock" size={13} className="flex-shrink-0" />
              <span>{pitch.open_time.slice(0, 5)} — {displayCloseTime}</span>
            </p>
          {/if}
        </div>
      </div>
    </div>
  </div>
</a>

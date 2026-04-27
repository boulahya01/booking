<script lang="ts">
  import { _ } from 'svelte-i18n'
  import Icon from './Icon.svelte'

  export let pitch: any
</script>

<a
  href={`/pitch/${pitch.id}`}
  class="group block p-4 rounded-xl transition-all duration-200"
  style="background: var(--surface); border: 1px solid var(--border); box-shadow: 0 0 0 1px var(--border);"
>
  <div class="flex items-start gap-3">
    <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-primary/20"
         style="background: var(--primary-light);">
      <Icon name="trophy" size={22} className="text-primary" />
    </div>
    <div class="flex-1 min-w-0">
      <h3 class="font-semibold truncate transition-colors group-hover:text-primary"
          style="color: var(--text);">
        {pitch.name}
      </h3>
      <p class="text-sm flex items-center gap-1 mt-0.5" style="color: var(--text-muted);">
        <Icon name="map-pin" size={13} />
        <span class="truncate">{pitch.location || $_('bookings.unknown_location')}</span>
      </p>
      {#if pitch.open_time && pitch.close_time}
        <p class="text-xs flex items-center gap-1 mt-1" style="color: var(--text-muted);">
          <Icon name="clock" size={12} />
          {pitch.open_time.slice(0, 5)} — {pitch.close_time.slice(0, 5)}
        </p>
      {/if}
    </div>
    <div class="flex-shrink-0 self-center">
      <span class="inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors group-hover:bg-primary group-hover:text-white"
            style="background: var(--surface-level-1); color: var(--text-muted);">
        <Icon name="chevron-right" size={14} />
      </span>
    </div>
  </div>
</a>

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { authState } from '$lib/stores/auth'
  import Icon from './Icon.svelte'

  export let slotData: any
  export let onBook: (s: any) => void
  export let onCancel: (s: any) => void = () => {}

  $: slot = slotData
  $: bookedByMe = Boolean(slot.booked_by_me)
  $: state = bookedByMe ? 'mine' : slot.is_available ? 'available' : 'occupied'

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }
</script>

<article
  class="group rounded-2xl p-4 transition-colors"
  style={state === 'mine'
    ? 'background: var(--warning-light); border: 1px solid color-mix(in srgb, var(--warning) 28%, var(--border));'
    : state === 'available'
      ? 'background: var(--surface); border: 1px solid var(--border);'
      : 'background: var(--surface-level-1); border: 1px solid var(--border);'}
  aria-label={bookedByMe ? $_('pitch.booked_by_you') : slot.is_available ? $_('pitch.book') : $_('pitch.booked')}
>
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0">
      <div class="flex items-baseline gap-2">
        <span class="text-2xl font-semibold tracking-tight" style="color: var(--text);">
          {formatTime(slot.datetime_start)}
        </span>
        {#if slot.datetime_end}
          <span class="text-sm" style="color: var(--text-muted);">
            — {formatTime(slot.datetime_end)}
          </span>
        {/if}
      </div>

      <div class="mt-2 flex items-center gap-2 text-sm">
        {#if state === 'available'}
          <span class="inline-flex items-center gap-1.5 font-medium" style="color: var(--primary);">
            <span class="h-2 w-2 rounded-full" style="background: var(--primary);"></span>
            {$_('pitch.book')}
          </span>
        {:else if state === 'mine'}
          <span class="inline-flex items-center gap-1.5 font-medium" style="color: var(--warning);">
            <Icon name="check" size={14} />
            {$_('pitch.booked_by_you')}
          </span>
        {:else}
          <span class="inline-flex items-center gap-1.5 font-medium" style="color: var(--text-muted);">
            <span class="h-2 w-2 rounded-full" style="background: var(--text-muted);"></span>
            {$_('pitch.booked')}
          </span>
        {/if}
      </div>
    </div>

    {#if state === 'mine'}
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style="background: var(--surface); color: var(--warning);">
        <Icon name="user" size={18} />
      </div>
    {:else if state === 'available'}
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style="background: var(--primary-light); color: var(--primary);">
        <Icon name="clock" size={18} />
      </div>
    {:else}
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style="background: var(--surface-level-2); color: var(--text-muted);">
        <Icon name="lock" size={17} />
      </div>
    {/if}
  </div>

  {#if state === 'mine'}
    <div class="mt-3 text-sm" style="color: var(--text-secondary);">
      {$authState.user?.full_name || $_('pitch.booked_by_you')}
    </div>
  {:else if state === 'occupied' && slot.booker_name}
    <div class="mt-3 truncate text-sm" style="color: var(--text-secondary);">
      {slot.booker_name}
    </div>
  {/if}

  <div class="mt-4">
    {#if state === 'mine' && slot.booking_id}
      <button
        on:click={() => onCancel(slot)}
        class="min-h-[48px] w-full rounded-xl px-4 text-sm font-semibold transition-colors"
        style="background: var(--surface); color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 24%, var(--border));"
      >
        {$_('pitch.cancel_booking')}
      </button>
    {:else if state === 'available'}
      <button
        on:click={() => onBook(slot)}
        class="min-h-[48px] w-full rounded-xl px-4 text-sm font-semibold text-white transition-opacity hover:opacity-95 active:opacity-90"
        style="background: var(--primary);"
      >
        {$_('pitch.book')}
      </button>
    {:else}
      <div
        class="flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 text-sm font-medium"
        style="background: var(--surface-level-2); color: var(--text-muted);"
      >
        {$_('pitch.booked')}
      </div>
    {/if}
  </div>
</article>

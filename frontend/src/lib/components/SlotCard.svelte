<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { authState } from '$lib/stores/auth'

  export let slotData: any
  export let onBook: (s: any) => void
  export let onCancel: (s: any) => void = () => {}

  const slot = slotData
  $: bookedByMe = Boolean(slot.booked_by_me)

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }
</script>

<div
  class="w-full rounded-xl flex flex-col justify-between
    transition-all duration-300 ease-in-out
    {bookedByMe
      ? 'bg-warning/5 hover:-translate-y-1'
      : slot.is_available
        ? 'bg-surface hover:-translate-y-1'
        : 'bg-surface-level-1 opacity-85 cursor-not-allowed'}"
  style={bookedByMe
    ? 'border: 1px solid var(--border); border-top: 3px solid var(--warning); box-shadow: 0 0 0 1px var(--border);'
    : slot.is_available
      ? 'border: 1px solid var(--border); box-shadow: 0 0 0 1px var(--border);'
      : 'border: 1px solid var(--border); opacity: 0.85;'}
  aria-label={bookedByMe ? $_('pitch.booked_by_you') : slot.is_available ? $_('pitch.book') : $_('pitch.booked')}
>
  <div class="text-center pt-5 pb-3 px-4">
    <div class="font-medium tracking-tight leading-none
      {bookedByMe ? 'text-warning' : slot.is_available ? 'text-primary' : 'text-text-muted/60'}"
      style="font-size: clamp(2.5rem, 8vw, 3.5rem);"
    >
      {formatTime(slot.datetime_start)}
    </div>
    {#if slot.datetime_end}
      <div class="text-sm font-medium mt-1.5" style="color: var(--text-muted);">
        {formatTime(slot.datetime_end)}
      </div>
    {/if}
  </div>

  {#if bookedByMe}
    <div class="flex items-center justify-center gap-2.5 px-4 pb-3">
      <div class="flex items-center justify-center gap-2 px-3 py-2 rounded-lg" style="background: var(--warning-light);">
        <div class="flex items-center justify-center w-6 h-6 rounded-md text-white font-bold" style="background: var(--primary-gradient);">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <span class="text-sm font-medium truncate" style="color: var(--text);">{$authState.user?.full_name || $_('pitch.booked_by_you')}</span>
      </div>
    </div>
  {:else if !slot.is_available && slot.booker_name}
    <div class="flex items-center justify-center gap-2.5 px-4 pb-3">
      <div class="flex items-center justify-center gap-2 px-3 py-2 rounded-lg" style="background: var(--surface-level-2);">
        <div class="flex items-center justify-center w-6 h-6 rounded-md font-bold" style="background: var(--surface-level-1); color: var(--text-muted);">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <span class="text-sm font-medium truncate" style="color: var(--text-muted);">{slot.booker_name}</span>
      </div>
    </div>
  {/if}

  <div class="px-4 pb-4 mt-auto">
    {#if bookedByMe && slot.booking_id}
      <button
        on:click={() => onCancel(slot)}
        class="w-full px-4 py-3 rounded-lg text-white text-sm font-semibold tracking-wide
          transition-all duration-250 hover:-translate-y-0.5 active:translate-y-0
          disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        style="background: var(--danger); box-shadow: 0 0 0 1px var(--danger);"
      >
        {$_('pitch.cancel_booking')}
      </button>
    {:else if slot.is_available}
      <button
        on:click={() => onBook(slot)}
        class="w-full px-4 py-3 rounded-lg text-white text-sm font-semibold tracking-wide
          transition-all duration-250 hover:-translate-y-0.5 active:translate-y-0
          disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        style="background: var(--primary-gradient); box-shadow: 0 0 0 1px var(--primary);"
      >
        {$_('pitch.book')}
      </button>
    {:else}
      <div class="w-full px-4 py-3 rounded-lg text-center text-sm font-semibold tracking-wide"
        style="background: var(--surface-level-2); color: var(--text-muted); border: 1px solid var(--border);">
        {$_('pitch.booked')}
      </div>
    {/if}
  </div>
</div>

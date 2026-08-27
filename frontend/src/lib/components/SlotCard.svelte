<script lang="ts">
  import { _, locale } from 'svelte-i18n'
  import { authState } from '$lib/stores/auth'
  import Icon from './Icon.svelte'

  export let slotData: any
  export let onBook: (s: any) => void
  export let onCancel: (s: any) => void = () => {}

  $: slot = slotData
  $: bookedByMe = Boolean(slot.booked_by_me)
  $: state = bookedByMe ? 'mine' : slot.is_available ? 'available' : 'occupied'
  $: ar = ($locale || 'en').startsWith('ar')

  function formatTime(value: string) {
    return new Intl.DateTimeFormat($locale || 'en', {
      timeZone: slot.timezone || 'Africa/Casablanca',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(value))
  }
</script>

<article
  class="rounded-[22px] border p-4"
  class:border-primary={state === 'available'}
  class:border-warning={state === 'mine'}
  class:border-border-light={state === 'occupied'}
  class:bg-surface={state !== 'occupied'}
  class:bg-surface-level-1={state === 'occupied'}
  aria-label={state === 'mine' ? $_('pitch.booked_by_you') : state === 'available' ? $_('pitch.book') : $_('pitch.booked')}
>
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0">
      <div class="flex items-baseline gap-2">
        <span class="text-2xl font-extrabold tracking-[-0.035em] text-text">{formatTime(slot.datetime_start)}</span>
        {#if slot.datetime_end}<span class="text-sm font-medium text-text-muted">– {formatTime(slot.datetime_end)}</span>{/if}
      </div>

      <div class="mt-2 inline-flex items-center gap-1.5 text-sm font-bold"
        class:text-primary={state === 'available'}
        class:text-warning={state === 'mine'}
        class:text-text-muted={state === 'occupied'}
      >
        {#if state === 'available'}<span class="h-2 w-2 rounded-full bg-primary"></span>{$_('pitch.book')}
        {:else if state === 'mine'}<Icon name="check" size={14}/>{$_('pitch.booked_by_you')}
        {:else}<Icon name="lock" size={13}/>{$_('pitch.booked')}{/if}
      </div>

      {#if state === 'mine'}
        <p class="mt-2 truncate text-sm text-text-secondary">{$authState.user?.full_name || $_('pitch.booked_by_you')}</p>
      {:else if state === 'occupied' && slot.booker_name}
        <p class="mt-2 truncate text-sm text-text-secondary">{slot.booker_name}</p>
      {/if}
    </div>

    <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
      class:bg-primary-light={state === 'available'} class:text-primary={state === 'available'}
      class:bg-warning-light={state === 'mine'} class:text-warning={state === 'mine'}
      class:bg-surface-level-2={state === 'occupied'} class:text-text-muted={state === 'occupied'}
    >
      <Icon name={state === 'available' ? 'clock' : state === 'mine' ? 'user' : 'lock'} size={18}/>
    </div>
  </div>

  <div class="mt-4">
    {#if state === 'mine' && slot.booking_id}
      <button on:click={() => onCancel(slot)} class="flex min-h-[48px] w-full items-center justify-center rounded-[16px] bg-danger-light px-4 text-sm font-bold text-danger">{$_('pitch.cancel_booking')}</button>
    {:else if state === 'available'}
      <button on:click={() => onBook(slot)} class="uneem-primary-action w-full">{$_('pitch.book')}</button>
    {:else}
      <div class="flex min-h-[48px] w-full items-center justify-center rounded-[16px] bg-surface-level-2 px-4 text-sm font-semibold text-text-muted">{$_('pitch.booked')}</div>
    {/if}
  </div>
</article>

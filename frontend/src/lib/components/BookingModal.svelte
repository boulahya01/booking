<script lang="ts">
  import { onMount } from 'svelte'
  import { _, locale } from 'svelte-i18n'
  import { USE_MOCK, mockDelay } from '$lib/mock'
  import { uiState } from '$lib/stores/ui'
  import { createBooking, BookingApiError } from '$lib/bookingApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'
  import Icon from './Icon.svelte'

  export let slotData: any
  export let onClose: () => void
  export let onBooked: () => void = () => {}

  $: slot = slotData
  $: ar = ($locale || 'en').startsWith('ar')
  let loading = false
  let error: string | null = null
  let dialog: HTMLDivElement

  onMount(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.focus()

    return () => previousFocus?.focus()
  })

  function formatDate(value: string) {
    return new Intl.DateTimeFormat($locale || 'en', {
      timeZone: slot.timezone || 'Africa/Casablanca',
      weekday: 'long', month: 'long', day: 'numeric'
    }).format(new Date(value))
  }

  function formatTime(value: string) {
    return new Intl.DateTimeFormat($locale || 'en', {
      timeZone: slot.timezone || 'Africa/Casablanca',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(value))
  }

  function handleDialogKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (loading) return
      event.stopPropagation()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (!first || !last) {
      event.preventDefault()
      dialog.focus()
      return
    }

    if (event.shiftKey && (active === dialog || active === first || !(active instanceof Node) || !dialog.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  async function confirmBooking() {
    if (loading || !slot.is_available) return
    loading = true
    error = null
    try {
      if (USE_MOCK) await mockDelay()
      else await createBooking(slot.pitch_id, slot.datetime_start)
      uiState.addToast(ar ? 'تم الحجز' : 'Booked!', 'success')
      onBooked()
      onClose()
    } catch (err) {
      const code = err instanceof BookingApiError ? err.code : 'unknown'
      error = bookingFailureMessage(code, $locale)
    } finally { loading = false }
  }
</script>

<div
  class="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4"
  role="presentation"
  on:click={() => !loading && onClose()}
>
  <div
    bind:this={dialog}
    class="uneem-mobile-sheet sm:max-w-md"
    role="dialog"
    aria-modal="true"
    aria-labelledby="booking-title"
    tabindex="-1"
    on:click|stopPropagation
    on:keydown={handleDialogKeydown}
  >
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="uneem-kicker">{$_('pitch.book')}</p>
        <h2 id="booking-title" class="mt-1 text-xl font-extrabold tracking-[-0.025em] text-text">{slot.pitch_name || $_('bookings.unknown_pitch')}</h2>
      </div>
      <button on:click={onClose} disabled={loading} class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-level-1 text-text-secondary" aria-label={$_('common.close')}><Icon name="x" size={18}/></button>
    </div>

    <div class="mt-5 divide-y divide-border-light rounded-[22px] bg-surface-level-1 px-4">
      <div class="flex items-center gap-3 py-3.5">
        <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary"><Icon name="calendar" size={18}/></div>
        <div class="min-w-0"><p class="text-xs font-semibold text-text-muted">{ar ? 'التاريخ' : 'Date'}</p><p class="mt-0.5 truncate text-sm font-bold text-text">{formatDate(slot.datetime_start)}</p></div>
      </div>
      <div class="flex items-center gap-3 py-3.5">
        <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary"><Icon name="clock" size={18}/></div>
        <div class="min-w-0"><p class="text-xs font-semibold text-text-muted">{ar ? 'الوقت' : 'Time'}</p><p class="mt-0.5 text-sm font-bold text-text">{formatTime(slot.datetime_start)}{#if slot.datetime_end}–{formatTime(slot.datetime_end)}{/if}</p></div>
      </div>
    </div>

    {#if error}<div class="mt-4 rounded-2xl bg-danger-light px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</div>{/if}

    <button on:click={confirmBooking} disabled={loading || !slot.is_available} class="uneem-primary-action mt-5 w-full">
      {#if loading}<span class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>{$_('pitch.booking')}{:else}{$_('pitch.confirm_booking')}{/if}
    </button>
    <button on:click={onClose} disabled={loading} class="mt-1 flex min-h-[46px] w-full items-center justify-center text-sm font-bold text-text-secondary">{$_('pitch.cancel')}</button>
  </div>
</div>
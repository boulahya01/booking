<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { locale } from 'svelte-i18n'
  import { USE_MOCK, mockDelay } from '$lib/mock'
  import { uiState } from '$lib/stores/ui'
  import { createBooking, BookingApiError } from '$lib/bookingApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'
  import Icon from './Icon.svelte'

  export let slotData: any
  export let onClose: () => void
  export let onBooked: () => void = () => {}

  $: slot = slotData
  let loading = false
  let error: string | null = null

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString($locale || 'en', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })
  }

  function formatTime(value: string) {
    return new Date(value).toLocaleTimeString($locale || 'en', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  async function confirmBooking() {
    if (loading || !slot.is_available) return
    loading = true
    error = null

    try {
      if (USE_MOCK) {
        await mockDelay()
      } else {
        await createBooking(slot.pitch_id, slot.datetime_start)
      }

      uiState.addToast($_('common.success'), 'success')
      onBooked()
      onClose()
    } catch (err) {
      const code = err instanceof BookingApiError ? err.code : 'unknown'
      error = bookingFailureMessage(code, $locale)
    } finally {
      loading = false
    }
  }
</script>

<div
  class="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4"
  on:click|preventDefault|stopPropagation
  on:click={(e) => e.target === e.currentTarget && !loading && onClose()}
  on:keydown={(e) => e.key === 'Escape' && !loading && onClose()}
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-labelledby="booking-title"
>
  <div class="absolute inset-0 bg-black/35 backdrop-blur-[2px]"></div>

  <section
    class="relative z-50 w-full overflow-hidden rounded-t-[24px] sm:max-w-md sm:rounded-[24px]"
    style="background: var(--surface); box-shadow: var(--shadow-lg);"
  >
    <div class="mx-auto mt-2 h-1 w-10 rounded-full sm:hidden" style="background: var(--border-strong, var(--border));"></div>

    <div class="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="mb-1 text-xs font-semibold uppercase tracking-[0.12em]" style="color: var(--primary);">
            {$_('pitch.book')}
          </p>
          <h2 id="booking-title" class="text-xl font-semibold tracking-tight" style="color: var(--text);">
            {$_('pitch.confirm_title')}
          </h2>
          <p class="mt-1 text-sm" style="color: var(--text-secondary);">
            {slot.pitch_name || $_('bookings.unknown_pitch')}
          </p>
        </div>

        <button
          on:click={onClose}
          disabled={loading}
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50"
          style="background: var(--surface-level-1); color: var(--text-secondary);"
          aria-label={$_('common.close')}
        >
          <Icon name="x" size={17} />
        </button>
      </div>
    </div>

    <div class="px-5 pb-5 sm:px-6">
      <div class="rounded-2xl p-4" style="background: var(--surface-level-1);">
        <div class="flex items-center gap-3 py-1">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style="background: var(--surface); color: var(--primary);">
            <Icon name="calendar" size={18} />
          </div>
          <div class="min-w-0">
            <div class="text-xs font-medium" style="color: var(--text-muted);">{$_('pitch.date')}</div>
            <div class="truncate text-sm font-semibold" style="color: var(--text);">{formatDate(slot.datetime_start)}</div>
          </div>
        </div>

        <div class="my-3 h-px" style="background: var(--border);"></div>

        <div class="flex items-center gap-3 py-1">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style="background: var(--surface); color: var(--primary);">
            <Icon name="clock" size={18} />
          </div>
          <div class="min-w-0">
            <div class="text-xs font-medium" style="color: var(--text-muted);">{$_('pitch.time')}</div>
            <div class="text-sm font-semibold" style="color: var(--text);">
              {formatTime(slot.datetime_start)}{#if slot.datetime_end} — {formatTime(slot.datetime_end)}{/if}
            </div>
          </div>
        </div>
      </div>

      {#if !slot.is_available}
        <div class="mt-4 flex items-start gap-2.5 rounded-xl p-3.5 text-sm" style="background: var(--warning-light); color: var(--warning);">
          <Icon name="alert-triangle" size={17} />
          <span>{$_('pitch.no_slots')}</span>
        </div>
      {/if}

      {#if error}
        <div class="mt-4 flex items-start gap-2.5 rounded-xl p-3.5 text-sm" style="background: var(--danger-light); color: var(--danger);" role="alert">
          <Icon name="alert-circle" size={17} />
          <span>{error}</span>
        </div>
      {/if}
    </div>

    <div class="sticky bottom-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-6">
      <button
        on:click={confirmBooking}
        disabled={loading || !slot.is_available}
        class="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        style="background: var(--primary);"
      >
        {#if loading}
          <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"></span>
          {$_('pitch.booking')}
        {:else}
          <Icon name="check" size={17} strokeWidth={2.5} />
          {$_('pitch.confirm_booking')}
        {/if}
      </button>

      <button
        on:click={onClose}
        disabled={loading}
        class="mt-2 min-h-[48px] w-full rounded-xl px-4 text-sm font-medium transition-colors disabled:opacity-50"
        style="color: var(--text-secondary);"
      >
        {$_('pitch.cancel')}
      </button>
    </div>
  </section>
</div>

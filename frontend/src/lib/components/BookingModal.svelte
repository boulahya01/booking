<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { locale } from 'svelte-i18n'
  import { supabase } from '$lib/supabaseClient'
  import { USE_MOCK, mockDelay } from '$lib/mock'
  import { uiState } from '$lib/stores/ui'
  import { authState } from '$lib/stores/auth'
  import Icon from './Icon.svelte'

  export let slotData: any
  export let onClose: () => void

  const slot = slotData
  const dispatch = createEventDispatcher()
  let loading = false
  let error: string | null = null

  function formatDateTime(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleString($locale || 'en', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  async function confirmBooking() {
    loading = true
    error = null
    try {
      if (USE_MOCK) {
        await mockDelay()
        dispatch('booked', { booking: { id: 'mock-booking-' + Date.now(), pitch_id: slot.pitch_id, slot_datetime: slot.datetime_start, status: 'active' } })
        uiState.addToast($_('common.success'), 'success')
        onClose()
        return
      }

      // Check auth before booking
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        error = $_('common.error')
        return
      }

      // Check if user has verified their email (status='pending' means not verified yet)
      const userStatus = $authState.user?.status
      if (userStatus === 'pending') {
        error = $_('verify_email.subtitle')
        return
      }

      // Check if user already has an active upcoming booking (any pitch)
      // This prevents booking multiple slots while one is still in the future
      const { data: activeBookings, error: activeErr } = await supabase
        .from('bookings')
        .select('slot_datetime, slot_datetime_end')
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (activeErr) {
        error = $_('common.error')
        return
      }

      if (Array.isArray(activeBookings) && activeBookings.length > 0) {
        const now = Date.now()
        for (const b of activeBookings) {
          let bookingEnd: number
          if (b.slot_datetime_end) {
            bookingEnd = new Date(b.slot_datetime_end).getTime()
          } else if (b.slot_datetime) {
            // Fallback: assume 1 hour slot
            bookingEnd = new Date(b.slot_datetime).getTime() + 60 * 60 * 1000
          } else {
            // No end time info - conservatively block
            bookingEnd = now + 1
          }
          if (bookingEnd > now) {
            error = 'You already have an active booking. Complete or cancel it before booking another slot.'
            return
          }
        }
      }

      // Calculate slot_datetime_end (1 hour after start)
      const startTime = new Date(slot.datetime_start)
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)

      // Use the security definer RPC function - validates approval, pitch existence,
      // past slots, duplicates, and booking frequency server-side
      const { data, error: bookingErr } = await supabase.rpc('create_booking_with_approval', {
        p_pitch_id: slot.pitch_id,
        p_slot_datetime: slot.datetime_start,
        p_slot_datetime_end: endTime.toISOString(),
      })

      if (bookingErr) {
        // Show user-friendly error messages
        if (bookingErr.message?.includes('already have an active booking')) {
          error = 'You already have an active booking for this time slot.'
        } else if (bookingErr.message?.includes('approved')) {
          error = $_('pending.title')
        } else if (bookingErr.message?.includes('past')) {
          error = $_('pitch.no_slots')
        } else if (bookingErr.message?.includes('frequency')) {
          error = bookingErr.message
        } else {
          error = $_('common.error')
        }
        return
      }

      const booking = Array.isArray(data) ? data[0] : data
      dispatch('booked', { booking })
      uiState.addToast($_('common.success'), 'success')
      onClose()
    } catch (e: any) {
      error = $_('common.error')
    } finally {
      loading = false
    }
  }
</script>

<div class="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
     on:click|preventDefault|stopPropagation
     on:click={(e) => e.target === e.currentTarget && onClose()}
     on:keydown={(e) => e.key === 'Escape' && onClose()}
     role="dialog"
     tabindex="-1"
     aria-modal="true">
  <!-- Backdrop with fade -->
  <div class="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm"></div>

  <!-- Modal Panel -->
  <div class="relative w-full sm:max-w-sm bg-surface sm:rounded-2xl rounded-t-2xl shadow-2xl z-50 overflow-hidden
              animate-in">

    <!-- Close Button -->
    <button on:click={onClose}
            class="absolute top-4 end-4 z-10 w-8 h-8 rounded-full flex items-center justify-center
                   bg-surface-level-1/80 hover:bg-surface-level-1 text-text-muted hover:text-text
                   transition-colors duration-150"
            aria-label={$_('common.close')}>
      <Icon name="x" size={14} />
    </button>

    <!-- Header — Icon + Title -->
    <div class="pt-8 pb-5 px-6 text-center border-b border-border">
      <!-- Confirmation Icon -->
      <div class="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center
                  bg-primary-light/60 ring-1 ring-primary/20">
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"
             fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/>
          <line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
          <path d="m9 16 2 2 4-4"/>
        </svg>
      </div>
      <h2 class="text-xl font-serif font-medium text-text mb-1">{$_('pitch.confirm_title')}</h2>
      <p class="text-sm text-text-secondary">You're about to reserve this slot</p>
    </div>

    <!-- Body — Slot Details -->
    <div class="p-6 space-y-4">
      <!-- Pitch Info Card -->
      <div class="rounded-xl p-4 bg-surface-level-1/50 ring-1 ring-border/50">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                      bg-surface-level-1 ring-1 ring-border/60">
            <Icon name="building-2" size={18} className="text-text-secondary" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-text text-sm truncate">{slot.pitch_name || $_('bookings.unknown_pitch')}</p>
            <div class="flex flex-col gap-1 mt-2">
              <span class="flex items-center gap-1.5 text-xs text-text-secondary">
                <Icon name="calendar" size={12} />
                {new Date(slot.datetime_start).toLocaleDateString($locale || 'en', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              <span class="flex items-center gap-1.5 text-xs text-text-secondary">
                <Icon name="clock" size={12} />
                {new Date(slot.datetime_start).toLocaleTimeString($locale || 'en', { hour: '2-digit', minute: '2-digit', hour12: false })}
                {#if slot.datetime_end}
                  — {new Date(slot.datetime_end).toLocaleTimeString($locale || 'en', { hour: '2-digit', minute: '2-digit', hour12: false })}
                {:else}
                  — {new Date(new Date(slot.datetime_start).getTime() + 3600000).toLocaleTimeString($locale || 'en', { hour: '2-digit', minute: '2-digit', hour12: false })}
                {/if}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Warnings -->
      {#if !slot.is_available}
        <div class="rounded-xl p-3.5 bg-warning-light/60 ring-1 ring-warning/15 flex items-center gap-2.5 text-sm text-warning">
          <Icon name="alert-triangle" size={16} />
          {$_('pitch.no_slots')}
        </div>
      {/if}

      {#if error}
        <div class="rounded-xl p-3.5 bg-danger-light/60 ring-1 ring-danger/15 flex items-center gap-2.5 text-sm text-danger">
          <Icon name="alert-circle" size={16} />
          {error}
        </div>
      {/if}
    </div>

    <!-- Footer — Action Buttons -->
    <div class="px-6 pb-6 pt-2 space-y-3">
      <!-- Primary: Confirm Booking -->
      <button
        on:click={confirmBooking}
        disabled={loading || !slot.is_available}
        class="w-full py-3.5 rounded-xl text-white font-semibold text-sm tracking-wide
               transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
               hover:-translate-y-0.5 active:translate-y-0
               flex items-center justify-center gap-2"
        style="background: var(--primary-gradient); box-shadow: 0 0 0 1px var(--primary), var(--shadow-md);">
        {#if loading}
          <span class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          {$_('pitch.booking')}
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          {$_('pitch.confirm_booking')}
        {/if}
      </button>

      <!-- Secondary: Cancel (ghost style) -->
      <button
        on:click={onClose}
        disabled={loading}
        class="w-full py-3.5 rounded-xl font-medium text-sm tracking-wide
               transition-all duration-150 disabled:opacity-50
               text-text-secondary hover:text-text hover:bg-surface-level-1/60">
        {$_('pitch.cancel')}
      </button>
    </div>
  </div>
</div>

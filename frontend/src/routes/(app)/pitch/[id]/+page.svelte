<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import { supabase } from '$lib/supabaseClient'
  import SlotCard from '$lib/components/SlotCard.svelte'
  import BookingModal from '$lib/components/BookingModal.svelte'
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { locale } from 'svelte-i18n'
  import { USE_MOCK, mockPitches, mockSlots } from '$lib/mock'
  import { uiState } from '$lib/stores/ui'
  import { logger } from '$lib/logger'
  import { getPitchAvailability, cancelBooking as cancelBookingRpc, BookingApiError } from '$lib/bookingApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'

  let pitch: any = null
  let slots: any[] = []
  let loading = true
  let loadingSlots = false
  let error: string | null = null
  let errorSlots: string | null = null
  let selectedSlot: any = null
  let showModal = false
  let selectedDate: string | null = null
  let currentTime = new Date()
  let cancelSlot: any = null
  let canceling = false

  $: pitchId = $page.params.id

  let fetchVersion = 0
  let slotsRequestVersion: number | null = null
  let refreshInterval: ReturnType<typeof setInterval> | null = null
  let cleanupVisibility: (() => void) | null = null

  function startAutoRefresh() {
    refreshInterval = setInterval(() => { if (pitchId) fetchSlots() }, 120_000)
    const handleVisibility = () => { if (!document.hidden && pitchId) fetchSlots() }
    document.addEventListener('visibilitychange', handleVisibility)
    cleanupVisibility = () => document.removeEventListener('visibilitychange', handleVisibility)
  }

  function stopAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval)
    refreshInterval = null
    cleanupVisibility?.()
    cleanupVisibility = null
  }

  async function fetchPitch() {
    const version = ++fetchVersion
    if (!pitchId) { pitch = null; loading = false; return }
    if (USE_MOCK) { pitch = mockPitches.find((item) => item.id === pitchId) || null; loading = false; return }

    const { data, error: fetchError } = await supabase
      .from('pitches')
      .select('id,name,location,open_time,close_time,capacity,sport_type,timezone')
      .eq('id', pitchId)
      .maybeSingle()

    if (version !== fetchVersion) return
    if (fetchError) {
      logger.error('[Pitch Page] Failed to load pitch:', fetchError)
      error = $_('common.error')
      pitch = null
    } else {
      error = null
      pitch = data || null
    }
    loading = false
  }

  async function fetchSlots() {
    const version = fetchVersion
    if (!pitchId || slotsRequestVersion === version) return
    slotsRequestVersion = version
    loadingSlots = true
    errorSlots = null

    if (USE_MOCK) {
      slots = mockSlots
      loadingSlots = false
      slotsRequestVersion = null
      syncSelectedDate()
      return
    }

    try {
      const data = await getPitchAvailability(pitchId)
      if (version !== fetchVersion) return
      slots = data
      syncSelectedDate()
    } catch (fetchError) {
      if (version !== fetchVersion) return
      logger.error('[Pitch Page] Failed to load availability:', fetchError)
      const code = fetchError instanceof BookingApiError ? fetchError.code : 'unknown'
      errorSlots = bookingFailureMessage(code, $locale)
    } finally {
      if (slotsRequestVersion === version) slotsRequestVersion = null
      if (version === fetchVersion) loadingSlots = false
    }
  }

  $: if (pitchId && browser) {
    loading = true
    error = null
    pitch = null
    slots = []
    selectedDate = null
    cancelSlot = null
    stopAutoRefresh()
    fetchPitch()
    fetchSlots()
  }

  function openBooking(slot: any) {
    selectedSlot = { ...slot, pitch_name: pitch?.name }
    showModal = true
  }

  function onModalClose() { showModal = false; selectedSlot = null }
  async function onBookingCompleted() { await fetchSlots() }
  function requestCancellation(slot: any) { if (slot.booking_id) cancelSlot = slot }
  function closeCancellation() { if (!canceling) cancelSlot = null }

  async function confirmCancellation() {
    if (!cancelSlot?.booking_id || canceling) return
    canceling = true
    try {
      await cancelBookingRpc(cancelSlot.booking_id)
      uiState.addToast($_('pitch.cancelled_success'), 'success')
      cancelSlot = null
      await fetchSlots()
    } catch (cancelError) {
      const code = cancelError instanceof BookingApiError ? cancelError.code : 'unknown'
      uiState.addToast(bookingFailureMessage(code, $locale), 'error')
    } finally {
      canceling = false
    }
  }

  onMount(() => {
    const timer = setInterval(() => { currentTime = new Date() }, 60_000)
    startAutoRefresh()
    return () => { clearInterval(timer); stopAutoRefresh() }
  })

  function facilityDateKey(value: string): string {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: pitch?.timezone || 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(value))
    return `${parts.find((p) => p.type === 'year')?.value || ''}-${parts.find((p) => p.type === 'month')?.value || ''}-${parts.find((p) => p.type === 'day')?.value || ''}`
  }

  function syncSelectedDate() {
    if (!slots.length) { selectedDate = null; return }
    const availableDates = [...new Set(slots.map((slot) => facilityDateKey(slot.datetime_start)))].sort()
    if (selectedDate && availableDates.includes(selectedDate)) return
    const useful = availableDates.find((date) => slots.some((slot) => facilityDateKey(slot.datetime_start) === date && (slot.is_available || slot.booked_by_me)))
    selectedDate = useful || availableDates[0] || null
  }

  $: grouped = slots.reduce<Record<string, any[]>>((acc, slot) => {
    const key = facilityDateKey(slot.datetime_start)
    ;(acc[key] ??= []).push(slot)
    return acc
  }, {})
  $: dates = Object.keys(grouped).sort()
  $: selectedSlots = selectedDate ? grouped[selectedDate] || [] : []
  $: selectedAvailableCount = selectedSlots.filter((slot) => slot.is_available).length

  function availableCount(dateKey: string) { return (grouped[dateKey] || []).filter((slot) => slot.is_available).length }
  function displayDate(dateKey: string) { return new Date(`${dateKey}T12:00:00`) }
  function formatDayLabel(dateKey: string) { return displayDate(dateKey).toLocaleDateString($locale || 'en', { weekday: 'short' }) }
  function formatDateHeader(dateKey: string) {
    return displayDate(dateKey).toLocaleDateString($locale || 'en', { weekday: 'long', month: 'short', day: 'numeric' })
  }
</script>

<div class="min-h-screen" style="background: var(--bg);">
  <main class="mx-auto max-w-4xl px-4 pb-28 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
    {#if loading}
      <div class="space-y-5">
        <div class="h-10 w-32 animate-pulse rounded-xl" style="background: var(--surface-level-1);"></div>
        <div class="h-40 animate-pulse rounded-[24px]" style="background: var(--surface-level-1);"></div>
        <div class="flex gap-2 overflow-hidden">{#each Array(5) as _}<div class="h-20 w-20 shrink-0 animate-pulse rounded-2xl" style="background: var(--surface-level-1);"></div>{/each}</div>
        <LoadingSkeleton type="slot" count={4} />
      </div>
    {:else if error}
      <section class="rounded-[24px] p-6 text-center" style="background: var(--danger-light);">
        <Icon name="alert-triangle" size={34} className="mx-auto mb-3" />
        <p class="font-medium" style="color: var(--danger);">{error}</p>
        <button on:click={fetchPitch} class="mt-4 min-h-[48px] rounded-xl px-5 text-sm font-semibold" style="background: var(--surface); color: var(--primary);">{$_('common.retry')}</button>
      </section>
    {:else if pitch}
      <a href="/home" class="mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl pe-3 text-sm font-medium no-underline" style="color: var(--text-secondary);">
        <Icon name={$locale === 'ar' ? 'arrow-right' : 'arrow-left'} size={17} /><span>{$_('home.browse_pitches')}</span>
      </a>

      <section class="rounded-[24px] p-5 sm:p-6" style="background: var(--surface); border: 1px solid var(--border);">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            {#if pitch.sport_type}<div class="mb-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style="background: var(--primary-light); color: var(--primary);">{pitch.sport_type}</div>{/if}
            <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl" style="color: var(--text);">{pitch.name}</h1>
            <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm" style="color: var(--text-secondary);">
              <span class="inline-flex items-center gap-1.5"><Icon name="map-pin" size={15} />{pitch.location || $_('bookings.unknown_location')}</span>
              {#if pitch.open_time && pitch.close_time}<span class="inline-flex items-center gap-1.5"><Icon name="clock" size={15} />{pitch.open_time.slice(0, 5)} — {pitch.close_time.slice(0, 5)}</span>{/if}
              {#if pitch.capacity}<span class="inline-flex items-center gap-1.5"><Icon name="users" size={15} />{pitch.capacity} · {$_('pitch.capacity')}</span>{/if}
            </div>
          </div>
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style="background: var(--primary-light); color: var(--primary);"><Icon name="trophy" size={23} /></div>
        </div>
      </section>

      <section class="mt-7">
        <div class="mb-3 flex items-end justify-between gap-4">
          <div><h2 class="text-lg font-semibold tracking-tight" style="color: var(--text);">{$_('pitch.slots_title')}</h2>{#if selectedDate}<p class="mt-1 text-sm" style="color: var(--text-secondary);">{formatDateHeader(selectedDate)}</p>{/if}</div>
          {#if loadingSlots && slots.length > 0}<span class="inline-flex items-center gap-2 text-xs" style="color: var(--text-muted);" aria-live="polite"><span class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>{$_('common.loading')}</span>{/if}
        </div>

        {#if dates.length > 0}
          <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 scrollbar-none">
            {#each dates as date}
              {@const d = displayDate(date)}{@const isSelected = selectedDate === date}{@const count = availableCount(date)}
              <button on:click={() => (selectedDate = date)} class="min-h-[76px] min-w-[76px] shrink-0 rounded-2xl px-3 py-2.5 text-center transition-colors" style={isSelected ? 'background: var(--primary); color: white; border: 1px solid var(--primary);' : 'background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border);'} aria-pressed={isSelected}>
                <div class="text-[11px] font-semibold uppercase tracking-wide" style={isSelected ? 'color: rgba(255,255,255,.82);' : 'color: var(--text-muted);'}>{formatDayLabel(date)}</div>
                <div class="mt-0.5 text-xl font-semibold">{d.getDate()}</div>
                <div class="mt-0.5 text-[10px] font-medium" style={isSelected ? 'color: rgba(255,255,255,.82);' : 'color: var(--text-muted);'}>{count} · {$_('pitch.book')}</div>
              </button>
            {/each}
          </div>
        {/if}
      </section>

      <section class="mt-4">
        {#if loadingSlots && slots.length === 0}
          <LoadingSkeleton type="slot" count={4} />
        {:else if errorSlots && slots.length === 0}
          <div class="rounded-[24px] p-6 text-center" style="background: var(--danger-light);"><Icon name="alert-circle" size={30} className="mx-auto mb-3" /><p class="font-medium" style="color: var(--danger);">{errorSlots}</p><button on:click={fetchSlots} class="mt-4 min-h-[48px] rounded-xl px-5 text-sm font-semibold" style="background: var(--surface); color: var(--primary);">{$_('common.retry')}</button></div>
        {:else if slots.length === 0}
          <div class="rounded-[24px] p-8 text-center" style="background: var(--surface); border: 1px solid var(--border);"><div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style="background: var(--surface-level-1); color: var(--text-muted);"><Icon name="clock" size={22} /></div><p class="mt-3 font-medium" style="color: var(--text-secondary);">{$_('pitch.no_slots')}</p></div>
        {:else if selectedDate && selectedSlots.length > 0}
          {#if errorSlots}<div class="mb-3 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm" style="background: var(--danger-light); color: var(--danger);" role="status"><span>{errorSlots}</span><button on:click={fetchSlots} class="shrink-0 font-semibold">{$_('common.retry')}</button></div>{/if}
          <div class="mb-3 flex items-center justify-between text-xs" style="color: var(--text-muted);"><span>{selectedAvailableCount} · {$_('pitch.slots_title')}</span><span>{currentTime.toLocaleTimeString($locale || 'en', { hour: '2-digit', minute: '2-digit', hour12: false })}</span></div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">{#each selectedSlots as slot, i (slot.id || `${slot.datetime_start}-${i}`)}<SlotCard slotData={slot} onBook={() => openBooking(slot)} onCancel={requestCancellation} />{/each}</div>
        {:else}
          <div class="rounded-2xl p-6 text-center text-sm" style="background: var(--surface-level-1); color: var(--text-muted);">{$_('pitch.select_date')}</div>
        {/if}
      </section>

      {#if showModal && selectedSlot}<BookingModal slotData={selectedSlot} onClose={onModalClose} onBooked={onBookingCompleted} />{/if}
      {#if cancelSlot}
        <div class="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title">
          <button class="absolute inset-0 bg-black/35 backdrop-blur-[2px]" on:click={closeCancellation} aria-label={$_('common.close')}></button>
          <section class="relative z-50 w-full rounded-t-[24px] p-5 sm:max-w-md sm:rounded-[24px] sm:p-6" style="background: var(--surface); box-shadow: var(--shadow-lg);">
            <div class="mx-auto mb-4 h-1 w-10 rounded-full sm:hidden" style="background: var(--border);"></div>
            <div class="flex h-11 w-11 items-center justify-center rounded-full" style="background: var(--danger-light); color: var(--danger);"><Icon name="calendar" size={20} /></div>
            <h2 id="cancel-booking-title" class="mt-4 text-xl font-semibold" style="color: var(--text);">{$_('pitch.cancel_booking')}</h2><p class="mt-2 text-sm leading-6" style="color: var(--text-secondary);">{$_('pitch.cancel_confirm')}</p>
            <div class="mt-5 grid gap-2"><button on:click={confirmCancellation} disabled={canceling} class="flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-50" style="background: var(--danger);">{#if canceling}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"></span>{/if}{$_('pitch.cancel_booking')}</button><button on:click={closeCancellation} disabled={canceling} class="min-h-[48px] rounded-xl px-4 text-sm font-medium disabled:opacity-50" style="color: var(--text-secondary);">{$_('common.cancel')}</button></div>
          </section>
        </div>
      {/if}
    {:else}
      <section class="rounded-[24px] p-8 text-center" style="background: var(--surface); border: 1px solid var(--border);"><Icon name="x-circle" size={40} className="mx-auto mb-4" /><h2 class="text-xl font-semibold" style="color: var(--text);">{$_('pitch.not_found')}</h2><a href="/home" class="mt-4 inline-flex min-h-[48px] items-center rounded-xl px-5 text-sm font-semibold no-underline" style="background: var(--primary-light); color: var(--primary);">{$_('home.browse_pitches')}</a></section>
    {/if}
  </main>
</div>

<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import { supabase } from '$lib/supabaseClient'
  import SlotCard from '$lib/components/SlotCard.svelte'
  import BookingModal from '$lib/components/BookingModal.svelte'
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte'
  import { _ } from 'svelte-i18n'
  import { locale } from 'svelte-i18n'
  import { USE_MOCK, mockPitches, mockSlots } from '$lib/mock'
  import { uiState } from '$lib/stores/ui'
  import { logger } from '$lib/logger'
  import {
    getPitchAvailability,
    cancelBooking as cancelBookingRpc,
    BookingApiError
  } from '$lib/bookingApi'
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

  $: pitchId = $page.params.id

  let fetchVersion = 0
  let slotsRequestVersion: number | null = null

  let refreshInterval: ReturnType<typeof setInterval> | null = null
  let cleanupVisibility: (() => void) | null = null

  function startAutoRefresh() {
    refreshInterval = setInterval(() => {
      if (pitchId) fetchSlots()
    }, 120_000)

    const handleVisibility = () => {
      if (!document.hidden && pitchId) fetchSlots()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    cleanupVisibility = () => document.removeEventListener('visibilitychange', handleVisibility)
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
    cleanupVisibility?.()
    cleanupVisibility = null
  }

  async function fetchPitch() {
    const thisVersion = ++fetchVersion
    if (!pitchId) {
      pitch = null
      loading = false
      return
    }

    if (USE_MOCK) {
      pitch = mockPitches.find(p => p.id === pitchId) || null
      loading = false
      return
    }

    const { data, error: fetchError } = await supabase
      .from('pitches')
      .select('id,name,location,open_time,close_time,capacity,sport_type,timezone')
      .eq('id', pitchId)
      .maybeSingle()

    if (thisVersion !== fetchVersion) return

    if (fetchError) {
      logger.error('[Pitch Page] Failed to load pitch:', fetchError)
      error = $_('common.error')
      pitch = null
    } else if (!data) {
      error = null
      pitch = null
    } else {
      error = null
      pitch = data
    }
    loading = false
  }

  async function fetchSlots() {
    const thisVersion = fetchVersion
    if (!pitchId) return
    if (slotsRequestVersion === thisVersion) return

    slotsRequestVersion = thisVersion
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
      if (thisVersion !== fetchVersion) return

      slots = data
      syncSelectedDate()
    } catch (fetchError) {
      if (thisVersion !== fetchVersion) return
      logger.error('[Pitch Page] Failed to load availability:', fetchError)
      slots = []
      const code = fetchError instanceof BookingApiError ? fetchError.code : 'unknown'
      errorSlots = bookingFailureMessage(code, $locale)
    } finally {
      if (slotsRequestVersion === thisVersion) slotsRequestVersion = null
      if (thisVersion === fetchVersion) loadingSlots = false
    }
  }

  $: if (pitchId && browser) {
    loading = true
    error = null
    pitch = null
    slots = []
    selectedDate = null
    stopAutoRefresh()
    fetchPitch()
    fetchSlots()
  }

  function openBooking(slot: any) {
    selectedSlot = { ...slot, pitch_name: pitch?.name }
    showModal = true
  }

  function onModalClose() {
    showModal = false
    selectedSlot = null
  }

  async function onBookingCompleted() {
    await fetchSlots()
  }

  async function cancelBooking(slot: any) {
    if (!slot.booking_id) return
    if (!confirm($_('pitch.cancel_confirm'))) return

    try {
      await cancelBookingRpc(slot.booking_id)
      uiState.addToast($_('pitch.cancelled_success'), 'success')
      await fetchSlots()
    } catch (cancelError) {
      const code = cancelError instanceof BookingApiError ? cancelError.code : 'unknown'
      uiState.addToast(bookingFailureMessage(code, $locale), 'error')
    }
  }

  onMount(() => {
    currentTime = new Date()
    const timer = setInterval(() => { currentTime = new Date() }, 60_000)
    startAutoRefresh()
    return () => {
      clearInterval(timer)
      stopAutoRefresh()
    }
  })

  function facilityDateKey(value: string): string {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: pitch?.timezone || 'Africa/Casablanca',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date(value))

    const year = parts.find((part) => part.type === 'year')?.value || ''
    const month = parts.find((part) => part.type === 'month')?.value || ''
    const day = parts.find((part) => part.type === 'day')?.value || ''
    return `${year}-${month}-${day}`
  }

  function syncSelectedDate() {
    if (!slots.length) {
      selectedDate = null
      return
    }

    const availableDates = [...new Set(slots.map((slot) => facilityDateKey(slot.datetime_start)))].sort()
    if (!selectedDate || !availableDates.includes(selectedDate)) {
      selectedDate = availableDates[0] || null
    }
  }

  $: grouped = slots.reduce<Record<string, any[]>>((acc, slot) => {
    const key = facilityDateKey(slot.datetime_start)
    ;(acc[key] ??= []).push(slot)
    return acc
  }, {})

  $: dates = Object.keys(grouped).sort()

  function displayDate(dateKey: string) {
    return new Date(`${dateKey}T12:00:00`)
  }

  function formatDateHeader(dateKey: string) {
    const date = displayDate(dateKey)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayKey = facilityDateKey(today.toISOString())
    const tomorrowKey = facilityDateKey(tomorrow.toISOString())

    const currentLocale = $locale || 'en'
    const weekday = date.toLocaleDateString(currentLocale, { weekday: 'long' })
    const monthDay = date.toLocaleDateString(currentLocale, { month: 'short', day: 'numeric' })

    if (dateKey === todayKey) return `Today — ${weekday}, ${monthDay}`
    if (dateKey === tomorrowKey) return `Tomorrow — ${weekday}, ${monthDay}`
    return `${weekday}, ${monthDay}`
  }

  function formatDayLabel(dateKey: string) {
    return displayDate(dateKey).toLocaleDateString($locale || 'en', { weekday: 'short' })
  }
</script>

<div class="min-h-screen" style="background: var(--bg);">
  <div class="max-w-3xl mx-auto px-4 py-5">
    {#if loading}
      <div class="space-y-5">
        <div class="h-5 w-28 rounded animate-pulse" style="background: var(--surface-level-1);"></div>
        <div class="rounded-xl p-5 animate-pulse" style="background: var(--surface); border: 1px solid var(--border);">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 space-y-3">
              <div class="flex gap-2">
                <div class="h-6 w-20 rounded-md animate-pulse" style="background: var(--surface-level-1);"></div>
                <div class="h-6 w-16 rounded-md animate-pulse" style="background: var(--surface-level-1);"></div>
              </div>
              <div class="h-8 w-3/4 rounded animate-pulse" style="background: var(--surface-level-1);"></div>
              <div class="h-5 w-1/2 rounded animate-pulse" style="background: var(--surface-level-1);"></div>
              <div class="h-4 w-2/3 rounded animate-pulse" style="background: var(--surface-level-1);"></div>
            </div>
            <div class="w-12 h-12 rounded-lg animate-pulse" style="background: var(--surface-level-1);"></div>
          </div>
        </div>
        <div class="flex gap-2 overflow-x-auto pb-2">
          {#each Array(4) as _}
            <div class="flex-shrink-0 w-16 h-16 rounded-xl animate-pulse" style="background: var(--surface-level-1);"></div>
          {/each}
        </div>
        <LoadingSkeleton type="slot" count={4} />
      </div>
    {:else if error}
      <div class="text-center py-16 rounded-xl" style="background: var(--danger-light);">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <p class="font-medium" style="color: var(--danger);">{error}</p>
        <button on:click={fetchPitch} class="mt-4 text-sm font-medium hover:underline" style="color: var(--primary);">{$_('common.retry')}</button>
      </div>
    {:else if pitch}
      <a href="/home"
         class="inline-flex items-center gap-1.5 text-sm font-medium mb-5 no-underline transition-all duration-200 hover:-translate-y-0.5"
         style="color: var(--text-secondary);">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        <span>{$_('home.browse_pitches')}</span>
      </a>

      <div class="relative rounded-xl mb-5 p-5"
           style="background: var(--surface); border: 1px solid var(--border); box-shadow: 0 0 0 1px var(--border);">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <h1 class="text-2xl font-medium mb-2" style="color: var(--text); font-family: var(--font-serif);">{pitch.name}</h1>
            <p class="flex items-center gap-1.5 text-sm mb-1" style="color: var(--text-secondary);">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              {pitch.location || $_('bookings.unknown_location')}
            </p>
            {#if pitch.open_time && pitch.close_time}
              <p class="flex items-center gap-1.5 text-sm" style="color: var(--text-muted);">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {pitch.open_time.slice(0, 5)} — {pitch.close_time.slice(0, 5)}
              </p>
            {/if}
          </div>
          <div class="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style="background: var(--primary-light);">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 6 9 6 9Z"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 18 9 18 9Z"/><path d="M4 22H20"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55-.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          </div>
        </div>
      </div>

      {#if dates.length > 0}
        <div class="mb-5">
          <h2 class="text-base font-medium mb-3" style="color: var(--text); font-family: var(--font-serif);">{$_('pitch.slots_title')}</h2>
          <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {#each dates as date}
              {@const d = displayDate(date)}
              {@const isSelected = selectedDate === date}
              <button
                on:click={() => (selectedDate = date)}
                class="flex-shrink-0 min-w-[68px] p-2.5 rounded-xl text-center transition-all duration-200 hover:-translate-y-0.5"
                style={isSelected
                  ? 'background: var(--primary-gradient); color: white; border: 1px solid var(--primary); box-shadow: 0 0 0 1px var(--primary);'
                  : 'background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border);'}
              >
                <div class="text-[10px] font-medium uppercase tracking-wide" style={isSelected ? 'color: rgba(255,255,255,0.9);' : 'opacity: 0.7;'}>
                  {formatDayLabel(date)}
                </div>
                <div class="text-lg font-bold" style={isSelected ? 'color: white;' : ''}>{d.getDate()}</div>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if loadingSlots}
        <LoadingSkeleton type="slot" count={4} />
      {:else if errorSlots}
        <div class="text-center py-12 rounded-xl" style="background: var(--danger-light);">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p class="font-medium" style="color: var(--danger);">{errorSlots}</p>
          <button on:click={fetchSlots} class="mt-4 text-sm font-medium transition-colors hover:underline" style="color: var(--primary);">{$_('common.retry')}</button>
        </div>
      {:else if slots.length === 0}
        <div class="text-center py-12 rounded-xl" style="background: var(--surface-level-1); border: 1px dashed var(--border);">
          <div class="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center" style="background: var(--surface-level-2); color: var(--text-muted);">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <p class="font-medium" style="color: var(--text-secondary);">{$_('pitch.no_slots')}</p>
        </div>
      {:else if selectedDate && grouped[selectedDate]}
        <div class="mb-4">
          <h3 class="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center justify-between" style="color: var(--text-muted);">
            <span>{formatDateHeader(selectedDate)}</span>
            <span class="text-xs font-normal normal-case">{currentTime.toLocaleTimeString($locale || 'en', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {#each grouped[selectedDate] as slot, i (slot.id || `${slot.datetime_start}-${i}`)}
              <SlotCard slotData={slot} onBook={() => openBooking(slot)} onCancel={cancelBooking} />
            {/each}
          </div>
        </div>
      {:else}
        <div class="text-center py-8" style="color: var(--text-muted);">{$_('pitch.select_date')}</div>
      {/if}

      {#if showModal && selectedSlot}
        <BookingModal slotData={selectedSlot} onClose={onModalClose} onBooked={onBookingCompleted} />
      {/if}
    {:else}
      <div class="text-center py-16">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4"><circle cx="12" cy="12" r="10"/><path d="m14.5 9.5-5 5"/><path d="m9.5 9.5 5 5"/></svg>
        <h2 class="text-xl font-medium mb-2" style="color: var(--text);">{$_('pitch.not_found')}</h2>
        <a href="/home" class="inline-block mt-4 text-sm font-medium no-underline transition-colors hover:underline" style="color: var(--primary);">{$_('home.browse_pitches')}</a>
      </div>
    {/if}
  </div>
</div>

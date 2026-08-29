<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import { supabase } from '$lib/supabaseClient'
  import SlotCard from '$lib/components/SlotCard.svelte'
  import BookingModal from '$lib/components/BookingModal.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { _, locale } from 'svelte-i18n'
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
  let cancelSlot: any = null
  let canceling = false
  let currentTime = new Date()
  let cancellationDialog: HTMLElement | null = null
  let cancellationTrigger: HTMLElement | null = null

  $: pitchId = $page.params.id
  $: ar = ($locale || 'en').startsWith('ar')
  $: grouped = slots.reduce<Record<string, any[]>>((acc, slot) => {
    const key = facilityDateKey(slot.datetime_start)
    ;(acc[key] ??= []).push(slot)
    return acc
  }, {})
  $: dates = Object.keys(grouped).sort()
  $: selectedSlots = selectedDate ? grouped[selectedDate] || [] : []
  $: selectedAvailableCount = selectedSlots.filter((slot) => slot.is_available).length

  let fetchVersion = 0
  let slotsRequestVersion: number | null = null
  let refreshInterval: ReturnType<typeof setInterval> | null = null
  let cleanupVisibility: (() => void) | null = null

  function startAutoRefresh() {
    refreshInterval = setInterval(() => { if (pitchId) void fetchSlots() }, 120_000)
    const handleVisibility = () => { if (!document.hidden && pitchId) void fetchSlots() }
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
    if (USE_MOCK) {
      pitch = mockPitches.find((item) => item.id === pitchId) || null
      loading = false
      return
    }

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
      errorSlots = bookingFailureMessage(fetchError instanceof BookingApiError ? fetchError.code : 'unknown', $locale)
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
    cancellationTrigger = null
    stopAutoRefresh()
    void fetchPitch()
    void fetchSlots()
  }

  onMount(() => {
    const timer = setInterval(() => { currentTime = new Date() }, 60_000)
    startAutoRefresh()
    return () => { clearInterval(timer); stopAutoRefresh() }
  })

  function openBooking(slot: any) {
    selectedSlot = { ...slot, pitch_name: pitch?.name }
    showModal = true
  }

  function onModalClose() { showModal = false; selectedSlot = null }
  async function onBookingCompleted() { await fetchSlots() }

  async function requestCancellation(slot: any) {
    if (!slot.booking_id) return
    cancellationTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelSlot = slot
    await tick()
    cancellationDialog?.focus()
  }

  function clearCancellation() {
    const trigger = cancellationTrigger
    cancelSlot = null
    cancellationTrigger = null
    void tick().then(() => {
      if (trigger?.isConnected) trigger.focus()
    })
  }

  function dismissCancellation() {
    if (!canceling) clearCancellation()
  }

  function handleCancellationKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (!canceling) {
        event.preventDefault()
        clearCancellation()
      }
      return
    }

    if (event.key !== 'Tab' || !cancellationDialog) return

    const focusable = Array.from(
      cancellationDialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')

    if (focusable.length === 0) {
      event.preventDefault()
      cancellationDialog.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (event.shiftKey && (active === first || active === cancellationDialog)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  async function confirmCancellation() {
    if (!cancelSlot?.booking_id || canceling) return
    canceling = true
    try {
      await cancelBookingRpc(cancelSlot.booking_id)
      uiState.addToast(ar ? 'تم إلغاء الحجز' : 'Booking cancelled', 'success')
      clearCancellation()
      await fetchSlots()
    } catch (cancelError) {
      const code = cancelError instanceof BookingApiError ? cancelError.code : 'unknown'
      uiState.addToast(bookingFailureMessage(code, $locale), 'error')
    } finally { canceling = false }
  }

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
    selectedDate = availableDates.find((date) => slots.some((slot) => facilityDateKey(slot.datetime_start) === date && (slot.is_available || slot.booked_by_me))) || availableDates[0] || null
  }

  function displayDate(dateKey: string) { return new Date(`${dateKey}T12:00:00`) }
  function availableCount(dateKey: string) { return (grouped[dateKey] || []).filter((slot) => slot.is_available).length }
  function formatDayLabel(dateKey: string) { return displayDate(dateKey).toLocaleDateString($locale || 'en', { weekday: 'short' }) }
  function formatDateHeader(dateKey: string) { return displayDate(dateKey).toLocaleDateString($locale || 'en', { weekday: 'long', month: 'short', day: 'numeric' }) }
  function closeTime() {
    const value = pitch?.close_time?.slice(0, 5) || ''
    return value === '00:00' && pitch?.open_time?.slice(0, 5) !== '00:00' ? '24:00' : value
  }
</script>

<svelte:head><title>{pitch?.name || (ar ? 'المرفق' : 'Facility')} · UNEEM</title></svelte:head>

<main class="uneem-page max-w-4xl">
  {#if loading}
    <div class="space-y-4" aria-busy="true">
      <div class="h-10 w-28 animate-pulse rounded-xl bg-surface-level-1"></div>
      <div class="h-36 animate-pulse rounded-[22px] bg-surface-level-1"></div>
      <div class="flex gap-2 overflow-hidden">{#each [1,2,3,4,5] as _}<div class="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-surface-level-1"></div>{/each}</div>
      <div class="grid gap-3 sm:grid-cols-2">{#each [1,2,3,4] as _}<div class="h-40 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}</div>
    </div>
  {:else if error || !pitch}
    <section class="uneem-empty">
      <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger-light text-danger"><Icon name="alert-triangle" size={22}/></div>
      <p class="mt-3 font-bold text-text">{error || (ar ? 'المرفق غير موجود' : 'Facility not found')}</p>
      <button on:click={fetchPitch} class="mt-3 min-h-10 text-sm font-bold text-primary">{$_('common.retry')}</button>
    </section>
  {:else}
    <a href="/home" class="uneem-text-action mb-3"><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={17}/>{ar ? 'المرافق' : 'Facilities'}</a>

    <section class="uneem-card">
      <div class="flex items-start gap-3.5">
        <div class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary"><Icon name="trophy" size={21}/></div>
        <div class="min-w-0 flex-1">
          {#if pitch.sport_type}<p class="text-xs font-extrabold capitalize text-primary">{pitch.sport_type}</p>{/if}
          <h1 class="mt-1 truncate text-2xl font-extrabold tracking-[-0.035em] text-text">{pitch.name}</h1>
          <p class="mt-1 flex items-center gap-1.5 text-sm text-text-secondary"><Icon name="map-pin" size={14}/>{pitch.location || $_('bookings.unknown_location')}</p>
          <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-text-muted">
            <span class="inline-flex items-center gap-1.5"><Icon name="clock" size={13}/>{pitch.open_time?.slice(0,5)}–{closeTime()}</span>
            {#if pitch.capacity}<span class="inline-flex items-center gap-1.5"><Icon name="users" size={13}/>{pitch.capacity}</span>{/if}
          </div>
        </div>
      </div>
    </section>

    <section class="mt-7">
      <div class="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 class="text-xl font-extrabold tracking-[-0.025em] text-text">{ar ? 'اختار الوقت' : 'Choose a time'}</h2>
          {#if selectedDate}<p class="mt-1 text-sm text-text-muted">{formatDateHeader(selectedDate)}</p>{/if}
        </div>
        {#if selectedDate && !loadingSlots}<span class="text-xs font-bold text-primary">{selectedAvailableCount} {ar ? 'متاح' : 'available'}</span>{/if}
      </div>

      {#if dates.length > 0}
        <div class="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div class="flex min-w-max gap-2">
            {#each dates as date}
              {@const d = displayDate(date)}
              {@const selected = selectedDate === date}
              <button
                on:click={() => selectedDate = date}
                class="min-h-[76px] min-w-[76px] rounded-2xl border px-3 py-2 text-center transition-colors"
                class:border-primary={selected}
                class:bg-primary={selected}
                class:text-white={selected}
                class:border-border-light={!selected}
                class:bg-surface={!selected}
                class:text-text-secondary={!selected}
                aria-pressed={selected}
              >
                <span class="block text-[10px] font-extrabold uppercase tracking-wide opacity-70">{formatDayLabel(date)}</span>
                <span class="mt-0.5 block text-xl font-extrabold">{d.getDate()}</span>
                <span class="mt-0.5 block text-[10px] font-semibold opacity-70">{availableCount(date)} {ar ? 'متاح' : 'open'}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <section class="mt-3">
      {#if loadingSlots && slots.length === 0}
        <div class="grid gap-3 sm:grid-cols-2" aria-busy="true">{#each [1,2,3,4] as _}<div class="h-40 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}</div>
      {:else if errorSlots && slots.length === 0}
        <div class="uneem-card flex items-center gap-3"><div class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger-light text-danger"><Icon name="alert-circle" size={19}/></div><p class="min-w-0 flex-1 text-sm font-semibold text-danger">{errorSlots}</p><button on:click={fetchSlots} class="min-h-10 text-sm font-bold text-primary">{$_('common.retry')}</button></div>
      {:else if slots.length === 0}
        <div class="uneem-empty"><div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-text-muted"><Icon name="clock" size={22}/></div><p class="mt-3 font-bold text-text">{$_('pitch.no_slots')}</p></div>
      {:else if selectedDate && selectedSlots.length > 0}
        {#if errorSlots}<div class="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-danger-light px-4 py-3 text-sm font-semibold text-danger"><span>{errorSlots}</span><button on:click={fetchSlots} class="shrink-0 font-bold">{$_('common.retry')}</button></div>{/if}
        <div class="mb-3 flex items-center justify-between text-xs text-text-muted"><span>{selectedAvailableCount} {ar ? 'وقت متاح' : 'available times'}</span>{#if loadingSlots}<span class="inline-flex items-center gap-1.5"><span class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>{ar ? 'تحديث' : 'Refreshing'}</span>{:else}<span>{currentTime.toLocaleTimeString($locale || 'en',{hour:'2-digit',minute:'2-digit',hour12:false})}</span>{/if}</div>
        <div class="grid gap-3 sm:grid-cols-2">
          {#each selectedSlots as slot, i (slot.id || `${slot.datetime_start}-${i}`)}
            <SlotCard slotData={slot} onBook={() => openBooking(slot)} onCancel={requestCancellation}/>
          {/each}
        </div>
      {:else}
        <div class="uneem-empty"><p class="font-semibold text-text-muted">{$_('pitch.select_date')}</p></div>
      {/if}
    </section>
  {/if}
</main>

{#if showModal && selectedSlot}<BookingModal slotData={selectedSlot} onClose={onModalClose} onBooked={onBookingCompleted}/>{/if}

{#if cancelSlot}
  <div class="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" role="presentation">
    <button type="button" tabindex="-1" aria-label="Close cancellation dialog" class="absolute inset-0 cursor-default" disabled={canceling} on:click={dismissCancellation}></button>
    <div
      bind:this={cancellationDialog}
      class="uneem-mobile-sheet relative z-10 sm:max-w-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-booking-title"
      tabindex="-1"
      on:keydown={handleCancellationKeydown}
    >
      <h2 id="cancel-booking-title" class="text-xl font-extrabold text-text">{ar ? 'إلغاء الحجز؟' : 'Cancel booking?'}</h2>
      <p class="mt-2 text-sm leading-6 text-text-secondary">{ar ? 'غادي يتحرر هاد الوقت باش يقدر طالب آخر يحجزو.' : 'This time will become available to another student.'}</p>
      <div class="mt-6 flex gap-3">
        <button on:click={dismissCancellation} disabled={canceling} class="uneem-secondary-action flex-1">{ar ? 'خليه' : 'Keep booking'}</button>
        <button on:click={confirmCancellation} disabled={canceling} class="flex min-h-[50px] flex-1 items-center justify-center rounded-[18px] bg-danger px-4 font-bold text-white">{canceling ? (ar ? 'جاري الإلغاء…' : 'Cancelling…') : $_('pitch.cancel_booking')}</button>
      </div>
    </div>
  </div>
{/if}

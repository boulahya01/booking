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
  import { getPitchAvailability, getMyBookings, cancelBooking as cancelBookingRpc, BookingApiError, type MyBooking } from '$lib/bookingApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'

  let pitch: any = null
  let slots: any[] = []
  let myBookings: MyBooking[] = []
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
  $: activeBooking = myBookings.find((booking) => booking.status === 'scheduled' && new Date(booking.ends_at).getTime() > currentTime.getTime()) || null

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
      .select('id,name,location,open_time,close_time,capacity,sport_type,timezone,booking_frequency_enabled,booking_frequency_days')
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
      myBookings = []
      loadingSlots = false
      slotsRequestVersion = null
      syncSelectedDate()
      return
    }

    try {
      const [availability, bookingRows] = await Promise.all([getPitchAvailability(pitchId), getMyBookings()])
      if (version !== fetchVersion) return
      slots = availability
      myBookings = bookingRows
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
    myBookings = []
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

  function policyBlock(slot: any) {
    if (slot.booked_by_me || !slot.is_available) return null

    if (activeBooking) {
      return {
        code: 'active_booking_exists',
        label: ar ? 'عندك حجز جاي. لغيه أو لعبو قبل ما تحجز واحد آخر.' : 'You already have an upcoming booking.'
      }
    }

    if (pitch?.booking_frequency_enabled && Number(pitch?.booking_frequency_days || 0) > 0) {
      const candidate = new Date(slot.datetime_start).getTime()
      const spacing = Number(pitch.booking_frequency_days) * 24 * 60 * 60 * 1000
      const conflict = myBookings.find((booking) => {
        if (booking.status !== 'scheduled' || booking.pitch_id !== pitchId) return false
        const existing = new Date(booking.starts_at).getTime()
        return existing >= candidate - spacing && existing < candidate + spacing
      })

      if (conflict) {
        const after = new Date(new Date(conflict.starts_at).getTime() + spacing)
        const labelDate = after.toLocaleDateString($locale || 'en', {
          month: 'short', day: 'numeric', timeZone: pitch?.timezone || 'Africa/Casablanca'
        })
        return {
          code: 'booking_frequency_limited',
          label: ar ? `اختار وقت من بعد ${labelDate}` : `Choose a slot after ${labelDate}`
        }
      }
    }

    return null
  }

  function decoratedSlot(slot: any) {
    const block = policyBlock(slot)
    return {
      ...slot,
      pitch_name: pitch?.name,
      booking_blocked: Boolean(block),
      booking_block_code: block?.code || null,
      booking_block_label: block?.label || null
    }
  }

  function openBooking(slot: any) {
    const decorated = decoratedSlot(slot)
    if (decorated.booking_blocked || !decorated.is_available) return
    selectedSlot = decorated
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
    void tick().then(() => { if (trigger?.isConnected) trigger.focus() })
  }

  function dismissCancellation() { if (!canceling) clearCancellation() }

  function handleCancellationKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (!canceling) { event.preventDefault(); clearCancellation() }
      return
    }
    if (event.key !== 'Tab' || !cancellationDialog) return

    const focusable = Array.from(cancellationDialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
    if (focusable.length === 0) { event.preventDefault(); cancellationDialog.focus(); return }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === cancellationDialog)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus() }
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
  function formatDayLabel(dateKey: string) { return displayDate(dateKey).toLocaleDateString($locale || 'en', { weekday: 'short' }) }
  function formatMonthLabel(dateKey: string) { return displayDate(dateKey).toLocaleDateString($locale || 'en', { month: 'short' }) }
  function closeTime() {
    const value = pitch?.close_time?.slice(0, 5) || ''
    return value === '00:00' && pitch?.open_time?.slice(0, 5) !== '00:00' ? '24:00' : value
  }
</script>

<svelte:head><title>{pitch?.name || (ar ? 'المرفق' : 'Facility')} · UNEEM</title></svelte:head>

<main class="uneem-page-narrow">
  {#if loading}
    <div class="space-y-4" aria-busy="true">
      <div class="h-10 w-24 animate-pulse rounded-xl bg-surface-level-1"></div>
      <div class="h-24 animate-pulse rounded-[18px] bg-surface-level-1"></div>
      <div class="flex gap-2 overflow-hidden">{#each [1,2,3,4,5] as _}<div class="h-16 w-16 shrink-0 animate-pulse rounded-[14px] bg-surface-level-1"></div>{/each}</div>
      <div class="h-72 animate-pulse rounded-[18px] bg-surface-level-1"></div>
    </div>
  {:else if error || !pitch}
    <section class="uneem-empty">
      <p class="font-bold text-text">{error || (ar ? 'المرفق غير موجود' : 'Facility not found')}</p>
      <button on:click={fetchPitch} class="mt-3 min-h-10 text-sm font-bold text-primary">{$_('common.retry')}</button>
    </section>
  {:else}
    <a href="/home" class="uneem-text-action mb-3"><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={17}/>{ar ? 'رجع' : 'Back'}</a>

    <header class="mb-6">
      <h1 class="text-2xl font-extrabold tracking-[-0.035em] text-text">{pitch.name}</h1>
      <p class="mt-1 flex items-center gap-1.5 text-sm text-text-secondary"><Icon name="map-pin" size={14}/>{pitch.location || $_('bookings.unknown_location')}</p>
      <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-text-muted">
        <span>{pitch.open_time?.slice(0,5)}–{closeTime()}</span>
        {#if pitch.capacity > 1}<span>{pitch.capacity} {ar ? 'لاعبين' : 'players'}</span>{/if}
      </div>
    </header>

    <section>
      <h2 class="mb-3 text-lg font-bold text-text">{ar ? 'اختار النهار' : 'Choose a day'}</h2>
      {#if dates.length > 0}
        <div class="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div class="flex min-w-max gap-2">
            {#each dates as date}
              {@const d = displayDate(date)}
              {@const selected = selectedDate === date}
              <button
                on:click={() => selectedDate = date}
                class="min-h-[62px] min-w-[62px] rounded-[14px] border px-2.5 py-2 text-center transition-colors"
                class:border-primary={selected}
                class:bg-primary-light={selected}
                class:text-primary={selected}
                class:border-border-light={!selected}
                class:bg-surface={!selected}
                class:text-text-secondary={!selected}
                aria-pressed={selected}
              >
                <span class="block text-[10px] font-bold uppercase opacity-75">{formatDayLabel(date)}</span>
                <span class="mt-0.5 block text-lg font-extrabold leading-none">{d.getDate()}</span>
                <span class="mt-1 block text-[9px] font-semibold opacity-65">{formatMonthLabel(date)}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <section class="mt-5">
      <h2 class="mb-2 text-lg font-bold text-text">{ar ? 'الأوقات' : 'Times'}</h2>

      {#if activeBooking && selectedSlots.some((slot) => slot.is_available && !slot.booked_by_me)}
        <a href="/bookings" class="mb-3 flex items-center justify-between gap-3 rounded-[14px] bg-warning-light px-3.5 py-3 text-sm font-semibold text-warning">
          <span>{ar ? 'عندك حجز جاي دابا.' : 'You already have an upcoming booking.'}</span>
          <span class="shrink-0 font-bold">{ar ? 'شوفو' : 'View'}</span>
        </a>
      {/if}

      {#if loadingSlots && slots.length === 0}
        <div class="h-64 animate-pulse rounded-[18px] bg-surface-level-1" aria-busy="true"></div>
      {:else if errorSlots && slots.length === 0}
        <div class="flex items-center justify-between gap-3 py-4"><p class="text-sm font-semibold text-danger">{errorSlots}</p><button on:click={fetchSlots} class="min-h-10 text-sm font-bold text-primary">{$_('common.retry')}</button></div>
      {:else if slots.length === 0}
        <div class="uneem-empty"><p class="font-semibold text-text-muted">{$_('pitch.no_slots')}</p></div>
      {:else if selectedDate && selectedSlots.length > 0}
        {#if errorSlots}<div class="mb-3 flex items-center justify-between gap-3 rounded-[14px] bg-danger-light px-3.5 py-3 text-sm font-semibold text-danger"><span>{errorSlots}</span><button on:click={fetchSlots} class="shrink-0 font-bold">{$_('common.retry')}</button></div>{/if}
        <div class="rounded-[18px] border border-border-light bg-surface px-3">
          {#each selectedSlots as slot, i (slot.id || `${slot.datetime_start}-${i}`)}
            <SlotCard slotData={decoratedSlot(slot)} onBook={() => openBooking(slot)} onCancel={requestCancellation}/>
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
    <section bind:this={cancellationDialog} class="uneem-mobile-sheet relative z-10 sm:max-w-md" role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title" tabindex="-1" on:keydown={handleCancellationKeydown}>
      <h2 id="cancel-booking-title" class="text-xl font-extrabold text-text">{ar ? 'تلغي الحجز؟' : 'Cancel booking?'}</h2>
      <div class="mt-5 flex gap-3">
        <button on:click={dismissCancellation} disabled={canceling} class="uneem-secondary-action flex-1">{ar ? 'خليه' : 'Keep booking'}</button>
        <button on:click={confirmCancellation} disabled={canceling} class="flex min-h-[48px] flex-1 items-center justify-center rounded-[14px] bg-danger px-4 font-bold text-white">{canceling ? (ar ? 'جاري الإلغاء…' : 'Cancelling…') : $_('pitch.cancel_booking')}</button>
      </div>
    </section>
  </div>
{/if}

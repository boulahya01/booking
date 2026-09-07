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
  let cancelSlot: any = null
  let canceling = false
  let currentTime = new Date()
  let cancellationDialog: HTMLElement | null = null
  let cancellationTrigger: HTMLElement | null = null

  $: pitchId = $page.params.id
  $: ar = ($locale || 'en').startsWith('ar')
  $: visibleSlots = slots.filter((slot) => {
    const start = new Date(slot.datetime_start).getTime()
    return start >= currentTime.getTime() - 60_000 && start < currentTime.getTime() + 24 * 60 * 60 * 1000
  })
  $: activeBooking = myBookings.find((booking) => booking.status === 'scheduled' && new Date(booking.ends_at).getTime() > currentTime.getTime()) || null
  $: decoratedVisibleSlots = visibleSlots.map((slot) => decoratedSlot(slot))
  $: actionableSlots = decoratedVisibleSlots.filter((slot) => slot.booked_by_me || (slot.is_available && !slot.booking_blocked))
  $: policyBlockedSlots = decoratedVisibleSlots.filter((slot) => !slot.booked_by_me && slot.is_available && slot.booking_blocked)
  $: policySummary = policyBlockedSlots.length > 0
    ? [...policyBlockedSlots].sort((a, b) => Number(a.booking_eligible_at || 0) - Number(b.booking_eligible_at || 0))[0]
    : null
  $: grouped = actionableSlots.reduce<Record<string, any[]>>((acc, slot) => {
    const key = facilityDateKey(slot.datetime_start)
    ;(acc[key] ??= []).push(slot)
    return acc
  }, {})
  $: slotGroups = Object.keys(grouped).sort().map((date) => ({ date, slots: grouped[date] }))

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
      .select('id,name,location,open_time,close_time,capacity,sport_type,timezone,booking_frequency_enabled,booking_frequency_days,cancellation_cutoff_minutes')
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
      return
    }

    try {
      const [availability, bookingRows] = await Promise.all([getPitchAvailability(pitchId), getMyBookings()])
      if (version !== fetchVersion) return
      slots = availability
      myBookings = bookingRows
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

  function countdownText(targetMs: number) {
    const remaining = Math.max(0, targetMs - currentTime.getTime())
    const minutes = Math.ceil(remaining / 60_000)
    if (minutes <= 1) return ar ? 'دقيقة' : '1m'
    if (minutes < 60) return ar ? `${minutes} د` : `${minutes}m`
    const hours = Math.ceil(minutes / 60)
    if (hours < 24) return ar ? `${hours} س` : `${hours}h`
    const days = Math.ceil(hours / 24)
    return ar ? `${days} أيام` : `${days} ${days === 1 ? 'day' : 'days'}`
  }

  function policyBlock(slot: any) {
    if (slot.booked_by_me || !slot.is_available) return null

    let eligibleAt = 0
    let code: 'active_booking_exists' | 'booking_frequency_limited' = 'active_booking_exists'

    if (activeBooking) eligibleAt = Math.max(eligibleAt, new Date(activeBooking.ends_at).getTime())

    if (pitch?.booking_frequency_enabled && Number(pitch?.booking_frequency_days || 0) > 0) {
      const candidate = new Date(slot.datetime_start).getTime()
      const spacing = Number(pitch.booking_frequency_days) * 24 * 60 * 60 * 1000
      const conflicts = myBookings.filter((booking) => {
        if (booking.status !== 'scheduled' || booking.pitch_id !== pitchId) return false
        const existing = new Date(booking.starts_at).getTime()
        return existing >= candidate - spacing && existing < candidate + spacing
      })

      for (const conflict of conflicts) {
        const nextAllowed = new Date(conflict.starts_at).getTime() + spacing
        if (nextAllowed > eligibleAt) {
          eligibleAt = nextAllowed
          code = 'booking_frequency_limited'
        }
      }
    }

    if (!eligibleAt || eligibleAt <= currentTime.getTime()) return null

    const labelDate = new Date(eligibleAt).toLocaleDateString($locale || 'en', {
      month: 'short', day: 'numeric', timeZone: pitch?.timezone || 'Africa/Casablanca'
    })

    return {
      code,
      eligibleAt,
      countdown: countdownText(eligibleAt),
      label: ar ? `يمكنك الحجز مرة أخرى ابتداءً من ${labelDate}` : `You can book again from ${labelDate}`
    }
  }

  function decoratedSlot(slot: any) {
    const block = policyBlock(slot)
    const startsAt = new Date(slot.datetime_start).getTime()
    const cutoffMinutes = Number(pitch?.cancellation_cutoff_minutes || 0)
    const cancellationBlocked = Boolean(slot.booked_by_me) && currentTime.getTime() >= startsAt - cutoffMinutes * 60_000

    return {
      ...slot,
      pitch_name: pitch?.name,
      booking_blocked: Boolean(block),
      booking_block_code: block?.code || null,
      booking_block_label: block?.label || null,
      booking_block_countdown: block?.countdown || null,
      booking_eligible_at: block?.eligibleAt || null,
      cancellation_blocked: cancellationBlocked,
      cancellation_block_label: cancellationBlocked
        ? (ar ? `يبدأ بعد ${countdownText(startsAt)}` : `Starts in ${countdownText(startsAt)}`)
        : null
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
    const decorated = decoratedSlot(slot)
    if (!slot.booking_id || decorated.cancellation_blocked) return
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

  function displayDate(dateKey: string) { return new Date(`${dateKey}T12:00:00`) }

  function groupLabel(dateKey: string) {
    const date = displayDate(dateKey)
    const today = displayDate(facilityDateKey(currentTime.toISOString()))
    const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000)
    const prefix = diff === 0 ? (ar ? 'اليوم' : 'Today') : diff === 1 ? (ar ? 'غداً' : 'Tomorrow') : date.toLocaleDateString($locale || 'en', { weekday: 'long' })
    const shortDate = date.toLocaleDateString($locale || 'en', { month: 'short', day: 'numeric' })
    return `${prefix} · ${shortDate}`
  }

  function hoursLabel() {
    const open = pitch?.open_time?.slice(0, 5) || ''
    const close = pitch?.close_time?.slice(0, 5) || ''
    if (!open || !close) return ''
    return close < open ? `${open}–${close} ${ar ? '(اليوم التالي)' : '(next day)'}` : `${open}–${close}`
  }
</script>

<svelte:head><title>{pitch?.name || (ar ? 'المرفق' : 'Facility')} · UNEEM</title></svelte:head>

<main class="uneem-page-narrow">
  {#if loading}
    <div class="space-y-4" aria-busy="true">
      <div class="h-10 w-24 animate-pulse rounded-xl bg-surface-level-1"></div>
      <div class="h-24 animate-pulse rounded-[18px] bg-surface-level-1"></div>
      <div class="space-y-3">{#each [1,2,3,4] as _}<div class="h-[88px] animate-pulse rounded-[16px] bg-surface-level-1"></div>{/each}</div>
    </div>
  {:else if error || !pitch}
    <section class="uneem-empty">
      <p class="font-bold text-text">{error || (ar ? 'المرفق غير موجود' : 'Facility not found')}</p>
      <button on:click={fetchPitch} class="mt-3 min-h-10 text-sm font-bold text-primary">{$_('common.retry')}</button>
    </section>
  {:else}
    <a href="/home" class="uneem-text-action mb-3"><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={17}/>{ar ? 'رجوع' : 'Back'}</a>

    <header class="mb-5">
      <h1 class="text-[26px] font-extrabold tracking-[-0.035em] text-text">{pitch.name}</h1>
      <p class="mt-1 flex items-center gap-1.5 text-sm text-text-secondary"><Icon name="map-pin" size={14}/>{pitch.location || $_('bookings.unknown_location')}</p>
      <div class="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold text-text-muted">
        <span>{hoursLabel()}</span>
        {#if pitch.capacity > 1}<span>·</span><span>{pitch.capacity} {ar ? 'لاعبين' : 'players'}</span>{/if}
      </div>
    </header>

    <section>
      <div class="mb-3 flex items-center justify-between gap-4">
        <h2 class="text-lg font-bold text-text">{ar ? 'الأوقات' : 'Times'}</h2>
        {#if loadingSlots && slots.length > 0}<span class="text-xs font-semibold text-text-muted">{ar ? 'تحديث…' : 'Refreshing…'}</span>{/if}
      </div>

      {#if loadingSlots && slots.length === 0}
        <div class="overflow-hidden rounded-[16px] border border-border-light bg-surface" aria-busy="true">
          {#each [1,2,3,4] as _}<div class="h-[64px] border-b border-border-light last:border-0"><div class="m-3 h-10 animate-pulse rounded-xl bg-surface-level-1"></div></div>{/each}
        </div>
      {:else if errorSlots && slots.length === 0}
        <div class="flex items-center justify-between gap-3 py-4"><p class="text-sm font-semibold text-danger">{errorSlots}</p><button on:click={fetchSlots} class="min-h-10 text-sm font-bold text-primary">{$_('common.retry')}</button></div>
      {:else if visibleSlots.length === 0}
        <div class="uneem-empty py-8"><p class="font-semibold text-text-muted">{$_('pitch.no_slots')}</p></div>
      {:else}
        {#if errorSlots}<div class="mb-3 flex items-center justify-between gap-3 rounded-[14px] bg-danger-light px-3.5 py-3 text-sm font-semibold text-danger"><span>{errorSlots}</span><button on:click={fetchSlots} class="shrink-0 font-bold">{$_('common.retry')}</button></div>{/if}

        {#if slotGroups.length > 0}
          <div class="space-y-4">
            {#each slotGroups as group}
              <div>
                <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">{groupLabel(group.date)}</p>
                <div class="divide-y divide-border-light overflow-hidden rounded-[16px] border border-border-light bg-surface">
                  {#each group.slots as slot, i (slot.id || `${slot.datetime_start}-${i}`)}
                    <SlotCard slotData={slot} onBook={() => openBooking(slot)} onCancel={requestCancellation}/>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}

        {#if policySummary}
          <div class="mt-4 flex items-center gap-3 rounded-[14px] bg-surface-level-1 px-3.5 py-3">
            <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-text-muted"><Icon name="calendar-days" size={17}/></div>
            <p class="min-w-0 text-sm font-bold text-text">{policySummary.booking_block_label}</p>
          </div>
        {:else if slotGroups.length === 0}
          <div class="uneem-empty py-8"><p class="font-semibold text-text-muted">{ar ? 'لا توجد أوقات متاحة خلال الساعات الأربع والعشرين القادمة.' : 'No available times in the next 24 hours.'}</p></div>
        {/if}
      {/if}
    </section>
  {/if}
</main>

{#if showModal && selectedSlot}<BookingModal slotData={selectedSlot} onClose={onModalClose} onBooked={onBookingCompleted}/>{/if}

{#if cancelSlot}
  <div class="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" role="presentation">
    <button type="button" tabindex="-1" aria-label="Close cancellation dialog" class="absolute inset-0 cursor-default" disabled={canceling} on:click={dismissCancellation}></button>
    <section bind:this={cancellationDialog} class="uneem-mobile-sheet relative z-10 sm:max-w-md" role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title" tabindex="-1" on:keydown={handleCancellationKeydown}>
      <h2 id="cancel-booking-title" class="text-xl font-extrabold text-text">{ar ? 'هل تريد إلغاء الحجز؟' : 'Cancel booking?'}</h2>
      <p class="mt-2 text-sm text-text-secondary">{ar ? 'سيصبح هذا الوقت متاحاً لطالب آخر.' : 'The time will become available to another student.'}</p>
      <div class="mt-5 flex gap-3">
        <button on:click={dismissCancellation} disabled={canceling} class="uneem-secondary-action flex-1">{ar ? 'الاحتفاظ بالحجز' : 'Keep booking'}</button>
        <button on:click={confirmCancellation} disabled={canceling} class="flex min-h-[48px] flex-1 items-center justify-center rounded-[14px] bg-danger px-4 font-bold text-white">{canceling ? (ar ? 'جارٍ الإلغاء…' : 'Cancelling…') : $_('pitch.cancel_booking')}</button>
      </div>
    </section>
  </div>
{/if}

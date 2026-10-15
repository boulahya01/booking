<script lang="ts">
  import { hasFullAccess } from '$lib/stores/auth'
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { getFacility, type FacilityDetails } from '$lib/facilityApi'
  import { peekCachedValue, setCachedValue, invalidateRequestCache } from '$lib/requestCache'
  import { listMyMatches, type MyMatch } from '$lib/matchApi'
  import SlotCard from '$lib/components/SlotCard.svelte'
  import BookingModal from '$lib/components/BookingModal.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import Button from '$lib/components/Button.svelte'
  import { _, locale } from 'svelte-i18n'
  import {
    getPitchAvailability,
    getMyBookings,
    BookingApiError,
    type AvailabilitySlot, type CreatedBooking, type MyBooking
  } from '$lib/bookingApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'

  let pitch: FacilityDetails | null = null
  let slots: any[] = []
  let myBookings: MyBooking[] = []
  let myMatches: MyMatch[] = []
  let loadedPitchId = ''
  let policyVersion = 0
  let availabilityVersion = 0
  let loading = true
  let loadingSlots = false
  let error: string | null = null
  let errorSlots: string | null = null
  let selectedSlot: any = null
  let showModal = false
  let currentTime = new Date()

  let fetchVersion = 0
  let refreshInterval: ReturnType<typeof setInterval> | null = null
  let cleanupVisibility: (() => void) | null = null

  $: pitchId = $page.params.id
  $: ar = ($locale || 'en').startsWith('ar')
  $: visibleSlots = slots.filter((slot) => {
    const start = new Date(slot.datetime_start).getTime()
    return start >= currentTime.getTime() - 60_000
      && start < currentTime.getTime() + 24 * 60 * 60 * 1000
  })
  $: activeBooking = myBookings.find(
    (booking) => ['scheduled', 'in_progress'].includes(booking.status) && new Date(booking.ends_at).getTime() > currentTime.getTime()
  ) || null
  $: slotContext = { pitch, myMatches, myBookings, activeBooking, locale: $locale, now: currentTime }
  $: decoratedVisibleSlots = visibleSlots.map((slot) => decoratedSlot(slot, slotContext))
  $: policyBlockedSlots = decoratedVisibleSlots.filter(
    (slot) => slot.is_available && slot.booking_blocked
  )
  $: policySummary = policyBlockedSlots.length > 0
    ? [...policyBlockedSlots].sort(
        (a, b) => Number(a.booking_eligible_at || 0) - Number(b.booking_eligible_at || 0)
      )[0]
    : null
  $: grouped = decoratedVisibleSlots.reduce<Record<string, any[]>>((acc, slot) => {
    const key = facilityDateKey(slot.datetime_start, pitch?.timezone)
    ;(acc[key] ??= []).push(slot)
    return acc
  }, {})
  $: slotGroups = Object.keys(grouped)
    .sort()
    .map((date) => ({ date, slots: grouped[date] }))

  function startAutoRefresh() {
    refreshInterval = setInterval(() => {
      if (!document.hidden && pitchId && !showModal) { void fetchSlots(true); void fetchPolicy(true) }
    }, 120_000)

    const handleVisibility = () => {
      if (!document.hidden && pitchId && !showModal) { void fetchSlots(); void fetchPolicy() }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    cleanupVisibility = () => document.removeEventListener('visibilitychange', handleVisibility)
  }

  function stopAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval)
    refreshInterval = null
    cleanupVisibility?.()
    cleanupVisibility = null
  }

  async function fetchPitch(force = false) {
    const version = fetchVersion
    if (!pitchId) { loading = false; return }
    try {
      const data = await getFacility(pitchId, force)
      if (version !== fetchVersion) return
      pitch = data
      error = null
    } catch {
      if (version !== fetchVersion) return
      error = $_('common.error')
    } finally {
      if (version === fetchVersion) loading = false
    }
  }

  async function fetchSlots(force = false) {
    const version = fetchVersion
    const request = ++availabilityVersion
    if (!pitchId) return
    loadingSlots = slots.length === 0
    errorSlots = null
    try {
      const availability = await getPitchAvailability(pitchId, force)
      if (version !== fetchVersion || request !== availabilityVersion) return
      slots = availability
    } catch (fetchError) {
      if (version !== fetchVersion || request !== availabilityVersion) return
      errorSlots = bookingFailureMessage(fetchError instanceof BookingApiError ? fetchError.code : 'unknown', $locale)
    } finally {
      if (version === fetchVersion && request === availabilityVersion) loadingSlots = false
    }
  }

  async function fetchPolicy(force = false) {
    const version = fetchVersion
    const request = ++policyVersion
    // Each confirmed read can update its guidance without waiting on the other.
    await Promise.allSettled([
      getMyBookings(undefined, force).then(bookings => {
        if (version === fetchVersion && request === policyVersion) myBookings = bookings
      }),
      listMyMatches(force).then(matches => {
        if (version === fetchVersion && request === policyVersion) myMatches = matches
      })
    ])
  }

  $: if (pitchId && browser && loadedPitchId !== pitchId) {
    loadedPitchId = pitchId
    fetchVersion++
    error = null
    errorSlots = null
    pitch = peekCachedValue<FacilityDetails>('facility:' + pitchId) ?? null
    slots = peekCachedValue<AvailabilitySlot[]>('availability:' + pitchId) ?? []
    myBookings = peekCachedValue<MyBooking[]>('my-bookings') ?? []
    myMatches = peekCachedValue<MyMatch[]>('my-matches') ?? []
    loading = !pitch
    loadingSlots = slots.length === 0
    void fetchPitch()
    void fetchSlots()
    void fetchPolicy()
  }

  onMount(() => {
    const timer = setInterval(() => {
      currentTime = new Date()
    }, 60_000)
    startAutoRefresh()

    return () => {
      fetchVersion++
      clearInterval(timer)
      stopAutoRefresh()
    }
  })

  function policyBlock(slot: any, context: typeof slotContext) {
    const { pitch, myBookings, activeBooking, locale: currentLocale, now } = context
    if (!slot.is_available) return null

    let eligibleAt = 0
    let code: 'active_booking_exists' | 'booking_frequency_limited' = 'active_booking_exists'

    if (activeBooking) {
      eligibleAt = Math.max(eligibleAt, new Date(activeBooking.ends_at).getTime())
    }

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

    if (!eligibleAt || eligibleAt <= now.getTime()) return null

    const labelDate = new Date(eligibleAt).toLocaleDateString(currentLocale || 'en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: pitch?.timezone || 'Africa/Casablanca'
    })

    return {
      code,
      eligibleAt,
      label: code === 'booking_frequency_limited'
        ? (ar ? `اختر موعداً يبدأ بعد ${labelDate}` : `Choose a slot starting after ${labelDate}`)
        : (ar ? `يمكنك الحجز مرة أخرى ابتداءً من ${labelDate}` : `You can book again from ${labelDate}`)
    }
  }

  function decoratedSlot(slot: any, context = slotContext) {
    const block = policyBlock(slot, context)
    return {
      ...slot,
      joined_by_me: context.myMatches.some(match => match.booking_id === slot.booking_id && match.member_role !== 'organizer'),
      pitch_name: context.pitch?.name,
      booking_blocked: Boolean(block),
      booking_block_code: block?.code || null,
      booking_block_label: block?.label || null,
      booking_eligible_at: block?.eligibleAt || null
    }
  }

  function openBooking(slot: any) {
    if (!$hasFullAccess) { void goto('/verification'); return }
    const decorated = decoratedSlot(slot)
    if (decorated.booking_blocked || !decorated.is_available) return
    selectedSlot = decorated
    showModal = true
  }

  function viewBooking(slot: any) {
    if (!slot.booking_id) return
    void goto(`/bookings/${slot.booking_id}`)
  }

  function onModalClose() {
    showModal = false
    selectedSlot = null
  }

  function onBookingCompleted(booking: CreatedBooking) {
    // Supersede any snapshot reads that started before the confirmed write.
    availabilityVersion++
    policyVersion++
    slots = slots.map(slot => Date.parse(slot.datetime_start) === Date.parse(booking.starts_at)
      ? { ...slot, booking_id: booking.id, datetime_end: booking.ends_at, is_available: false, booked_by_me: true, match_id: null, match_open: false, joined_count: 0, reserved_spots: 0 }
      : slot)
    myBookings = [...myBookings.filter(item => item.id !== booking.id), {
      id: booking.id, pitch_id: booking.pitch_id, starts_at: booking.starts_at, ends_at: booking.ends_at,
      status: 'scheduled', lifecycle_status: 'upcoming', cancelled_at: null, created_at: new Date().toISOString(),
      pitches: pitch ? { name: pitch.name, location: pitch.location, capacity: pitch.capacity, timezone: pitch.timezone } : null
    }]
    invalidateRequestCache('availability:' + pitchId)
    invalidateRequestCache('my-bookings')
    setCachedValue('availability:' + pitchId, slots, 15_000)
    setCachedValue('my-bookings', myBookings, 20_000)
    loadingSlots = false
    // The confirmed slot is usable while the rest of the grid reconciles.
    void fetchSlots(true)
    void fetchPolicy(true)
  }

  function onBookingUnavailable() { void fetchSlots(true); void fetchPolicy(true) }

  function facilityDateKey(value: string, timezone = pitch?.timezone): string {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone || 'Africa/Casablanca',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date(value))

    return `${parts.find((p) => p.type === 'year')?.value || ''}-${parts.find((p) => p.type === 'month')?.value || ''}-${parts.find((p) => p.type === 'day')?.value || ''}`
  }

  function displayDate(dateKey: string) {
    return new Date(`${dateKey}T12:00:00`)
  }

  function groupLabel(dateKey: string) {
    const date = displayDate(dateKey)
    const today = displayDate(facilityDateKey(currentTime.toISOString()))
    const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000)
    const prefix = diff === 0
      ? (ar ? 'اليوم' : 'Today')
      : diff === 1
        ? (ar ? 'غداً' : 'Tomorrow')
        : date.toLocaleDateString($locale || 'en', { weekday: 'long' })
    const shortDate = date.toLocaleDateString($locale || 'en', { month: 'short', day: 'numeric' })
    return `${prefix} · ${shortDate}`
  }

  function hoursLabel() {
    const open = pitch?.open_time?.slice(0, 5) || ''
    const close = pitch?.close_time?.slice(0, 5) || ''
    if (!open || !close) return ''
    return close < open
      ? `${open}–${close} ${ar ? '(اليوم التالي)' : '(next day)'}`
      : `${open}–${close}`
  }
</script>

<svelte:head>
  <title>{pitch?.name || (ar ? 'المرفق' : 'Facility')} · UNEEM</title>
</svelte:head>

<main class="uneem-page-narrow pitch-page">
  {#if loading}
    <div class="space-y-4" aria-busy="true">
      <div class="h-10 w-24 animate-pulse rounded-xl bg-surface-level-1"></div>
      <div class="h-32 animate-pulse rounded-[22px] bg-surface-level-1"></div>
      <div class="slot-grid">
        {#each [1,2,3,4] as _}
          <div class="h-[144px] animate-pulse rounded-[18px] bg-surface-level-1"></div>
        {/each}
      </div>
    </div>
  {:else if error || !pitch}
    <section class="uneem-empty">
      <p class="font-medium text-text">
        {error || (ar ? 'المرفق غير موجود' : 'Facility not found')}
      </p>
      <Button on:click={() => fetchPitch(true)} variant="secondary" className="mt-4">
        {$_('common.retry')}
      </Button>
    </section>
  {:else}
    <a href="/home" class="uneem-text-action mb-4">
      <Icon name={ar ? 'arrow-right' : 'arrow-left'} size={17}/>
      {ar ? 'رجوع' : 'Back'}
    </a>

    <header class="pitch-heading">
      <h1>{pitch.name}</h1>
      <p class="pitch-location"><Icon name="map-pin" size={17}/><span>{pitch.location || $_('bookings.unknown_location')}</span></p>
      <div class="pitch-facts">
        {#if hoursLabel()}<span><Icon name="clock" size={16}/><bdi>{hoursLabel()}</bdi></span>{/if}
        {#if pitch.capacity > 1}<span><Icon name="users" size={16}/>{pitch.capacity} {ar ? 'لاعبين' : 'players'}</span>{/if}
      </div>
    </header>

    <section>
      <div class="times-heading">
        <div><h2>{ar ? 'اختر وقتك' : 'Choose your time'}</h2><p>{ar ? 'خلال 24 ساعة القادمة' : 'Next 24 hours'}</p></div>
        {#if loadingSlots && slots.length > 0}
          <span class="text-xs font-medium text-text-muted">
            {ar ? 'تحديث…' : 'Refreshing…'}
          </span>
        {/if}
      </div>

      {#if loadingSlots && slots.length === 0}
        <div class="slot-grid" aria-busy="true">
          {#each [1,2,3,4] as _}
            <div class="h-[144px] animate-pulse rounded-[18px] bg-surface-level-1"></div>
          {/each}
        </div>
      {:else if errorSlots && slots.length === 0}
        <div class="flex flex-col gap-4 rounded-[22px] bg-surface p-5" role="alert">
          <p class="text-sm font-medium text-danger">{errorSlots}</p>
          <Button on:click={() => fetchSlots(true)} variant="secondary" fullWidth>
            {$_('common.retry')}
          </Button>
        </div>
      {:else if visibleSlots.length === 0}
        <div class="uneem-empty py-8">
          <p class="font-medium text-text-muted">{$_('pitch.no_slots')}</p>
        </div>
      {:else}
        {#if errorSlots}
          <div class="mb-3 flex items-center justify-between gap-3 rounded-[14px] bg-danger-light px-3.5 py-3 text-sm font-medium text-danger">
            <span>{errorSlots}</span>
            <Button on:click={() => fetchSlots(true)} variant="ghost" size="sm">{$_('common.retry')}</Button>
          </div>
        {/if}

        {#if policySummary}
          <div id="booking-policy" class="booking-policy" role="status">
            <Icon name="calendar-days" size={17}/>
            <div class="booking-policy-content">
              <p class="policy-reason">{policySummary.booking_block_code === 'booking_frequency_limited'
                ? (ar ? `يسمح هذا المرفق بحجز واحد كل ${pitch.booking_frequency_days} أيام.` : `This facility allows one booking every ${pitch.booking_frequency_days === 1 ? 'day' : `${pitch.booking_frequency_days} days`}.`)
                : (ar ? 'لديك حجز قادم أو جارٍ بالفعل.' : 'You already have an upcoming or current booking.')}</p>
              <p class="policy-time">{policySummary.booking_block_label}</p>
              {#if policySummary.booking_block_code === 'booking_frequency_limited'}
                <p class="policy-window">{ar ? `تظهر الأوقات قبل بدايتها بـ ${Math.min(24, Number(pitch.booking_window_hours) || 24)} ساعة.` : `Slots appear ${Math.min(24, Number(pitch.booking_window_hours) || 24)} hours before they start.`}</p>
              {/if}
              <a href="/matches" class="policy-match-link">{ar ? 'يمكنك الانضمام إلى مباراة مفتوحة' : 'You can still join an open match'}<Icon name={ar ? 'arrow-left' : 'arrow-right'} size={15}/></a>
            </div>
          </div>
        {/if}
        <div class="space-y-7">
          {#each slotGroups as group}
            <div>
              <h3 class="mb-3 text-sm font-medium text-text-secondary">
                {groupLabel(group.date)}
              </h3>
              <div class="slot-grid">
                {#each group.slots as slot, i (`${slot.pitch_id}:${Date.parse(slot.datetime_start)}`)}
                  <SlotCard
                    slotData={slot}
                    onBook={() => openBooking(slot)}
                    onView={() => viewBooking(slot)}
                  />
                {/each}
              </div>
            </div>
          {/each}
        </div>

      {/if}
    </section>
  {/if}
</main>

{#if showModal && selectedSlot}
  <BookingModal
    slotData={selectedSlot}
    onClose={onModalClose}
    onBooked={onBookingCompleted}
    onUnavailable={onBookingUnavailable}
  />
{/if}

<style>
  .pitch-heading { padding: 4px 0 28px; }
  .pitch-heading h1 { font-size: clamp(28px, 5vw, 36px); font-weight: 500; letter-spacing: var(--tracking-tight); line-height: 1.2; overflow-wrap: anywhere; }
  .pitch-location { display: flex; align-items: flex-start; gap: 8px; margin-top: 12px; color: var(--text-secondary); font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
  .pitch-location :global(svg) { margin-top: 2px; flex-shrink: 0; }
  .pitch-facts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .pitch-facts > span { display: inline-flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 12px; background: var(--surface); color: var(--text-secondary); font-size: 13px; }
  .times-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
  .times-heading h2 { font-size: 21px; font-weight: 500; letter-spacing: var(--tracking-tight); }
  .times-heading p { margin-top: 5px; color: var(--text-muted); font-size: 13px; }
  .slot-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .booking-policy { display: flex; align-items: flex-start; gap: 10px; padding: 14px 16px; margin-bottom: 20px; border-radius: 14px; background: var(--surface-level-1); color: var(--text-secondary); font-size: 13px; line-height: 1.6; }
  .booking-policy :global(svg) { flex-shrink: 0; margin-top: 2px; }
  .booking-policy-content { min-width: 0; }
  .policy-reason { color: var(--text); font-weight: 500; }
  .policy-time { margin-top: 6px; font-variant-numeric: tabular-nums; }
  .policy-window { margin-top: 4px; font-size: 12px; color: var(--text-muted); }
  .policy-match-link { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; margin-top: 4px; font-weight: 500; color: var(--primary); }
  .policy-match-link:hover { text-decoration: underline; }
  .policy-match-link:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 4px; }
  @media (min-width: 640px) { .slot-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; } }
</style>

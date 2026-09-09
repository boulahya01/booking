<script lang="ts">
  import { hasFullAccess } from '$lib/stores/auth'
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { supabase } from '$lib/supabaseClient'
  import SlotCard from '$lib/components/SlotCard.svelte'
  import BookingModal from '$lib/components/BookingModal.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import Button from '$lib/components/Button.svelte'
  import { _, locale } from 'svelte-i18n'
  import { USE_MOCK, mockPitches, mockSlots } from '$lib/mock'
  import { logger } from '$lib/logger'
  import {
    getPitchAvailability,
    getMyBookings,
    BookingApiError,
    type MyBooking
  } from '$lib/bookingApi'
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
  let currentTime = new Date()

  let fetchVersion = 0
  let slotsRequestVersion: number | null = null
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
  $: decoratedVisibleSlots = visibleSlots.map((slot) => decoratedSlot(slot))
  $: policyBlockedSlots = decoratedVisibleSlots.filter(
    (slot) => slot.is_available && slot.booking_blocked
  )
  $: policySummary = policyBlockedSlots.length > 0
    ? [...policyBlockedSlots].sort(
        (a, b) => Number(a.booking_eligible_at || 0) - Number(b.booking_eligible_at || 0)
      )[0]
    : null
  $: grouped = decoratedVisibleSlots.reduce<Record<string, any[]>>((acc, slot) => {
    const key = facilityDateKey(slot.datetime_start)
    ;(acc[key] ??= []).push(slot)
    return acc
  }, {})
  $: slotGroups = Object.keys(grouped)
    .sort()
    .map((date) => ({ date, slots: grouped[date] }))

  function startAutoRefresh() {
    refreshInterval = setInterval(() => {
      if (!document.hidden && pitchId && !showModal) void fetchSlots()
    }, 120_000)

    const handleVisibility = () => {
      if (!document.hidden && pitchId) void fetchSlots()
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

  async function fetchPitch() {
    const version = ++fetchVersion
    if (!pitchId) {
      pitch = null
      loading = false
      return
    }

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
      return
    }

    try {
      const [availability, bookingRows] = await Promise.all([
        getPitchAvailability(pitchId),
        getMyBookings()
      ])
      if (version !== fetchVersion) return
      slots = availability
      myBookings = bookingRows
    } catch (fetchError) {
      if (version !== fetchVersion) return
      logger.error('[Pitch Page] Failed to load availability:', fetchError)
      errorSlots = bookingFailureMessage(
        fetchError instanceof BookingApiError ? fetchError.code : 'unknown',
        $locale
      )
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
    void fetchPitch()
    void fetchSlots()
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

  function policyBlock(slot: any) {
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

    if (!eligibleAt || eligibleAt <= currentTime.getTime()) return null

    const labelDate = new Date(eligibleAt).toLocaleDateString($locale || 'en', {
      month: 'short',
      day: 'numeric',
      timeZone: pitch?.timezone || 'Africa/Casablanca'
    })

    return {
      code,
      eligibleAt,
      label: ar
        ? `يمكنك الحجز مرة أخرى ابتداءً من ${labelDate}`
        : `You can book again from ${labelDate}`
    }
  }

  function decoratedSlot(slot: any) {
    const block = policyBlock(slot)
    return {
      ...slot,
      pitch_name: pitch?.name,
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

  async function onBookingCompleted() {
    await fetchSlots()
  }

  function facilityDateKey(value: string): string {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: pitch?.timezone || 'Africa/Casablanca',
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
      <p class="font-bold text-text">
        {error || (ar ? 'المرفق غير موجود' : 'Facility not found')}
      </p>
      <Button on:click={fetchPitch} variant="secondary" className="mt-4">
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
          <span class="text-xs font-semibold text-text-muted">
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
          <p class="text-sm font-semibold text-danger">{errorSlots}</p>
          <Button on:click={fetchSlots} variant="secondary" fullWidth>
            {$_('common.retry')}
          </Button>
        </div>
      {:else if visibleSlots.length === 0}
        <div class="uneem-empty py-8">
          <p class="font-semibold text-text-muted">{$_('pitch.no_slots')}</p>
        </div>
      {:else}
        {#if errorSlots}
          <div class="mb-3 flex items-center justify-between gap-3 rounded-[14px] bg-danger-light px-3.5 py-3 text-sm font-semibold text-danger">
            <span>{errorSlots}</span>
            <Button on:click={fetchSlots} variant="ghost" size="sm">{$_('common.retry')}</Button>
          </div>
        {/if}

        <div class="space-y-7">
          {#each slotGroups as group}
            <div>
              <h3 class="mb-3 text-sm font-semibold text-text-secondary">
                {groupLabel(group.date)}
              </h3>
              <div class="slot-grid">
                {#each group.slots as slot, i (slot.id || `${slot.datetime_start}-${i}`)}
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

        {#if policySummary}
          <div class="mt-4 flex items-center gap-3 rounded-[14px] bg-surface-level-1 px-3.5 py-3">
            <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-text-muted">
              <Icon name="calendar-days" size={17}/>
            </div>
            <p class="min-w-0 text-sm font-bold text-text">
              {policySummary.booking_block_label}
            </p>
          </div>
        {/if}
      {/if}
    </section>
  {/if}
</main>

{#if showModal && selectedSlot}
  <BookingModal
    slotData={selectedSlot}
    onClose={onModalClose}
    onBooked={onBookingCompleted}
  />
{/if}

<style>
  .pitch-heading { padding: 4px 0 28px; }
  .pitch-heading h1 { font-size: clamp(28px, 5vw, 36px); font-weight: 650; letter-spacing: -.04em; line-height: 1.2; overflow-wrap: anywhere; }
  .pitch-location { display: flex; align-items: flex-start; gap: 8px; margin-top: 12px; color: var(--text-secondary); font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
  .pitch-location :global(svg) { margin-top: 2px; flex-shrink: 0; }
  .pitch-facts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .pitch-facts > span { display: inline-flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 12px; background: var(--surface); color: var(--text-secondary); font-size: 13px; }
  .times-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
  .times-heading h2 { font-size: 21px; font-weight: 650; letter-spacing: -.025em; }
  .times-heading p { margin-top: 5px; color: var(--text-muted); font-size: 13px; }
  .slot-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
  @media (min-width: 640px) { .slot-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; } }
</style>

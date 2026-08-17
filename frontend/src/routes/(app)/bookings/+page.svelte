<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { locale } from 'svelte-i18n'
  import { USE_MOCK, mockDelay } from '$lib/mock'
  import { uiState } from '$lib/stores/ui'
  import { authState } from '$lib/stores/auth'
  import {
    getMyBookings,
    cancelBooking as cancelBookingRpc,
    BookingApiError,
    type MyBooking
  } from '$lib/bookingApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'

  let bookings: MyBooking[] = []
  let filtered: MyBooking[] = []
  let loading = true
  let error: string | null = null
  let filter: 'all' | 'active' | 'completed' = 'all'

  onMount(async () => {
    await fetchBookings()
  })

  async function fetchBookings() {
    loading = true
    error = null

    if (USE_MOCK) {
      bookings = []
      filtered = []
      loading = false
      return
    }

    const currentUser = $authState.user
    if (!currentUser?.id) {
      await goto('/login')
      loading = false
      return
    }

    try {
      bookings = await getMyBookings(currentUser.id)
      applyFilter()
    } catch (fetchError) {
      const code = fetchError instanceof BookingApiError ? fetchError.code : 'unknown'
      error = bookingFailureMessage(code, $locale)
    } finally {
      loading = false
    }
  }

  function isActiveBooking(booking: MyBooking) {
    return booking.lifecycle_status === 'upcoming' || booking.lifecycle_status === 'in_progress'
  }

  function applyFilter() {
    if (filter === 'all') {
      filtered = bookings
    } else if (filter === 'active') {
      filtered = bookings.filter(isActiveBooking)
    } else {
      filtered = bookings.filter((booking) => booking.lifecycle_status === 'completed')
    }
  }

  $: if (filter) applyFilter()

  async function cancelBooking(id: string) {
    if (!confirm($_('bookings.cancel_confirm'))) return

    if (USE_MOCK) {
      await mockDelay()
      return
    }

    try {
      await cancelBookingRpc(id)
      bookings = bookings.map((booking) =>
        booking.id === id
          ? { ...booking, status: 'cancelled', lifecycle_status: 'cancelled', cancelled_at: new Date().toISOString() }
          : booking
      )
      applyFilter()
      uiState.addToast($_('common.success'), 'success')
    } catch (cancelError) {
      const code = cancelError instanceof BookingApiError ? cancelError.code : 'unknown'
      uiState.addToast(bookingFailureMessage(code, $locale), 'error')
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    const currentLocale = $locale || 'en'
    return {
      day: date.getDate(),
      month: date.toLocaleString(currentLocale, { month: 'short' }),
      weekday: date.toLocaleString(currentLocale, { weekday: 'short' }),
      time: date.toLocaleString(currentLocale, { hour: '2-digit', minute: '2-digit', hour12: false })
    }
  }

  function getStatusConfig(status: MyBooking['lifecycle_status']) {
    switch (status) {
      case 'upcoming':
        return { color: 'bg-success-light text-success border-success/20', label: $_('bookings.status_active') }
      case 'in_progress':
        return { color: 'bg-warning-light text-warning border-warning/20', label: $_('bookings.status_active') }
      case 'completed':
        return { color: 'bg-primary-light text-primary border-primary/20', label: $_('bookings.status_completed') }
      case 'cancelled':
        return { color: 'bg-danger-light text-danger border-danger/20', label: $_('bookings.status_cancelled') }
      default:
        return { color: 'bg-surface-level-2 text-text-muted border-border', label: status }
    }
  }

  const filters: Array<{ key: 'all' | 'active' | 'completed'; label: string }> = [
    { key: 'all', label: $_('bookings.filter_all') },
    { key: 'active', label: $_('bookings.filter_active') },
    { key: 'completed', label: $_('bookings.filter_completed') }
  ]

  $: activeCount = bookings.filter(isActiveBooking).length
  $: completedCount = bookings.filter((booking) => booking.lifecycle_status === 'completed').length
</script>

<div class="max-w-3xl mx-auto p-4 min-h-screen">
  <div class="mb-6">
    <h1 class="text-2xl font-medium font-serif text-text mb-1">{$_('bookings.title')}</h1>
    <p class="text-text-secondary text-sm">{$_('bookings.subtitle')}</p>
  </div>

  <div class="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
    {#each filters as option}
      <button
        on:click={() => (filter = option.key)}
        class="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[40px] {filter === option.key
          ? 'bg-primary text-white shadow-sm'
          : 'bg-surface-level-1 text-text-secondary border border-border dark:border-white/6 hover:bg-surface-level-2'}"
      >
        {option.label}
        {#if option.key === 'active'}
          <span class="ml-1.5 text-xs opacity-70">({activeCount})</span>
        {:else if option.key === 'completed'}
          <span class="ml-1.5 text-xs opacity-70">({completedCount})</span>
        {:else}
          <span class="ml-1.5 text-xs opacity-70">({bookings.length})</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="space-y-4">
      {#each Array(3) as _}
        <div class="flex gap-4 p-4 rounded-xl bg-surface animate-pulse">
          <div class="w-14 h-14 rounded-lg bg-surface-level-1 flex-shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-5 bg-surface-level-1 rounded w-1/3"></div>
            <div class="h-4 bg-surface-level-1 rounded w-2/3"></div>
            <div class="h-4 bg-surface-level-1 rounded w-1/4"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if error}
    <div class="text-center py-14 rounded-2xl bg-danger-light/30">
      <Icon name="alert-triangle" size={32} className="text-danger mx-auto mb-3" />
      <p class="text-danger font-medium">{error}</p>
      <button on:click={fetchBookings} class="mt-4 text-sm text-primary hover:underline">{$_('common.retry')}</button>
    </div>
  {:else if filtered.length === 0}
    <div class="text-center py-14 rounded-2xl border border-dashed border-border dark:border-white/6 bg-surface-level-1/50">
      <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-surface-level-2 flex items-center justify-center text-text-muted">
        <Icon name="calendar-days" size={28} />
      </div>
      <p class="text-text-secondary font-medium">{$_('bookings.no_bookings')}</p>
      <p class="text-text-muted text-sm mt-2 mb-5">{$_('bookings.go_home')}</p>
      <a href="/home"><Button variant="primary">{$_('home.browse_pitches')}</Button></a>
    </div>
  {:else}
    <div class="space-y-3">
      {#each filtered as booking (booking.id)}
        {@const date = formatDate(booking.starts_at)}
        {@const status = getStatusConfig(booking.lifecycle_status)}
        {@const endTime = new Date(booking.ends_at).toLocaleTimeString($locale || 'en', { hour: '2-digit', minute: '2-digit', hour12: false })}

        <div class="group flex gap-4 p-4 rounded-xl bg-surface border border-border dark:border-white/6 shadow-xs hover:shadow-md transition-all">
          <div class="flex-shrink-0 w-14 h-14 rounded-lg bg-primary-light flex flex-col items-center justify-center text-primary">
            <span class="text-[10px] font-semibold uppercase">{date.month}</span>
            <span class="text-lg font-bold leading-none">{date.day}</span>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="font-semibold text-text truncate flex items-center gap-1.5">
                  <Icon name="building-2" size={15} className="flex-shrink-0 text-primary" />
                  {booking.pitches?.name || $_('bookings.unknown_pitch')}
                </h3>
                <p class="text-sm text-text-muted flex items-center gap-1 mt-0.5">
                  <Icon name="map-pin" size={13} className="flex-shrink-0" />
                  <span class="truncate">{booking.pitches?.location || $_('bookings.unknown_location')}</span>
                </p>
                <p class="text-sm text-text-secondary mt-1 flex items-center gap-1">
                  <Icon name="clock" size={13} className="flex-shrink-0" />
                  {date.time} — {endTime}
                </p>
              </div>
              <span class="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border {status.color}">{status.label}</span>
            </div>
          </div>

          {#if booking.lifecycle_status === 'upcoming'}
            <div class="flex-shrink-0 self-center">
              <button
                on:click={() => cancelBooking(booking.id)}
                class="p-2.5 rounded-lg text-danger hover:bg-danger-light transition-colors"
                title={$_('bookings.cancel')}
              >
                <Icon name="x" size={18} />
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

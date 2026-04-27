<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/supabaseClient'
  import { uiState } from '$lib/stores/ui'
  import Card from '$lib/components/Card.svelte'
  import Button from '$lib/components/Button.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { locale } from 'svelte-i18n'
  import { USE_MOCK, mockBookings, mockPitches, mockDelay } from '$lib/mock'

  interface BookingWithDetails {
    id: string
    user_id: string
    pitch_id: string | null
    slot_datetime: string | null
    slot_datetime_end: string | null
    status: 'active' | 'cancelled' | 'completed'
    created_at: string
    full_name: string
    student_id: string
    email: string
    pitch_name: string
    pitch_location: string
  }

  let bookings: BookingWithDetails[] = []
  let loading = true
  let showDetailModal = false
  let selectedBooking: BookingWithDetails | null = null
  let cancelling = false

  // Filters
  let searchQuery = ''
  let pitchFilter = 'all'
  let statusFilter = 'all'
  let dateFrom = ''
  let dateTo = ''

  // Pagination
  let page = 1
  let pageSize = 20
  let total = 0

  // Pitches for dropdown
  let pitches: any[] = []

  onMount(async () => {
    await checkAdmin()
    await loadPitches()
    await loadBookings()
  })

  async function checkAdmin() {
    if (USE_MOCK) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      await goto('/login')
      return
    }
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') {
      await goto('/home')
    }
  }

  async function loadPitches() {
    if (USE_MOCK) {
      pitches = mockPitches
      return
    }
    const { data } = await supabase.from('pitches').select('id, name').order('name')
    if (data) pitches = data
  }

  async function loadBookings() {
    loading = true

    if (USE_MOCK) {
      let filtered = [...mockBookings]

      // Apply filters
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        filtered = filtered.filter(b =>
          b.full_name.toLowerCase().includes(q) ||
          b.student_id.toLowerCase().includes(q) ||
          b.email.toLowerCase().includes(q)
        )
      }

      if (pitchFilter !== 'all') {
        filtered = filtered.filter(b => b.pitch_id === pitchFilter)
      }

      if (statusFilter !== 'all') {
        filtered = filtered.filter(b => b.status === statusFilter)
      }

      total = filtered.length
      const start = (page - 1) * pageSize
      bookings = filtered.slice(start, start + pageSize) as BookingWithDetails[]
      loading = false
      return
    }

    // Build query
    let query = supabase
      .from('bookings')
      .select(`
        *,
        profiles!inner(full_name, student_id, email),
        pitches(name, location)
      `, { count: 'exact' })

    // Apply filters
    if (searchQuery) {
      query = query.or(`profiles.full_name.ilike.%${searchQuery}%,profiles.student_id.ilike.%${searchQuery}%,profiles.email.ilike.%${searchQuery}%`)
    }

    if (pitchFilter !== 'all') {
      query = query.eq('pitch_id', pitchFilter)
    }

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (dateFrom) {
      query = query.gte('slot_datetime', dateFrom)
    }

    if (dateTo) {
      query = query.lte('slot_datetime', dateTo)
    }

    const { data, error: err, count } = await query
      .order('slot_datetime', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (!err && data) {
      bookings = data.map((b: any) => ({
        id: b.id,
        user_id: b.user_id,
        pitch_id: b.pitch_id,
        slot_datetime: b.slot_datetime,
        slot_datetime_end: b.slot_datetime_end,
        status: b.status,
        created_at: b.created_at,
        full_name: b.profiles?.full_name || 'Unknown',
        student_id: b.profiles?.student_id || '-',
        email: b.profiles?.email || '-',
        pitch_name: b.pitches?.name || 'Unknown Pitch',
        pitch_location: b.pitches?.location || 'Unknown Location'
      }))
      total = count || 0
    }
    loading = false
  }

  function applyFilters() {
    page = 1
    loadBookings()
  }

  function clearFilters() {
    searchQuery = ''
    pitchFilter = 'all'
    statusFilter = 'all'
    dateFrom = ''
    dateTo = ''
    page = 1
    loadBookings()
  }

  function openDetail(booking: BookingWithDetails) {
    selectedBooking = booking
    showDetailModal = true
  }

  async function cancelBooking() {
    if (!selectedBooking) return
    cancelling = true

    try {
      if (USE_MOCK) {
        await mockDelay()
        const b = mockBookings.find(x => x.id === selectedBooking.id)
        if (b) b.status = 'cancelled'
        uiState.addToast('Booking cancelled', 'success')
        showDetailModal = false
        selectedBooking = null
        await loadBookings()
        return
      }

      const { error: err } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', selectedBooking.id)

      if (err) {
        uiState.addToast(err.message, 'error')
        return
      }

      uiState.addToast('Booking cancelled', 'success')
      showDetailModal = false
      selectedBooking = null
      await loadBookings()
    } catch (e: any) {
      uiState.addToast(e.message, 'error')
    } finally {
      cancelling = false
    }
  }

  function formatDate(datetime: string | null): string {
    if (!datetime) return '-'
    return new Date(datetime).toLocaleDateString($locale || 'en', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  function formatTime(datetime: string | null): string {
    if (!datetime) return '-'
    return new Date(datetime).toLocaleTimeString($locale || 'en', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const totalPages = Math.ceil(total / pageSize)

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'bg-success-light text-success'
      case 'completed': return 'bg-primary-light text-primary'
      case 'cancelled': return 'bg-danger-light text-danger'
      default: return 'bg-surface-level-2 text-text-muted'
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'active': return $_('admin.status_active')
      case 'completed': return $_('admin.status_completed')
      case 'cancelled': return $_('admin.status_cancelled')
      default: return status
    }
  }
</script>

<div class="max-w-6xl mx-auto p-4">
  <h1 class="text-2xl font-medium font-serif text-text mb-6">{$_('admin.bookings_title')}</h1>

  <!-- Filters -->
  <Card variant="elevated" className="mb-5 p-4">
    <div class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- User Search -->
        <div>
          <label for="search" class="block text-sm font-medium text-text-secondary mb-1">{$_('admin.filter_user')}</label>
          <input
            id="search"
            type="text"
            placeholder={$_('admin.filter_user_placeholder')}
            class="w-full rounded-lg border border-border bg-surface-level-1 p-3 text-sm text-text placeholder:text-text-muted focus:border-info focus:outline-none focus:ring-1 focus:ring-info transition-colors"
            bind:value={searchQuery}
          />
        </div>

        <!-- Pitch Filter -->
        <div>
          <label for="pitch" class="block text-sm font-medium text-text-secondary mb-1">{$_('admin.filter_pitch')}</label>
          <select
            id="pitch"
            class="w-full rounded-lg border border-border bg-surface-level-1 p-3 text-sm text-text focus:border-info focus:outline-none focus:ring-1 focus:ring-info transition-colors"
            bind:value={pitchFilter}
          >
            <option value="all">{$_('admin.filter_all_pitches')}</option>
            {#each pitches as pitch}
              <option value={pitch.id}>{pitch.name}</option>
            {/each}
          </select>
        </div>

        <!-- Status Filter -->
        <div>
          <label for="status" class="block text-sm font-medium text-text-secondary mb-1">{$_('admin.filter_status')}</label>
          <select
            id="status"
            class="w-full rounded-lg border border-border bg-surface-level-1 p-3 text-sm text-text focus:border-info focus:outline-none focus:ring-1 focus:ring-info transition-colors"
            bind:value={statusFilter}
          >
            <option value="all">{$_('admin.filter_all_statuses')}</option>
            <option value="active">{$_('admin.status_active')}</option>
            <option value="completed">{$_('admin.status_completed')}</option>
            <option value="cancelled">{$_('admin.status_cancelled')}</option>
          </select>
        </div>

        <!-- Date Range -->
        <div>
          <label for="date-from" class="block text-sm font-medium text-text-secondary mb-1">{$_('admin.filter_date_from')}</label>
          <input
            id="date-from"
            type="date"
            class="w-full rounded-lg border border-border bg-surface-level-1 p-3 text-sm text-text focus:border-info focus:outline-none focus:ring-1 focus:ring-info transition-colors"
            bind:value={dateFrom}
          />
        </div>
      </div>

      <div class="flex gap-2">
        <Button variant="primary" size="sm" on:click={applyFilters}>{$_('admin.apply_filters')}</Button>
        <Button variant="secondary" size="sm" on:click={clearFilters}>{$_('admin.clear_filters')}</Button>
      </div>
    </div>
  </Card>

  <!-- Booking Count -->
  <p class="text-sm text-text-secondary mb-4">{$_('admin.showing_bookings', { count: bookings.length })} {$_('admin.bookings_of')} {total}</p>

  <!-- Booking List -->
  {#if loading}
    <div class="space-y-4">
      <LoadingSkeleton />
      <LoadingSkeleton />
      <LoadingSkeleton />
    </div>
  {:else if bookings.length === 0}
    <Card variant="elevated" className="text-center py-12">
      <p class="text-text-secondary mb-2">{$_('admin.no_bookings')}</p>
      <p class="text-text-muted text-sm">{$_('admin.no_bookings_filter')}</p>
    </Card>
  {:else}
    <div class="space-y-3">
      {#each bookings as booking (booking.id)}
        <Card variant="elevated" className="p-4">
          <div class="flex justify-between items-start gap-4 flex-wrap">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="text-base font-semibold text-text">{booking.full_name}</h3>
                <span class="px-2 py-0.5 text-xs rounded-full {getStatusColor(booking.status)}">
                  {getStatusLabel(booking.status)}
                </span>
              </div>
              <p class="text-text-secondary text-sm mb-1">{booking.pitch_name} - {booking.pitch_location}</p>
              <p class="text-text-muted text-sm">
                {booking.student_id} | {formatDate(booking.slot_datetime)} | {formatTime(booking.slot_datetime)} - {formatTime(booking.slot_datetime_end)}
              </p>
              <p class="text-xs text-text-muted mt-1">{$_('admin.booked_on')}: {new Date(booking.created_at).toLocaleDateString($locale || 'en', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <Button variant="secondary" size="sm" on:click={() => openDetail(booking)}>{$_('admin.view_details')}</Button>
              {#if booking.status === 'active'}
                <Button variant="danger" size="sm" on:click={() => { selectedBooking = booking; if (confirm($_('admin.cancel_confirm'))) cancelBooking() }}>{$_('admin.cancel_booking')}</Button>
              {/if}
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="flex justify-center items-center gap-3 mt-6">
      <Button
        variant="secondary"
        size="sm"
        disabled={page === 1}
        on:click={() => { page--; loadBookings() }}
      >
        {$_('admin.previous')}
      </Button>
      <span class="text-sm text-text-secondary">{$_('admin.page')} {page} {$_('admin.of')} {totalPages}</span>
      <Button
        variant="secondary"
        size="sm"
        disabled={page === totalPages}
        on:click={() => { page++; loadBookings() }}
      >
        {$_('admin.next')}
      </Button>
    </div>
  {/if}
</div>

<!-- Booking Detail Modal -->
<Modal open={showDetailModal} size="lg" on:close={() => { showDetailModal = false; selectedBooking = null }}>
  <div slot="header" class="text-lg font-semibold text-text">{$_('admin.booking_details')}</div>
  <div slot="body" class="space-y-4">
    {#if selectedBooking}
      <!-- User Information -->
      <div class="bg-surface-level-1 p-4 rounded-xl space-y-2">
        <p class="text-sm font-semibold text-text">{$_('admin.user_information')}</p>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-text-muted">{$_('admin.name_label')}:</span>
          <span class="font-medium">{selectedBooking.full_name}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-text-muted">{$_('admin.email_label')}:</span>
          <span class="font-medium">{selectedBooking.email}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-text-muted">{$_('admin.student_id_label')}:</span>
          <span class="font-medium">{selectedBooking.student_id}</span>
        </div>
      </div>

      <!-- Booking Information -->
      <div class="bg-surface-level-1 p-4 rounded-xl space-y-2">
        <p class="text-sm font-semibold text-text">{$_('admin.booking_information')}</p>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-text-muted">{$_('admin.pitch_label')}:</span>
          <span class="font-medium">{selectedBooking.pitch_name}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-text-muted">{$_('admin.location_label')}:</span>
          <span class="font-medium">{selectedBooking.pitch_location}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-text-muted">{$_('admin.date_label')}:</span>
          <span class="font-medium">{formatDate(selectedBooking.slot_datetime)}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-text-muted">{$_('admin.time_label')}:</span>
          <span class="font-medium">{formatTime(selectedBooking.slot_datetime)} - {formatTime(selectedBooking.slot_datetime_end)}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-text-muted">{$_('admin.status_label')}:</span>
          <span class="px-2 py-0.5 text-xs rounded-full {getStatusColor(selectedBooking.status)}">
            {getStatusLabel(selectedBooking.status)}
          </span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-text-muted">{$_('admin.booked_on')}:</span>
          <span class="font-medium">{new Date(selectedBooking.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <!-- Actions -->
      {#if selectedBooking.status === 'active'}
        <Button
          variant="danger"
          className="w-full"
          loading={cancelling}
          on:click={() => { if (confirm($_('admin.cancel_confirm'))) cancelBooking() }}
        >
          {$_('admin.cancel_booking')}
        </Button>
      {/if}
    {/if}
  </div>
  <div slot="footer" class="flex justify-end">
    <Button variant="secondary" on:click={() => { showDetailModal = false; selectedBooking = null }}>{$_('admin.close')}</Button>
  </div>
</Modal>

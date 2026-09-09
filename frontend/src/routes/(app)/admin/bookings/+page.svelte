<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '$lib/components/Icon.svelte'
  import Button from '$lib/components/Button.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import SegmentedControl from '$lib/components/SegmentedControl.svelte'
  import { language, uiState } from '$lib/stores/ui'
  import {
    listAdminBookings,
    listAdminFacilities,
    adminCancelBooking,
    type AdminBooking,
    type AdminBookingLifecycle,
    type AdminBookingCancelReason,
    type AdminFacility
  } from '$lib/adminApi'

  const DEFAULT_FACILITY_TIMEZONE = 'Africa/Casablanca'

  let bookings: AdminBooking[] = []
  let facilities: AdminFacility[] = []
  let loading = true
  let error = ''
  let query = ''
  let pitchId = ''
  let lifecycle = ''
  let dateFrom = ''
  let dateTo = ''
  let page = 1
  const pageSize = 30
  let total = 0
  let selected: AdminBooking | null = null
  let cancelTarget: AdminBooking | null = null
  let cancelReason: AdminBookingCancelReason = 'maintenance'
  let cancelling = false

  $: ar = $language === 'ar'
  $: totalPages = Math.max(1, Math.ceil(total / pageSize))
  $: facilityTimezones = new Map(facilities.map((facility) => [facility.id, facility.timezone]))
  $: copy = ar ? {
    eyebrow: 'عمليات UNEEM', title: 'الحجوزات', subtitle: 'إدارة الحجوزات والإلغاءات.',
    search: 'بحث باسم الطالب، البريد، الرقم أو المرفق', allFacilities: 'كل المرافق', allStates: 'كل الحالات',
    upcoming: 'قادمة', progress: 'جارية', completed: 'مكتملة', cancelled: 'ملغاة', apply: 'تطبيق', clear: 'مسح',
    results: 'حجز', empty: 'لا توجد حجوزات بهذه الفلاتر.', retry: 'إعادة المحاولة', details: 'التفاصيل',
    cancel: 'إلغاء الحجز', cancelTitle: 'إلغاء هذا الحجز؟', cancelHint: 'سيتم تحرير المرفق وإغلاق المباراة المفتوحة المرتبطة إن وجدت.',
    reason: 'سبب الإلغاء', keep: 'الاحتفاظ بالحجز', confirm: 'تأكيد الإلغاء', saving: 'جارٍ الإلغاء…', student: 'الطالب', facility: 'المرفق', time: 'الوقت', booked: 'تم الحجز', previous: 'السابق', next: 'التالي'
  } : {
    eyebrow: 'UNEEM operations', title: 'Bookings', subtitle: 'Manage reservations and cancellations.',
    search: 'Search student, email, ID or facility', allFacilities: 'All facilities', allStates: 'All states',
    upcoming: 'Upcoming', progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', apply: 'Apply', clear: 'Clear',
    results: 'bookings', empty: 'No bookings match these filters.', retry: 'Retry', details: 'Details',
    cancel: 'Cancel booking', cancelTitle: 'Cancel this booking?', cancelHint: 'The facility is released and any linked open match closes automatically.',
    reason: 'Cancellation reason', keep: 'Keep booking', confirm: 'Confirm cancellation', saving: 'Cancelling…', student: 'Student', facility: 'Facility', time: 'Time', booked: 'Booked', previous: 'Previous', next: 'Next'
  }
  $: lifecycleOptions = [
    { value: '', label: copy.allStates },
    { value: 'upcoming', label: copy.upcoming },
    { value: 'in_progress', label: copy.progress },
    { value: 'completed', label: copy.completed },
    { value: 'cancelled', label: copy.cancelled }
  ]

  const cancelReasons: { value: AdminBookingCancelReason; en: string; ar: string }[] = [
    { value: 'maintenance', en: 'Facility maintenance', ar: 'صيانة المرفق' },
    { value: 'safety', en: 'Safety issue', ar: 'سبب متعلق بالسلامة' },
    { value: 'scheduling_error', en: 'Scheduling error', ar: 'خطأ في الجدولة' },
    { value: 'university_event', en: 'University event', ar: 'نشاط جامعي' },
    { value: 'policy', en: 'Policy decision', ar: 'قرار تنظيمي' },
    { value: 'other', en: 'Other operational reason', ar: 'سبب تشغيلي آخر' }
  ]

  onMount(async () => {
    try { facilities = await listAdminFacilities() } catch { facilities = [] }
    await load()
  })

  function dateBoundary(date: string, dayOffset = 0) {
    if (!date) return undefined
    const [year, month, day] = date.split('-').map(Number)
    const targetWallClock = Date.UTC(year, month - 1, day + dayOffset)
    const timeZone = facilityTimezones.get(pitchId) || DEFAULT_FACILITY_TIMEZONE
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    })

    let instant = targetWallClock
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = Object.fromEntries(
        formatter.formatToParts(new Date(instant))
          .filter((part) => part.type !== 'literal')
          .map((part) => [part.type, part.value])
      )
      const renderedWallClock = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
      )
      instant += targetWallClock - renderedWallClock
    }

    return new Date(instant).toISOString()
  }

  async function load() {
    loading = true; error = ''
    try {
      const result = await listAdminBookings({
        query,
        pitchId: pitchId || undefined,
        lifecycle: (lifecycle || undefined) as AdminBookingLifecycle | undefined,
        from: dateBoundary(dateFrom),
        to: dateBoundary(dateTo, 1),
        limit: pageSize,
        offset: (page - 1) * pageSize
      })
      bookings = result.rows
      total = result.total
    } catch (e: any) { error = e.message || 'Unable to load bookings' }
    finally { loading = false }
  }

  async function apply() { page = 1; await load() }
  async function clear() {
    query = ''; pitchId = ''; lifecycle = ''; dateFrom = ''; dateTo = ''; page = 1
    await load()
  }

  async function confirmCancel() {
    if (!cancelTarget || cancelling) return
    cancelling = true
    try {
      await adminCancelBooking(cancelTarget.booking_id, cancelReason)
      const id = cancelTarget.booking_id
      bookings = bookings.map((b) => b.booking_id === id ? { ...b, booking_status: 'cancelled', lifecycle_status: 'cancelled' } : b)
      if (lifecycle && lifecycle !== 'cancelled') {
        bookings = bookings.filter((b) => b.booking_id !== id)
        total = Math.max(0, total - 1)
      }
      if (selected?.booking_id === id) selected = { ...selected, booking_status: 'cancelled', lifecycle_status: 'cancelled' }
      cancelTarget = null
      uiState.addToast(ar ? 'تم إلغاء الحجز' : 'Booking cancelled', 'success')
    } catch (e: any) { uiState.addToast(e.message || (ar ? 'تعذر إلغاء الحجز' : 'Unable to cancel booking'), 'error') }
    finally { cancelling = false }
  }

  function when(value: string, bookingPitchId: string) {
    return new Date(value).toLocaleString(ar ? 'ar-MA' : 'en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: facilityTimezones.get(bookingPitchId) || DEFAULT_FACILITY_TIMEZONE
    })
  }

  function statusLabel(value: AdminBookingLifecycle) {
    if (value === 'upcoming') return copy.upcoming
    if (value === 'in_progress') return copy.progress
    if (value === 'completed') return copy.completed
    return copy.cancelled
  }
</script>

<svelte:head><title>{copy.title} · UNEEM Admin</title></svelte:head>

<main class="uneem-page max-w-6xl">
  <header class="mb-6">
    <h1 class="uneem-title">{copy.title}</h1>
    <p class="mt-1 text-sm leading-6 text-text-secondary">{copy.subtitle}</p>
  </header>

  <form on:submit|preventDefault={apply} class="uneem-card mb-5">
    <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <label class="lg:col-span-2">
        <span class="sr-only">{copy.search}</span>
        <input bind:value={query} class="uneem-field" placeholder={copy.search} />
      </label>
      <select bind:value={pitchId} class="uneem-field lg:col-span-2" aria-label={copy.allFacilities}>
        <option value="">{copy.allFacilities}</option>
        {#each facilities as facility}<option value={facility.id}>{facility.name}</option>{/each}
      </select>
      <div class="md:col-span-2 lg:col-span-4">
        <SegmentedControl
          options={lifecycleOptions}
          value={lifecycle}
          ariaLabel={copy.allStates}
          scrollable
          onChange={(value) => (lifecycle = value)}
        />
      </div>
      <label class="min-w-0"><span class="mb-2 block text-sm font-medium text-text-secondary">{ar ? 'من تاريخ' : 'From'}</span><input bind:value={dateFrom} type="date" class="uneem-field" /></label>
      <label class="min-w-0"><span class="mb-2 block text-sm font-medium text-text-secondary">{ar ? 'إلى تاريخ' : 'To'}</span><input bind:value={dateTo} type="date" class="uneem-field" /></label>
      <div class="flex items-end gap-3 md:col-span-2 lg:justify-end">
        <Button variant="secondary" disabled={loading} on:click={clear} className="flex-1 lg:flex-none">{copy.clear}</Button>
        <Button type="submit" loading={loading} className="flex-1 lg:min-w-36 lg:flex-none">{copy.apply}</Button>
      </div>
    </div>
  </form>

  <div class="mb-3 flex items-center justify-between gap-3">
    <p class="text-sm font-semibold text-text-secondary">{total} {copy.results}</p>
    {#if loading && bookings.length > 0}<span class="text-xs text-text-muted" role="status">{ar ? 'جارٍ التحديث…' : 'Updating…'}</span>{/if}
  </div>

  {#if error && bookings.length === 0}
    <section class="uneem-card text-center"><p class="text-sm font-semibold text-danger">{error}</p><button on:click={load} class="mt-3 min-h-10 font-bold text-primary">{copy.retry}</button></section>
  {:else if loading && bookings.length === 0}
    <div class="space-y-2" aria-busy="true">{#each [1,2,3,4] as _}<div class="h-24 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}</div>
  {:else if bookings.length === 0}
    <section class="uneem-card py-12 text-center"><Icon name="calendar-days" size={26} className="mx-auto text-text-muted"/><p class="mt-3 font-bold text-text">{copy.empty}</p></section>
  {:else}
    <div class="overflow-hidden rounded-[22px] bg-surface">
      {#each bookings as booking (booking.booking_id)}
        <button on:click={() => selected = booking} class="w-full border-b border-border-light px-4 py-4 text-start last:border-0 hover:bg-surface-level-1 sm:px-5">
          <div class="flex items-start gap-3">
            <div class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-level-1 text-sm font-semibold text-text-secondary">{booking.full_name?.charAt(0)?.toUpperCase() || '?'}</div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2"><p class="break-words font-semibold text-text">{booking.full_name}</p><span class={`rounded-lg bg-surface-level-1 px-2 py-1 text-xs font-medium ${booking.lifecycle_status === 'cancelled' ? 'text-danger' : booking.lifecycle_status === 'upcoming' ? 'text-primary' : 'text-text-secondary'}`}>{statusLabel(booking.lifecycle_status)}</span></div>
              <p class="mt-2 text-sm leading-6 text-text-secondary">{booking.pitch_name} · {when(booking.starts_at, booking.pitch_id)}</p>
              <p class="mt-1 break-words text-xs leading-5 text-text-muted">{booking.student_id || '—'} · {booking.email || '—'}</p>
            </div>
            <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} className="mt-2 shrink-0 text-text-muted" />
          </div>
        </button>
      {/each}
    </div>
  {/if}

  {#if totalPages > 1}
    <div class="mt-5 flex items-center justify-center gap-3">
      <button disabled={page === 1 || loading} on:click={async () => { page--; await load() }} class="uneem-secondary-action">{copy.previous}</button>
      <span class="text-sm font-bold text-text-secondary">{page}/{totalPages}</span>
      <button disabled={page >= totalPages || loading} on:click={async () => { page++; await load() }} class="uneem-secondary-action">{copy.next}</button>
    </div>
  {/if}
</main>

{#if selected}
  <Modal open={!cancelTarget} title={copy.details} on:close={() => { if (!cancelTarget) selected = null }}>
    <h3 class="text-xl font-semibold text-text">{selected.full_name}</h3>
    <p class="mt-1 text-sm text-text-secondary">{statusLabel(selected.lifecycle_status)}</p>
    <dl class="mt-5 space-y-4 rounded-2xl bg-surface-level-1 p-4">
      <div><dt class="text-xs font-medium text-text-muted">{copy.student}</dt><dd class="mt-1 break-words text-sm font-semibold text-text"><bdi>{selected.student_id || '—'}</bdi><br><span class="font-normal text-text-secondary">{selected.email || '—'}</span></dd></div>
      <div><dt class="text-xs font-medium text-text-muted">{copy.facility}</dt><dd class="mt-1 text-sm font-semibold text-text">{selected.pitch_name}<br><span class="font-normal text-text-secondary">{selected.pitch_location}</span></dd></div>
      <div><dt class="text-xs font-medium text-text-muted">{copy.time}</dt><dd class="mt-1 text-sm font-semibold text-text">{when(selected.starts_at, selected.pitch_id)} – {when(selected.ends_at, selected.pitch_id)}</dd></div>
    </dl>
    {#if selected.lifecycle_status === 'upcoming' || selected.lifecycle_status === 'in_progress'}
      <Button variant="secondary" fullWidth className="mt-6 !bg-danger-light !text-danger" on:click={() => { cancelTarget = selected; cancelReason = 'maintenance' }}>{copy.cancel}</Button>
    {/if}
  </Modal>
{/if}

{#if cancelTarget}
  <Modal open title={copy.cancelTitle} closeDisabled={cancelling} on:close={() => cancelTarget = null}>
    <p class="text-sm leading-6 text-text-secondary">{copy.cancelHint}</p>
    <label class="mt-5 block text-sm font-medium text-text-secondary">{copy.reason}<select bind:value={cancelReason} disabled={cancelling} class="uneem-field mt-2">{#each cancelReasons as item}<option value={item.value}>{ar ? item.ar : item.en}</option>{/each}</select></label>
    <svelte:fragment slot="footer">
      <Button variant="secondary" disabled={cancelling} on:click={() => cancelTarget = null} className="sm:flex-1">{copy.keep}</Button>
      <Button variant="danger" loading={cancelling} on:click={confirmCancel} className="sm:flex-1">{copy.confirm}</Button>
    </svelte:fragment>
  </Modal>
{/if}

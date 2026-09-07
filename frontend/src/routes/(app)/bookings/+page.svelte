<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import Icon from '$lib/components/Icon.svelte'
  import { locale } from 'svelte-i18n'
  import { authState } from '$lib/stores/auth'
  import { uiState } from '$lib/stores/ui'
  import { getMyBookings, cancelBooking as cancelBookingRpc, BookingApiError, type MyBooking } from '$lib/bookingApi'
  import { listMyMatches, createOpenMatch, MatchApiError, matchErrorCopy, type MyMatch } from '$lib/matchApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'

  let bookings: MyBooking[] = []
  let matches: MyMatch[] = []
  let loading = true
  let error: string | null = null
  let cancelTarget: MyBooking | null = null
  let openTarget: MyBooking | null = null
  let reservedSpots = 0
  let working = false

  $: ar = ($locale || 'en').startsWith('ar')
  $: copy = ar ? {
    title:'رياضتي', upcoming:'الحجوزات الجاية', book:'احجز وقت', none:'ما عندك حتى حجز جاي.', open:'افتح للاعبين', view:'شوف الماتش', cancel:'إلغاء الحجز', recent:'السابق', openMatch:'ماتش مفتوح',
    openTitle:'افتح للاعبين', friends:'صحابك معاك', openSpots:'بلايص مفتوحة للطلبة', notNow:'رجع', opening:'جاري الفتح…', openAction:'افتح',
    cancelTitle:'تلغي الحجز؟', keep:'خليه', cancelling:'جاري الإلغاء…', retry:'عاود المحاولة', cancelledToast:'تم إلغاء الحجز', openedToast:'الماتش مفتوح'
  } : {
    title:'My Sports', upcoming:'Upcoming', book:'Book a slot', none:'No upcoming bookings.', open:'Open to players', view:'View match', cancel:'Cancel booking', recent:'History', openMatch:'Open match',
    openTitle:'Open to players', friends:'Friends with you', openSpots:'Open spots for students', notNow:'Back', opening:'Opening…', openAction:'Open',
    cancelTitle:'Cancel booking?', keep:'Keep booking', cancelling:'Cancelling…', retry:'Try again', cancelledToast:'Booking cancelled', openedToast:'Match is open'
  }

  onMount(loadSports)

  function modalFocus(node: HTMLElement) {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    node.focus()
    return { destroy() { previousFocus?.focus() } }
  }

  function dismissOnEscape(event: KeyboardEvent, close: () => void) {
    if (event.key !== 'Escape' || working) return
    event.stopPropagation()
    close()
  }

  async function loadSports() {
    const user = $authState.user
    if (!user?.id) { await goto('/login'); return }
    loading = true
    error = null
    try {
      const [bookingRows, matchRows] = await Promise.all([getMyBookings(user.id), listMyMatches()])
      bookings = bookingRows
      matches = matchRows
    } catch (e) {
      error = e instanceof MatchApiError ? matchErrorCopy(e.code, $locale) : bookingFailureMessage(e instanceof BookingApiError ? e.code : 'unknown', $locale)
    } finally { loading = false }
  }

  const matchFor = (bookingId: string) => matches.find((match) => match.booking_id === bookingId)
  const upcoming = (booking: MyBooking) => booking.lifecycle_status === 'upcoming'
  $: upcomingBookings = bookings.filter((booking) => upcoming(booking) && booking.status !== 'cancelled')
  $: history = bookings.filter((booking) => !upcoming(booking) || booking.status === 'cancelled')
  $: capacity = openTarget?.pitches?.capacity ?? 1
  $: maxReservedSpots = Math.max(0, capacity - 2)
  $: openSpots = Math.max(0, capacity - 1 - reservedSpots)

  function dateParts(value: string, timezone?: string | null) {
    const d = new Date(value)
    const lang = $locale || 'en'
    const zone = timezone ? { timeZone: timezone } : {}
    return {
      day: d.toLocaleString(lang,{day:'numeric', ...zone}),
      month: d.toLocaleString(lang,{month:'short', ...zone}),
      weekday: d.toLocaleString(lang,{weekday:'short', ...zone}),
      time: d.toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit',hour12:false, ...zone})
    }
  }

  function openMatchSheet(booking: MyBooking) {
    if ((booking.pitches?.capacity ?? 1) < 2) return
    openTarget = booking
    reservedSpots = 0
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    const bookingId = cancelTarget.id
    working = true
    try {
      await cancelBookingRpc(bookingId)
      bookings = bookings.map((b) => b.id === bookingId ? {...b,status:'cancelled',lifecycle_status:'cancelled',cancelled_at:new Date().toISOString()} : b)
      matches = matches.filter((match) => match.booking_id !== bookingId)
      cancelTarget = null
      uiState.addToast(copy.cancelledToast, 'success')
    } catch (e) { uiState.addToast(bookingFailureMessage(e instanceof BookingApiError ? e.code : 'unknown', $locale), 'error') }
    finally { working = false }
  }

  async function confirmOpenMatch() {
    if (!openTarget || openSpots < 1) return
    working = true
    try {
      await createOpenMatch(openTarget.id, Math.min(reservedSpots, maxReservedSpots))
      matches = await listMyMatches()
      openTarget = null
      reservedSpots = 0
      uiState.addToast(copy.openedToast, 'success')
    } catch (e) { uiState.addToast(matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $locale), 'error') }
    finally { working = false }
  }
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>

<main class="uneem-page-narrow">
  <header class="mb-6"><h1 class="uneem-title">{copy.title}</h1></header>

  {#if loading}
    <div class="space-y-2" aria-label="Loading My Sports">{#each Array(3) as _}<div class="h-24 animate-pulse rounded-[18px] bg-surface-level-1"></div>{/each}</div>
  {:else if error}
    <div class="flex items-center justify-between gap-3 py-4">
      <p class="text-sm font-semibold text-danger">{error}</p>
      <button class="min-h-10 text-sm font-bold text-primary" on:click={loadSports}>{copy.retry}</button>
    </div>
  {:else}
    <section>
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-lg font-bold text-text">{copy.upcoming}</h2>
        {#if upcomingBookings.length > 0}<a href="/home" class="min-h-10 text-sm font-bold text-primary">{copy.book}</a>{/if}
      </div>

      {#if upcomingBookings.length === 0}
        <div class="uneem-empty py-8">
          <div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-level-1 text-text-muted"><Icon name="calendar-days" size={21}/></div>
          <p class="mt-3 font-bold text-text">{copy.none}</p>
          <a href="/home" class="uneem-primary-action mt-5 min-w-[150px]">{copy.book}</a>
        </div>
      {:else}
        <div class="space-y-2">
          {#each upcomingBookings as booking (booking.id)}
            {@const date = dateParts(booking.starts_at, booking.pitches?.timezone)}
            {@const match = matchFor(booking.id)}
            <article class="rounded-[18px] border border-border-light bg-surface p-4">
              <div class="flex items-start gap-3">
                <div class="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[14px] bg-primary-light text-primary">
                  <span class="text-[9px] font-extrabold uppercase">{date.month}</span>
                  <span class="text-lg font-extrabold leading-none">{date.day}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0"><h3 class="truncate font-bold text-text">{booking.pitches?.name || 'Facility'}</h3><p class="mt-1 text-sm text-text-muted">{date.weekday} · {date.time} · {booking.pitches?.location || 'USMBA'}</p></div>
                    {#if match}<span class="shrink-0 rounded-full bg-success-light px-2.5 py-1 text-[11px] font-bold text-success">{copy.openMatch}</span>{/if}
                  </div>
                </div>
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-border-light pt-3">
                {#if match}
                  <a href="/matches" class="uneem-secondary-action min-h-10 px-3 text-sm">{copy.view}</a>
                {:else if (booking.pitches?.capacity ?? 1) >= 2}
                  <button class="uneem-primary-action min-h-10 px-3 text-sm" on:click={() => openMatchSheet(booking)}>{copy.open}</button>
                {/if}
                <button class="min-h-10 rounded-[12px] px-3 text-sm font-bold text-danger hover:bg-danger-light" on:click={() => cancelTarget = booking}>{copy.cancel}</button>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </section>

    {#if history.length > 0}
      <section class="mt-8">
        <h2 class="mb-3 text-lg font-bold text-text">{copy.recent}</h2>
        <div class="rounded-[18px] border border-border-light bg-surface px-4">
          {#each history.slice(0,8) as booking (booking.id)}
            {@const date=dateParts(booking.starts_at, booking.pitches?.timezone)}
            <div class="uneem-list-row">
              <div class="min-w-0 flex-1"><p class="truncate font-semibold text-text">{booking.pitches?.name || 'Facility'}</p><p class="mt-0.5 text-sm text-text-muted">{date.month} {date.day} · {date.time}</p></div>
              <span class="text-xs font-semibold capitalize text-text-muted">{booking.lifecycle_status}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</main>

{#if openTarget}
  {@const openDate = dateParts(openTarget.starts_at, openTarget.pitches?.timezone)}
  <div class="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" role="presentation">
    <button type="button" tabindex="-1" aria-label="Close match dialog" class="absolute inset-0 cursor-default" disabled={working} on:click={() => openTarget = null}></button>
    <div class="uneem-mobile-sheet relative z-10" role="dialog" aria-modal="true" tabindex="-1" use:modalFocus on:keydown={(event) => dismissOnEscape(event, () => openTarget = null)}>
      <h2 class="text-xl font-bold text-text">{copy.openTitle}</h2>
      <p class="mt-1 text-sm text-text-secondary">{openTarget.pitches?.name} · {openDate.weekday} {openDate.time}</p>

      <div class="mt-5 space-y-3 rounded-[16px] bg-surface-level-1 p-4">
        <div class="flex items-center justify-between gap-4">
          <span class="text-sm font-semibold text-text-secondary">{copy.friends}</span>
          <div class="flex items-center gap-2">
            <button class="grid h-10 w-10 place-items-center rounded-[12px] bg-surface text-lg font-bold text-text disabled:opacity-35" disabled={reservedSpots === 0 || working} on:click={() => reservedSpots = Math.max(0,reservedSpots-1)} aria-label="Remove reserved friend">−</button>
            <span class="min-w-7 text-center text-lg font-extrabold text-text">{reservedSpots}</span>
            <button class="grid h-10 w-10 place-items-center rounded-[12px] bg-surface text-lg font-bold text-text disabled:opacity-35" disabled={reservedSpots >= maxReservedSpots || working} on:click={() => reservedSpots = Math.min(maxReservedSpots,reservedSpots+1)} aria-label="Add reserved friend">+</button>
          </div>
        </div>
        <div class="flex items-center justify-between gap-4 border-t border-border-light pt-3">
          <span class="text-sm font-semibold text-text-secondary">{copy.openSpots}</span>
          <span class="text-lg font-extrabold text-success">{openSpots}</span>
        </div>
      </div>

      <div class="mt-5 flex gap-3"><button class="uneem-secondary-action flex-1" disabled={working} on:click={() => openTarget=null}>{copy.notNow}</button><button class="uneem-primary-action flex-1" disabled={working || openSpots < 1} on:click={confirmOpenMatch}>{working ? copy.opening : `${copy.openAction} ${openSpots}`}</button></div>
    </div>
  </div>
{/if}

{#if cancelTarget}
  <div class="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" role="presentation">
    <button type="button" tabindex="-1" aria-label="Close cancellation dialog" class="absolute inset-0 cursor-default" disabled={working} on:click={() => cancelTarget = null}></button>
    <div class="uneem-mobile-sheet relative z-10" role="dialog" aria-modal="true" tabindex="-1" use:modalFocus on:keydown={(event) => dismissOnEscape(event, () => cancelTarget = null)}>
      <h2 class="text-xl font-bold text-text">{copy.cancelTitle}</h2>
      <div class="mt-5 flex gap-3"><button class="uneem-secondary-action flex-1" disabled={working} on:click={() => cancelTarget=null}>{copy.keep}</button><button class="flex min-h-[48px] flex-1 items-center justify-center rounded-[14px] bg-danger px-4 font-bold text-white disabled:opacity-60" disabled={working} on:click={confirmCancel}>{working ? copy.cancelling : copy.cancel}</button></div>
    </div>
  </div>
{/if}

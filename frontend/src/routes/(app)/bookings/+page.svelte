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
    title:'رياضتي', subtitle:'حجوزاتك ومبارياتك.', upcoming:'القادم', upcomingHint:'الحجوزات اللي نتا منظمها.', book:'احجز مرفق', none:'ما عندك حتى حجز.', noneHint:'اختار مرفق ملي تكون واجد تلعب.',
    open:'افتح للاعبين', view:'شوف المباراة', cancel:'إلغاء الحجز', joined:'مباريات منضم ليها', joinedHint:'مباريات من تنظيم طلبة آخرين.', find:'لقى مباراة', joinedEmpty:'أي مباراة تنضم ليها غادي تبان هنا.', recent:'السابق', private:'خاص', openMatch:'مفتوحة',
    openTitle:'تفتح هاد الحجز؟', openBody:'أي طالب مؤهل يقدر ينضم حسب الأسبقية.', reserved:'أصدقاء محجوزين', upTo:'حتى', total:'من أصل', notNow:'ماشي دابا', opening:'جاري الفتح…', openAction:'افتح المباراة',
    cancelTitle:'تلغي الحجز؟', cancelBody:'غادي يتحرر الوقت', cancelMatch:' والمباراة المفتوحة غادي تسد للجميع.', keep:'خليه', cancelling:'جاري الإلغاء…', retry:'عاود المحاولة', cancelledToast:'تم إلغاء الحجز', openedToast:'المباراة مفتوحة'
  } : {
    title:'My Sports', subtitle:'Your bookings and matches.', upcoming:'Upcoming', upcomingHint:'Bookings you organize.', book:'Book a facility', none:'No bookings yet.', noneHint:'Choose a facility when you are ready to play.',
    open:'Open to players', view:'View match', cancel:'Cancel booking', joined:'Joined matches', joinedHint:'Games organized by other students.', find:'Find matches', joinedEmpty:'Matches you join will appear here.', recent:'Recent', private:'Private', openMatch:'Open match',
    openTitle:'Open this booking?', openBody:'Eligible students can join first-come-first-served.', reserved:'Reserved friends', upTo:'Up to', total:'of', notNow:'Not now', opening:'Opening…', openAction:'Open match',
    cancelTitle:'Cancel booking?', cancelBody:'The facility slot will be released', cancelMatch:' and the open match will close for everyone.', keep:'Keep booking', cancelling:'Cancelling…', retry:'Try again', cancelledToast:'Booking cancelled', openedToast:'Match is open'
  }

  onMount(loadSports)

  function modalFocus(node: HTMLElement) {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    node.focus()

    return {
      destroy() {
        previousFocus?.focus()
      }
    }
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
  $: joinedMatches = matches.filter((match) => match.member_role === 'player')
  $: history = bookings.filter((booking) => !upcoming(booking) || booking.status === 'cancelled')
  $: maxReservedSpots = Math.max(0, (openTarget?.pitches?.capacity ?? 1) - 1)

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
    if (!openTarget) return
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
  <header class="uneem-page-header">
    <div>
      <p class="uneem-kicker">UNEEM</p>
      <h1 class="uneem-title">{copy.title}</h1>
      <p class="uneem-subtitle">{copy.subtitle}</p>
    </div>
  </header>

  {#if loading}
    <div class="space-y-3" aria-label="Loading My Sports">{#each Array(3) as _}<div class="h-28 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}</div>
  {:else if error}
    <div class="uneem-card flex items-center gap-3">
      <div class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger-light text-danger"><Icon name="alert-circle" size={19}/></div>
      <p class="min-w-0 flex-1 text-sm font-semibold text-danger">{error}</p>
      <button class="min-h-10 text-sm font-bold text-primary" on:click={loadSports}>{copy.retry}</button>
    </div>
  {:else}
    <section class="mb-8">
      <div class="mb-3 flex items-end justify-between gap-3">
        <div><h2 class="text-lg font-bold text-text">{copy.upcoming}</h2><p class="mt-0.5 text-sm text-text-muted">{copy.upcomingHint}</p></div>
        <a href="/home" class="min-h-10 text-sm font-bold text-primary">{copy.book}</a>
      </div>

      {#if upcomingBookings.length === 0}
        <div class="uneem-empty">
          <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-text-muted"><Icon name="calendar-days" size={22}/></div>
          <p class="mt-3 font-bold text-text">{copy.none}</p>
          <p class="mt-1 text-sm text-text-muted">{copy.noneHint}</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each upcomingBookings as booking (booking.id)}
            {@const date = dateParts(booking.starts_at, booking.pitches?.timezone)}
            {@const match = matchFor(booking.id)}
            <article class="uneem-card">
              <div class="flex gap-3.5">
                <div class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-light text-primary">
                  <span class="text-[10px] font-extrabold uppercase">{date.month}</span>
                  <span class="text-xl font-extrabold leading-none">{date.day}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0"><h3 class="truncate font-bold text-text">{booking.pitches?.name || 'Facility'}</h3><p class="mt-1 text-sm text-text-muted">{date.weekday} · {date.time} · {booking.pitches?.location || 'USMBA'}</p></div>
                    <span class="shrink-0 rounded-full bg-surface-level-1 px-2.5 py-1 text-[11px] font-bold text-text-secondary">{match ? (match.visibility === 'open' ? copy.openMatch : copy.private) : copy.private}</span>
                  </div>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-border-light pt-3">
                {#if !match}
                  <button class="uneem-primary-action min-h-11 px-4 text-sm" on:click={() => openMatchSheet(booking)}>{copy.open}</button>
                {:else}
                  <a href="/matches" class="uneem-secondary-action min-h-11 px-4 text-sm text-primary">{copy.view}</a>
                {/if}
                <button class="min-h-11 px-3 text-sm font-bold text-danger" on:click={() => cancelTarget = booking}>{copy.cancel}</button>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </section>

    <section class="mb-8">
      <div class="mb-3 flex items-end justify-between gap-3"><div><h2 class="text-lg font-bold text-text">{copy.joined}</h2><p class="mt-0.5 text-sm text-text-muted">{copy.joinedHint}</p></div><a href="/matches" class="min-h-10 text-sm font-bold text-primary">{copy.find}</a></div>
      {#if joinedMatches.length === 0}
        <div class="uneem-soft-card text-sm text-text-muted">{copy.joinedEmpty}</div>
      {:else}
        <div class="uneem-panel px-4">
          {#each joinedMatches as match (match.match_id)}
            {@const date=dateParts(match.starts_at, match.timezone)}
            <a href="/matches" class="uneem-list-row group">
              <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary"><Icon name="users" size={18}/></div>
              <div class="min-w-0 flex-1"><p class="truncate font-bold text-text">{match.pitch_name}</p><p class="mt-0.5 text-sm text-text-muted">{date.weekday} · {date.time} · {match.organizer_name}</p></div>
              <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} className="text-text-muted"/>
            </a>
          {/each}
        </div>
      {/if}
    </section>

    {#if history.length > 0}
      <section>
        <h2 class="mb-3 text-lg font-bold text-text">{copy.recent}</h2>
        <div class="uneem-panel px-4">
          {#each history.slice(0,6) as booking (booking.id)}
            {@const date=dateParts(booking.starts_at, booking.pitches?.timezone)}
            <div class="uneem-list-row">
              <div class="min-w-0 flex-1"><p class="truncate font-semibold text-text">{booking.pitches?.name || 'Facility'}</p><p class="mt-0.5 text-sm text-text-muted">{date.month} {date.day} · {date.time}</p></div>
              <span class="text-xs font-semibold text-text-muted">{booking.lifecycle_status}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</main>

{#if openTarget}
  <div class="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" role="presentation">
    <button type="button" tabindex="-1" aria-label="Close match dialog" class="absolute inset-0 cursor-default" disabled={working} on:click={() => openTarget = null}></button>
    <div class="uneem-mobile-sheet relative z-10" role="dialog" aria-modal="true" tabindex="-1" use:modalFocus on:keydown={(event) => dismissOnEscape(event, () => openTarget = null)}>
      <h2 class="text-xl font-bold text-text">{copy.openTitle}</h2>
      <p class="mt-2 text-sm leading-6 text-text-secondary">{copy.openBody}</p>
      <div class="mt-5 flex items-end justify-between gap-4">
        <div><span class="block text-sm font-bold text-text">{copy.reserved}</span><p class="mt-1 text-xs text-text-muted">{copy.upTo} {maxReservedSpots} {copy.total} {openTarget.pitches?.capacity || 1}.</p></div>
        <div class="flex items-center gap-2">
          <button class="grid h-12 w-12 place-items-center rounded-2xl bg-surface-level-1 text-xl font-bold text-text disabled:opacity-40" disabled={reservedSpots === 0 || working} on:click={() => reservedSpots = Math.max(0,reservedSpots-1)} aria-label="Remove reserved friend">−</button>
          <span class="min-w-10 text-center text-xl font-extrabold text-text">{reservedSpots}</span>
          <button class="grid h-12 w-12 place-items-center rounded-2xl bg-surface-level-1 text-xl font-bold text-text disabled:opacity-40" disabled={reservedSpots >= maxReservedSpots || working} on:click={() => reservedSpots = Math.min(maxReservedSpots,reservedSpots+1)} aria-label="Add reserved friend">+</button>
        </div>
      </div>
      <div class="mt-6 flex gap-3"><button class="uneem-secondary-action flex-1" disabled={working} on:click={() => openTarget=null}>{copy.notNow}</button><button class="uneem-primary-action flex-1" disabled={working} on:click={confirmOpenMatch}>{working ? copy.opening : copy.openAction}</button></div>
    </div>
  </div>
{/if}

{#if cancelTarget}
  <div class="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" role="presentation">
    <button type="button" tabindex="-1" aria-label="Close cancellation dialog" class="absolute inset-0 cursor-default" disabled={working} on:click={() => cancelTarget = null}></button>
    <div class="uneem-mobile-sheet relative z-10" role="dialog" aria-modal="true" tabindex="-1" use:modalFocus on:keydown={(event) => dismissOnEscape(event, () => cancelTarget = null)}>
      <h2 class="text-xl font-bold text-text">{copy.cancelTitle}</h2>
      <p class="mt-2 text-sm leading-6 text-text-secondary">{copy.cancelBody}{matchFor(cancelTarget.id) ? copy.cancelMatch : ''}</p>
      <div class="mt-6 flex gap-3"><button class="uneem-secondary-action flex-1" disabled={working} on:click={() => cancelTarget=null}>{copy.keep}</button><button class="flex min-h-[50px] flex-1 items-center justify-center rounded-[18px] bg-danger px-4 font-bold text-white disabled:opacity-60" disabled={working} on:click={confirmCancel}>{working ? copy.cancelling : copy.cancel}</button></div>
    </div>
  </div>
{/if}

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

  onMount(loadSports)

  async function loadSports() {
    const user = $authState.user
    if (!user?.id) { await goto('/login'); return }
    loading = true; error = null
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

  function dateParts(value: string) {
    const d = new Date(value); const lang = $locale || 'en'
    return { day: d.getDate(), month: d.toLocaleString(lang,{month:'short'}), weekday: d.toLocaleString(lang,{weekday:'short'}), time: d.toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit',hour12:false}) }
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
      cancelTarget = null; uiState.addToast('Booking cancelled', 'success')
    } catch (e) { uiState.addToast(bookingFailureMessage(e instanceof BookingApiError ? e.code : 'unknown', $locale), 'error') }
    finally { working = false }
  }

  async function confirmOpenMatch() {
    if (!openTarget) return
    working = true
    try {
      await createOpenMatch(openTarget.id, Math.min(reservedSpots, maxReservedSpots))
      matches = await listMyMatches()
      openTarget = null; reservedSpots = 0; uiState.addToast('Match is open', 'success')
    } catch (e) { uiState.addToast(matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $locale), 'error') }
    finally { working = false }
  }
</script>

<div class="mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-5 sm:px-6">
  <header class="mb-7">
    <p class="mb-1 text-sm font-medium text-primary">UNEEM</p>
    <h1 class="text-3xl font-semibold tracking-tight text-text">My Sports</h1>
    <p class="mt-2 max-w-xl text-sm leading-6 text-text-secondary">Your bookings and matches in one place.</p>
  </header>

  {#if loading}
    <div class="space-y-3" aria-label="Loading My Sports">
      {#each Array(3) as _}<div class="h-28 animate-pulse rounded-2xl bg-surface-level-1"></div>{/each}
    </div>
  {:else if error}
    <div class="rounded-2xl bg-danger-light/40 p-5">
      <p class="font-medium text-danger">{error}</p>
      <button class="mt-3 min-h-12 text-sm font-semibold text-primary" on:click={loadSports}>Try again</button>
    </div>
  {:else}
    <section class="mb-8">
      <div class="mb-3 flex items-end justify-between gap-3"><div><h2 class="text-lg font-semibold text-text">Upcoming</h2><p class="text-sm text-text-muted">Bookings you organize.</p></div><a href="/home" class="text-sm font-semibold text-primary">Book a facility</a></div>
      {#if upcomingBookings.length === 0}
        <div class="rounded-2xl bg-surface-level-1 p-6 text-center"><Icon name="calendar-days" size={26} className="mx-auto mb-3 text-text-muted"/><p class="font-medium text-text">Nothing booked yet</p><p class="mt-1 text-sm text-text-muted">Choose a facility when you are ready to play.</p></div>
      {:else}
        <div class="space-y-3">
          {#each upcomingBookings as booking (booking.id)}
            {@const date = dateParts(booking.starts_at)} {@const match = matchFor(booking.id)}
            <article class="rounded-2xl bg-surface p-4 shadow-xs ring-1 ring-border/70">
              <div class="flex gap-4"><div class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-light text-primary"><span class="text-[10px] font-bold uppercase">{date.month}</span><span class="text-xl font-bold leading-none">{date.day}</span></div><div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-2"><div><h3 class="truncate font-semibold text-text">{booking.pitches?.name || 'Facility'}</h3><p class="mt-1 text-sm text-text-muted">{date.weekday} · {date.time} · {booking.pitches?.location || 'USMBA'}</p></div><span class="rounded-full bg-surface-level-1 px-2.5 py-1 text-xs font-semibold text-text-secondary">{match ? (match.visibility === 'open' ? 'Open match' : 'Private') : 'Private'}</span></div></div></div>
              <div class="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-3">
                {#if !match}<button class="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white" on:click={() => openMatchSheet(booking)}>Open to players</button>{:else}<a href="/matches" class="inline-flex min-h-11 items-center rounded-xl bg-primary-light px-4 text-sm font-semibold text-primary">View match</a>{/if}
                <button class="min-h-11 px-3 text-sm font-medium text-danger" on:click={() => cancelTarget = booking}>Cancel booking</button>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </section>

    <section class="mb-8">
      <div class="mb-3 flex items-end justify-between"><div><h2 class="text-lg font-semibold text-text">Joined matches</h2><p class="text-sm text-text-muted">Games organized by other students.</p></div><a href="/matches" class="text-sm font-semibold text-primary">Find matches</a></div>
      {#if joinedMatches.length === 0}<div class="rounded-2xl bg-surface-level-1 p-5 text-sm text-text-muted">Matches you join will appear here.</div>{:else}<div class="space-y-2">{#each joinedMatches as match (match.match_id)}{@const date=dateParts(match.starts_at)}<a href="/matches" class="flex min-h-20 items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-border/70"><div class="flex-1"><p class="font-semibold text-text">{match.pitch_name}</p><p class="mt-1 text-sm text-text-muted">{date.weekday} · {date.time} · with {match.organizer_name}</p></div><Icon name="chevron-right" size={18} className="text-text-muted"/></a>{/each}</div>{/if}
    </section>

    {#if history.length > 0}<section><h2 class="mb-3 text-lg font-semibold text-text">Recent</h2><div class="divide-y divide-border/70 rounded-2xl bg-surface px-4 ring-1 ring-border/70">{#each history.slice(0,6) as booking (booking.id)}{@const date=dateParts(booking.starts_at)}<div class="flex items-center gap-3 py-4"><div class="flex-1"><p class="font-medium text-text">{booking.pitches?.name || 'Facility'}</p><p class="mt-1 text-sm text-text-muted">{date.month} {date.day} · {date.time}</p></div><span class="text-xs font-medium text-text-muted">{booking.lifecycle_status}</span></div>{/each}</div></section>{/if}
  {/if}
</div>

{#if openTarget}
  <div class="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center" role="presentation" on:click={() => !working && (openTarget = null)}>
    <div class="w-full rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl" role="dialog" aria-modal="true" on:click|stopPropagation>
      <h2 class="text-xl font-semibold text-text">Open this booking?</h2><p class="mt-2 text-sm leading-6 text-text-secondary">Other eligible students can join first-come-first-served. Keep spots for friends you are bringing offline.</p>
      <div class="mt-5 flex items-end justify-between gap-4"><div><label class="block text-sm font-medium text-text">Reserved friends</label><p class="mt-1 text-xs text-text-muted">Up to {maxReservedSpots} of {openTarget.pitches?.capacity || 1} total places.</p></div><div class="flex items-center gap-2"><button class="h-12 w-12 rounded-xl bg-surface-level-1 text-xl text-text disabled:opacity-40" disabled={reservedSpots === 0 || working} on:click={() => reservedSpots = Math.max(0,reservedSpots-1)} aria-label="Remove reserved friend">−</button><span class="min-w-10 text-center text-xl font-semibold text-text">{reservedSpots}</span><button class="h-12 w-12 rounded-xl bg-surface-level-1 text-xl text-text disabled:opacity-40" disabled={reservedSpots >= maxReservedSpots || working} on:click={() => reservedSpots = Math.min(maxReservedSpots,reservedSpots+1)} aria-label="Add reserved friend">+</button></div></div>
      <div class="mt-6 flex gap-3"><button class="min-h-12 flex-1 rounded-xl bg-surface-level-1 font-semibold text-text" disabled={working} on:click={() => openTarget=null}>Not now</button><button class="min-h-12 flex-1 rounded-xl bg-primary font-semibold text-white disabled:opacity-60" disabled={working} on:click={confirmOpenMatch}>{working ? 'Opening…' : 'Open match'}</button></div>
    </div>
  </div>
{/if}

{#if cancelTarget}
  <div class="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center" role="presentation" on:click={() => !working && (cancelTarget = null)}>
    <div class="w-full rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl" role="dialog" aria-modal="true" on:click|stopPropagation><h2 class="text-xl font-semibold text-text">Cancel booking?</h2><p class="mt-2 text-sm leading-6 text-text-secondary">The facility slot will be released{matchFor(cancelTarget.id) ? ' and the open match will close for everyone' : ''}. This cannot be undone.</p><div class="mt-6 flex gap-3"><button class="min-h-12 flex-1 rounded-xl bg-surface-level-1 font-semibold text-text" disabled={working} on:click={() => cancelTarget=null}>Keep booking</button><button class="min-h-12 flex-1 rounded-xl bg-danger font-semibold text-white disabled:opacity-60" disabled={working} on:click={confirmCancel}>{working ? 'Cancelling…' : 'Cancel booking'}</button></div></div>
  </div>
{/if}

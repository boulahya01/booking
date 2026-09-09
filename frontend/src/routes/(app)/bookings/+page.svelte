<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { locale } from 'svelte-i18n'
  import { authState } from '$lib/stores/auth'
  import {
    getMyBookings,
    BookingApiError,
    type MyBooking
  } from '$lib/bookingApi'
  import {
    listMyMatches,
    MatchApiError,
    matchErrorCopy,
    type MyMatch
  } from '$lib/matchApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'

  let bookings: MyBooking[] = []
  let matches: MyMatch[] = []
  let loading = true
  let error: string | null = null

  $: ar = ($locale || 'en').startsWith('ar')
  $: copy = ar ? {
    title:'رياضتي',
    book:'احجز وقتاً',
    upcoming:'القادمة',
    none:'لا توجد حجوزات قادمة.',
    open:'مفتوح',
    closed:'مغلق',
    view:'عرض',
    history:'السجل',
    cancelled:'ملغى',
    completed:'مكتمل',
    retry:'إعادة المحاولة'
  } : {
    title:'My Sports',
    book:'Book a slot',
    upcoming:'Upcoming',
    none:'No upcoming bookings.',
    open:'Open',
    closed:'Closed',
    view:'View',
    history:'History',
    cancelled:'Cancelled',
    completed:'Completed',
    retry:'Try again'
  }

  onMount(loadSports)

  async function loadSports() {
    const user = $authState.user
    if (!user?.id) {
      await goto('/login')
      return
    }

    loading = true
    error = null

    try {
      const [bookingRows, matchRows] = await Promise.all([
        getMyBookings(user.id),
        listMyMatches()
      ])
      bookings = bookingRows
      matches = matchRows
    } catch (e) {
      error = e instanceof MatchApiError
        ? matchErrorCopy(e.code, $locale)
        : bookingFailureMessage(e instanceof BookingApiError ? e.code : 'unknown', $locale)
    } finally {
      loading = false
    }
  }

  const matchFor = (bookingId: string) =>
    matches.find((match) => match.booking_id === bookingId) || null

  const upcoming = (booking: MyBooking) =>
    (booking.lifecycle_status === 'upcoming' || booking.lifecycle_status === 'in_progress') && booking.status === 'scheduled'

  $: upcomingBookings = bookings.filter(upcoming)
  $: history = bookings.filter((booking) => !upcoming(booking))

  function timeText(value: string, timezone?: string | null) {
    return new Date(value).toLocaleTimeString($locale || 'en', {
      hour:'2-digit',
      minute:'2-digit',
      hour12:false,
      ...(timezone ? { timeZone: timezone } : {})
    })
  }

  function dateText(value: string, timezone?: string | null) {
    return new Date(value).toLocaleDateString($locale || 'en', {
      month:'short',
      day:'numeric',
      weekday:'short',
      ...(timezone ? { timeZone: timezone } : {})
    })
  }
</script>

<svelte:head>
  <title>{copy.title} · UNEEM</title>
</svelte:head>

<main class="uneem-page-narrow">
  <header class="mb-5">
    <h1 class="uneem-title">{copy.title}</h1>
  </header>

  <ActionLink href="/home" fullWidth size="lg" className="mb-7">
    <Icon name="calendar-plus" size={19}/>
    {copy.book}
  </ActionLink>

  {#if loading}
    <div class="space-y-2" aria-busy="true">
      {#each [1,2,3] as _}
        <div class="h-28 animate-pulse rounded-[18px] bg-surface-level-1"></div>
      {/each}
    </div>
  {:else if error}
    <div class="flex items-center justify-between gap-3 py-4">
      <p class="text-sm font-semibold text-danger">{error}</p>
      <button class="min-h-10 text-sm font-bold text-primary" on:click={loadSports}>
        {copy.retry}
      </button>
    </div>
  {:else}
    <section>
      <h2 class="mb-3 text-lg font-bold text-text">{copy.upcoming}</h2>

      {#if upcomingBookings.length === 0}
        <div class="uneem-empty py-8">
          <p class="font-bold text-text">{copy.none}</p>
        </div>
      {:else}
        <div class="space-y-2">
          {#each upcomingBookings as booking (booking.id)}
            {@const match = matchFor(booking.id)}
            {@const zone = booking.pitches?.timezone}
            {@const isOpen = match?.visibility === 'open'}
            {@const used = match
              ? Math.min(match.capacity, 1 + match.reserved_spots + match.joined_count)
              : 1}

            <article class="flex flex-col gap-5 rounded-[22px] bg-surface p-5">
              <div class="min-w-0 flex-1">
                <p class="flex items-baseline gap-1.5">
                  <span class="text-[26px] font-extrabold tracking-[-0.04em] text-text">
                    {timeText(booking.starts_at, zone)}
                  </span>
                  <span class="text-sm font-semibold text-text-muted">
                    – {timeText(booking.ends_at, zone)}
                  </span>
                </p>
                <h3 class="mt-2 break-words font-bold text-text">
                  {booking.pitches?.name || 'Facility'}
                </h3>
                <p class="mt-1 break-words text-sm text-text-muted">
                  {dateText(booking.starts_at, zone)}
                  {#if booking.pitches?.location} · {booking.pitches.location}{/if}
                </p>
                {#if match}
                  <p class={`mt-1 text-xs font-bold ${isOpen ? 'text-success' : 'text-text-muted'}`}>
                    {isOpen ? copy.open : copy.closed}
                    {#if isOpen} · {used}/{match.capacity}{/if}
                  </p>
                {:else}
                  <p class="mt-1 text-xs font-bold text-text-muted">{copy.closed}</p>
                {/if}
              </div>

              <a
                href={`/bookings/${booking.id}`}
                class="uneem-secondary-action w-full"
              >
                {copy.view}
              </a>
            </article>
          {/each}
        </div>
      {/if}
    </section>

    {#if history.length > 0}
      <section class="mt-8">
        <h2 class="mb-3 text-lg font-bold text-text">{copy.history}</h2>
        <div class="overflow-hidden rounded-[22px] bg-surface px-4">
          {#each history as booking (booking.id)}
            <div class="uneem-list-row">
              <div class="min-w-0 flex-1">
                <p class="break-words font-semibold text-text">
                  {booking.pitches?.name || 'Facility'}
                </p>
                <p class="mt-0.5 text-sm text-text-muted">
                  {dateText(booking.starts_at, booking.pitches?.timezone)}
                  · {timeText(booking.starts_at, booking.pitches?.timezone)}
                </p>
              </div>
              <span class="text-xs font-semibold text-text-muted">
                {booking.status === 'cancelled' ? copy.cancelled : copy.completed}
              </span>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</main>

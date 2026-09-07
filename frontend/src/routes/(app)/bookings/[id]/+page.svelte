<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { locale } from 'svelte-i18n'
  import { uiState } from '$lib/stores/ui'
  import {
    getBookingDetails,
    listBookingRoster,
    cancelBooking,
    BookingApiError,
    type BookingDetails,
    type BookingRosterEntry
  } from '$lib/bookingApi'
  import {
    createOpenMatch,
    setMatchVisibility,
    joinOpenMatch,
    leaveOpenMatch,
    addMatchReservation,
    removeMatchReservation,
    MatchApiError,
    matchErrorCopy
  } from '$lib/matchApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'

  let details: BookingDetails | null = null
  let roster: BookingRosterEntry[] = []
  let loading = true
  let error = ''
  let busy: 'visibility' | 'join' | 'leave' | 'friend' | 'cancel' | null = null
  let friendInput = ''

  $: bookingId = $page.params.id || ''
  $: ar = ($locale || 'en').startsWith('ar')
  $: isOwner = Boolean(details?.booked_by_me)
  $: isOpen = Boolean(details?.match_open)
  $: started = Boolean(details?.starts_at && new Date(details.starts_at).getTime() <= Date.now())
  $: usedSpots = details
    ? Math.min(details.capacity, 1 + details.reserved_spots + details.joined_count)
    : 0
  $: canJoin = Boolean(
    details?.match_id
      && isOpen
      && !isOwner
      && !details.participant_by_me
      && !details.reserved_by_me
      && details.spots_left > 0
      && !started
  )
  $: canAddFriend = Boolean(
    isOwner
      && details?.match_id
      && isOpen
      && !started
      && details.spots_left > 0
  )

  $: copy = ar ? {
    back:'الأوقات',
    title:'تفاصيل الحجز',
    bookedBy:'محجوز بواسطة',
    open:'مفتوح',
    closed:'مغلق',
    openToPlayers:'مفتوح للاعبين',
    openSpots:'أماكن متاحة',
    players:'اللاعبون',
    host:'المنظم',
    reserved:'محجوز',
    registered:'مسجل',
    guest:'ضيف',
    addPlaceholder:'@اسم_المستخدم أو اسم الضيف',
    add:'إضافة',
    join:'انضم',
    leave:'مغادرة',
    yourSpot:'مكانك محجوز',
    cancel:'إلغاء الحجز',
    cancelConfirm:'هل تريد إلغاء هذا الحجز؟',
    cancelled:'تم إلغاء الحجز',
    opened:'تم فتح الحجز للاعبين',
    closedToast:'تم إغلاق الحجز أمام لاعبين جدد',
    retry:'إعادة المحاولة',
    notFound:'هذا الحجز غير متاح.'
  } : {
    back:'Times',
    title:'Booking details',
    bookedBy:'Booked by',
    open:'Open',
    closed:'Closed',
    openToPlayers:'Open to players',
    openSpots:'Open spots',
    players:'Players',
    host:'Host',
    reserved:'Reserved',
    registered:'Registered',
    guest:'Guest',
    addPlaceholder:'@username or guest name',
    add:'Add',
    join:'Join match',
    leave:'Leave match',
    yourSpot:'Your spot is reserved',
    cancel:'Cancel booking',
    cancelConfirm:'Cancel this booking?',
    cancelled:'Booking cancelled',
    opened:'Booking is open to players',
    closedToast:'Booking closed to new players',
    retry:'Retry',
    notFound:'This booking is not available.'
  }

  onMount(() => {
    void load()
  })

  async function load(silent = false) {
    if (!silent) loading = true
    error = ''

    try {
      const next = await getBookingDetails(bookingId)
      if (!next) {
        details = null
        roster = []
        error = copy.notFound
        return
      }

      details = next
      roster = await listBookingRoster(bookingId)
    } catch (e) {
      details = null
      roster = []
      error = e instanceof MatchApiError
        ? matchErrorCopy(e.code, $locale)
        : bookingFailureMessage(e instanceof BookingApiError ? e.code : 'unknown', $locale)
    } finally {
      if (!silent) loading = false
    }
  }

  async function toggleOpen() {
    if (!details || !isOwner || busy || started || details.capacity < 2) return
    busy = 'visibility'

    try {
      if (!details.match_id) {
        await createOpenMatch(details.booking_id, 0)
        uiState.addToast(copy.opened, 'success')
      } else {
        await setMatchVisibility(details.match_id, isOpen ? 'private' : 'open')
        uiState.addToast(isOpen ? copy.closedToast : copy.opened, 'success')
      }
      await load(true)
    } catch (e) {
      uiState.addToast(
        matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $locale),
        'error'
      )
    } finally {
      busy = null
    }
  }

  async function join() {
    if (!details?.match_id || !canJoin || busy) return
    busy = 'join'
    try {
      await joinOpenMatch(details.match_id)
      uiState.addToast(ar ? 'تم الانضمام' : "You're in!", 'success')
      await load(true)
    } catch (e) {
      uiState.addToast(
        matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $locale),
        'error'
      )
    } finally {
      busy = null
    }
  }

  async function leave() {
    if (!details?.match_id || !details.participant_by_me || busy || started) return
    busy = 'leave'
    try {
      await leaveOpenMatch(details.match_id)
      uiState.addToast(ar ? 'غادرت المباراة' : 'You left the match.', 'success')
      await load(true)
    } catch (e) {
      uiState.addToast(
        matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $locale),
        'error'
      )
    } finally {
      busy = null
    }
  }

  async function addFriend() {
    const value = friendInput.trim()
    if (!details?.match_id || !canAddFriend || !value || busy) return
    busy = 'friend'

    try {
      await addMatchReservation(details.match_id, value)
      friendInput = ''
      await load(true)
    } catch (e) {
      uiState.addToast(
        matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $locale),
        'error'
      )
    } finally {
      busy = null
    }
  }

  async function removeFriend(entry: BookingRosterEntry) {
    if (!details?.match_id || !entry.reservation_id || !isOwner || busy || started) return
    busy = 'friend'

    try {
      await removeMatchReservation(details.match_id, entry.reservation_id)
      await load(true)
    } catch (e) {
      uiState.addToast(
        matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $locale),
        'error'
      )
    } finally {
      busy = null
    }
  }

  async function cancelMine() {
    if (!details || !isOwner || busy || started) return
    if (typeof window !== 'undefined' && !window.confirm(copy.cancelConfirm)) return

    busy = 'cancel'
    try {
      await cancelBooking(details.booking_id)
      uiState.addToast(copy.cancelled, 'success')
      await goto(`/pitch/${details.pitch_id}`)
    } catch (e) {
      uiState.addToast(
        bookingFailureMessage(e instanceof BookingApiError ? e.code : 'unknown', $locale),
        'error'
      )
    } finally {
      busy = null
    }
  }

  function dateText(value: string) {
    if (!details) return ''
    return new Date(value).toLocaleDateString(ar ? 'ar-MA' : 'en', {
      weekday:'long',
      month:'short',
      day:'numeric',
      timeZone: details.timezone
    })
  }

  function timeText(value: string) {
    if (!details) return ''
    return new Date(value).toLocaleTimeString(ar ? 'ar-MA' : 'en', {
      hour:'2-digit',
      minute:'2-digit',
      hour12:false,
      timeZone: details.timezone
    })
  }
</script>

<svelte:head>
  <title>{details?.pitch_name || copy.title} · UNEEM</title>
</svelte:head>

<main class="uneem-page-narrow">
  {#if loading}
    <div class="space-y-3" aria-busy="true">
      <div class="h-9 w-28 animate-pulse rounded-xl bg-surface-level-1"></div>
      <div class="h-36 animate-pulse rounded-[18px] bg-surface-level-1"></div>
      <div class="h-24 animate-pulse rounded-[18px] bg-surface-level-1"></div>
      <div class="h-48 animate-pulse rounded-[18px] bg-surface-level-1"></div>
    </div>
  {:else if error || !details}
    <section class="uneem-empty py-10">
      <p class="font-bold text-text">{error || copy.notFound}</p>
      <button on:click={() => load()} class="mt-3 min-h-10 text-sm font-bold text-primary">
        {copy.retry}
      </button>
    </section>
  {:else}
    <a href={`/pitch/${details.pitch_id}`} class="uneem-text-action mb-5">
      <Icon name={ar ? 'arrow-right' : 'arrow-left'} size={17}/>
      {copy.back}
    </a>

    <header class="mb-4">
      <h1 class="uneem-title">{copy.title}</h1>
    </header>

    <section class="overflow-hidden rounded-[18px] border border-border-light bg-surface">
      <div class="flex items-start justify-between gap-4 p-4">
        <div class="min-w-0">
          <h2 class="truncate text-xl font-extrabold text-text">{details.pitch_name}</h2>
          <p class="mt-2 flex items-baseline gap-1.5">
            <span class="text-[28px] font-extrabold tracking-[-0.04em] text-text">
              {timeText(details.starts_at)}
            </span>
            <span class="text-sm font-semibold text-text-muted">
              – {timeText(details.ends_at)}
            </span>
          </p>
          <p class="mt-1 text-sm text-text-muted">{dateText(details.starts_at)}</p>
          <p class="mt-2 flex items-center gap-1.5 text-sm text-text-muted">
            <Icon name="map-pin" size={14}/>
            {details.location}
          </p>
          <p class="mt-2 text-sm text-text-secondary">
            {copy.bookedBy}
            <span class="font-bold text-text">@{details.booker_username}</span>
          </p>
        </div>

        <span class={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${isOpen ? 'bg-success-light text-success' : 'bg-surface-level-1 text-text-secondary'}`}>
          {isOpen ? copy.open : copy.closed}
        </span>
      </div>
    </section>

    {#if isOwner && !started && details.capacity >= 2}
      <section class="mt-3 rounded-[16px] border border-border-light bg-surface p-4">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="font-bold text-text">{copy.openToPlayers}</p>
            {#if isOpen}
              <p class="mt-1 text-xs font-semibold text-text-muted">
                {details.spots_left} {copy.openSpots}
              </p>
            {/if}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isOpen}
            aria-label={copy.openToPlayers}
            disabled={busy !== null}
            on:click={toggleOpen}
            class={`relative h-8 w-14 rounded-full transition-colors disabled:opacity-50 ${isOpen ? 'bg-success' : 'bg-surface-level-2'}`}
          >
            <span class={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${isOpen ? 'translate-x-7 rtl:-translate-x-7' : 'translate-x-1 rtl:-translate-x-1'}`}></span>
          </button>
        </div>
      </section>
    {/if}

    {#if details.match_id && (isOpen || isOwner)}
      <section class="mt-3 grid grid-cols-2 gap-2">
        <div class="rounded-[16px] bg-surface-level-1 p-4">
          <p class="text-xs font-semibold text-text-muted">{copy.players}</p>
          <p class="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-text">
            {usedSpots}<span class="text-base text-text-muted">/{details.capacity}</span>
          </p>
        </div>
        <div class="rounded-[16px] bg-surface-level-1 p-4">
          <p class="text-xs font-semibold text-text-muted">{copy.openSpots}</p>
          <p class="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-text">
            {isOpen ? details.spots_left : 0}
          </p>
        </div>
      </section>

      <section class="mt-5">
        <h2 class="mb-2 text-lg font-bold text-text">{copy.players}</h2>
        <div class="overflow-hidden rounded-[16px] border border-border-light bg-surface px-4">
          {#each roster as member (member.entry_id)}
            <div class="uneem-list-row min-h-[56px] py-2">
              <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-level-1 text-xs font-bold text-text-secondary">
                {member.display_name?.trim()?.[0]?.toUpperCase() || 'U'}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-text">
                  {member.username ? `@${member.username}` : member.display_name}
                </p>
                {#if member.source === 'guest'}
                  <p class="text-xs text-text-muted">{copy.guest}</p>
                {:else if member.member_role === 'reserved'}
                  <p class="text-xs text-text-muted">{copy.registered}</p>
                {/if}
              </div>

              {#if member.member_role === 'organizer'}
                <span class="text-xs font-bold text-primary">{copy.host}</span>
              {:else if member.member_role === 'reserved'}
                <span class="text-xs font-bold text-text-muted">{copy.reserved}</span>
              {/if}

              {#if isOwner && member.reservation_id && !started}
                <button
                  type="button"
                  disabled={busy !== null}
                  on:click={() => removeFriend(member)}
                  class="grid h-9 w-9 place-items-center rounded-full text-text-muted hover:bg-surface-level-1 hover:text-danger disabled:opacity-40"
                  aria-label="Remove reserved player"
                >
                  <Icon name="x" size={16}/>
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </section>

      {#if canAddFriend}
        <form class="mt-3 flex gap-2" on:submit|preventDefault={addFriend}>
          <input
            bind:value={friendInput}
            disabled={busy !== null}
            maxlength="80"
            autocomplete="off"
            placeholder={copy.addPlaceholder}
            class="min-h-[46px] min-w-0 flex-1 rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary"
          />
          <Button
            type="submit"
            disabled={!friendInput.trim() || busy !== null}
            loading={busy === 'friend'}
          >
            {copy.add}
          </Button>
        </form>
      {/if}
    {/if}

    {#if !isOwner && !started}
      <div class="mt-5">
        {#if details.reserved_by_me}
          <div class="rounded-[14px] bg-success-light px-4 py-3 text-center text-sm font-bold text-success">
            {copy.yourSpot}
          </div>
        {:else if details.participant_by_me}
          <Button variant="secondary" className="w-full" loading={busy === 'leave'} on:click={leave}>
            {copy.leave}
          </Button>
        {:else if isOpen}
          <Button className="w-full" disabled={!canJoin} loading={busy === 'join'} on:click={join}>
            {copy.join}
          </Button>
        {/if}
      </div>
    {/if}

    {#if isOwner && !started}
      <button
        type="button"
        disabled={busy !== null}
        on:click={cancelMine}
        class="mt-7 min-h-11 w-full rounded-[14px] text-sm font-bold text-danger hover:bg-danger-light disabled:opacity-40"
      >
        {copy.cancel}
      </button>
    {/if}
  {/if}
</main>

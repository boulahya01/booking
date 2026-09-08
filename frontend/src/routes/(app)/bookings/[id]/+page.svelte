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
    searchUsernames,
    MatchApiError,
    matchErrorCopy,
    type UsernameSuggestion
  } from '$lib/matchApi'
  import { bookingFailureMessage } from '$lib/ux/bookingFailure'

  let details: BookingDetails | null = null
  let roster: BookingRosterEntry[] = []
  let loading = true
  let error = ''
  let busy: 'visibility' | 'join' | 'leave' | 'friend' | 'cancel' | null = null
  let friendInput = ''
  let suggestions: UsernameSuggestion[] = []
  let selectedSuggestion: UsernameSuggestion | null = null
  let suggestionOpen = false
  let suggestionIndex = -1
  let searchingUsers = false
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let searchSequence = 0

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
    return () => {
      if (searchTimer) clearTimeout(searchTimer)
      searchSequence += 1
    }
  })

  async function load(silent = false, force = false) {
    if (!silent) loading = true
    if (!silent) error = ''

    try {
      const [next, nextRoster] = await Promise.all([
        getBookingDetails(bookingId, force),
        listBookingRoster(bookingId, force)
      ])

      if (!next) {
        if (!silent) {
          details = null
          roster = []
          error = copy.notFound
        }
        return
      }

      details = next
      roster = nextRoster
    } catch (e) {
      if (!silent) {
        details = null
        roster = []
        error = e instanceof MatchApiError
          ? matchErrorCopy(e.code, $locale)
          : bookingFailureMessage(e instanceof BookingApiError ? e.code : 'unknown', $locale)
      }
    } finally {
      if (!silent) loading = false
    }
  }

  function refreshSilently() {
    void load(true, true)
  }

  function queueUsernameSearch(value: string) {
    if (searchTimer) clearTimeout(searchTimer)
    searchSequence += 1
    const sequence = searchSequence
    const trimmed = value.trim()
    const query = trimmed.startsWith('@') ? trimmed.slice(1) : ''

    selectedSuggestion = null
    suggestionIndex = -1

    if (!canAddFriend || query.length < 2) {
      searchingUsers = false
      suggestions = []
      suggestionOpen = false
      return
    }

    searchingUsers = true
    suggestionOpen = true
    searchTimer = setTimeout(async () => {
      try {
        const next = await searchUsernames(query, 5)
        if (sequence !== searchSequence) return
        suggestions = next
        suggestionOpen = next.length > 0
      } catch {
        if (sequence !== searchSequence) return
        suggestions = []
        suggestionOpen = false
      } finally {
        if (sequence === searchSequence) searchingUsers = false
      }
    }, 150)
  }

  function handleFriendInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    friendInput = input.value
    queueUsernameSearch(friendInput)
  }

  function chooseSuggestion(suggestion: UsernameSuggestion) {
    selectedSuggestion = suggestion
    friendInput = `@${suggestion.username}`
    suggestions = []
    suggestionOpen = false
    suggestionIndex = -1
  }

  function handleFriendKeydown(event: KeyboardEvent) {
    if (!suggestionOpen || suggestions.length === 0) {
      if (event.key === 'Escape') suggestionOpen = false
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      suggestionIndex = (suggestionIndex + 1) % suggestions.length
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      suggestionIndex = suggestionIndex <= 0 ? suggestions.length - 1 : suggestionIndex - 1
    } else if (event.key === 'Enter' && suggestionIndex >= 0) {
      event.preventDefault()
      chooseSuggestion(suggestions[suggestionIndex])
    } else if (event.key === 'Escape') {
      suggestionOpen = false
    }
  }

  async function toggleOpen() {
    if (!details || !isOwner || busy || started || details.capacity < 2) return
    busy = 'visibility'

    try {
      if (!details.match_id) {
        const match = await createOpenMatch(details.booking_id, 0)
        details = {
          ...details,
          match_id: match.id,
          match_visibility: 'open',
          match_open: true,
          spots_left: Math.max(details.capacity - 1 - details.reserved_spots - details.joined_count, 0)
        }
        uiState.addToast(copy.opened, 'success')
      } else {
        const nextOpen = !isOpen
        await setMatchVisibility(details.match_id, nextOpen ? 'open' : 'private')
        details = {
          ...details,
          match_visibility: nextOpen ? 'open' : 'private',
          match_open: nextOpen,
          spots_left: nextOpen
            ? Math.max(details.capacity - 1 - details.reserved_spots - details.joined_count, 0)
            : 0
        }
        uiState.addToast(nextOpen ? copy.opened : copy.closedToast, 'success')
      }
      refreshSilently()
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
      details = {
        ...details,
        participant_by_me: true,
        joined_count: details.joined_count + 1,
        spots_left: Math.max(details.spots_left - 1, 0)
      }
      uiState.addToast(ar ? 'تم الانضمام' : "You're in!", 'success')
      refreshSilently()
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
      details = {
        ...details,
        participant_by_me: false,
        joined_count: Math.max(details.joined_count - 1, 0),
        spots_left: Math.min(details.spots_left + 1, Math.max(details.capacity - 1, 0))
      }
      uiState.addToast(ar ? 'غادرت المباراة' : 'You left the match.', 'success')
      refreshSilently()
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
      const reservation = await addMatchReservation(details.match_id, value)
      const isUsername = value.startsWith('@')
      const username = isUsername ? value.slice(1) : null
      const picked = isUsername && selectedSuggestion?.username.toLowerCase() === username?.toLowerCase()
        ? selectedSuggestion
        : null

      roster = [
        ...roster,
        {
          entry_id: `reservation:${reservation.id}`,
          reservation_id: reservation.id,
          user_id: reservation.profile_id || picked?.user_id || null,
          display_name: picked?.full_name || (username || value),
          username,
          member_role: 'reserved',
          source: isUsername ? 'registered' : 'guest',
          joined_at: reservation.created_at
        }
      ]
      details = {
        ...details,
        reserved_spots: details.reserved_spots + 1,
        spots_left: Math.max(details.spots_left - 1, 0)
      }
      friendInput = ''
      selectedSuggestion = null
      suggestions = []
      suggestionOpen = false
      refreshSilently()
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
      roster = roster.filter((member) => member.entry_id !== entry.entry_id)
      details = {
        ...details,
        reserved_spots: Math.max(details.reserved_spots - 1, 0),
        spots_left: isOpen ? Math.min(details.spots_left + 1, Math.max(details.capacity - 1, 0)) : 0
      }
      refreshSilently()
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
            <span class="text-[28px] font-extrabold tracking-[-0.04em] text-text">{timeText(details.starts_at)}</span>
            <span class="text-sm font-semibold text-text-muted">– {timeText(details.ends_at)}</span>
          </p>
          <p class="mt-1 text-sm text-text-muted">{dateText(details.starts_at)}</p>
          <p class="mt-2 flex items-center gap-1.5 text-sm text-text-muted">
            <Icon name="map-pin" size={14}/>
            {details.location}
          </p>
          <p class="mt-2 text-sm text-text-secondary">
            {copy.bookedBy} <span class="font-bold text-text">@{details.booker_username}</span>
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
            {#if isOpen}<p class="mt-1 text-xs font-semibold text-text-muted">{details.spots_left} {copy.openSpots}</p>{/if}
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
          <p class="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-text">{usedSpots}<span class="text-base text-text-muted">/{details.capacity}</span></p>
        </div>
        <div class="rounded-[16px] bg-surface-level-1 p-4">
          <p class="text-xs font-semibold text-text-muted">{copy.openSpots}</p>
          <p class="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-text">{isOpen ? details.spots_left : 0}</p>
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
                <p class="truncate text-sm font-semibold text-text">{member.username ? `@${member.username}` : member.display_name}</p>
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
          <div class="relative min-w-0 flex-1">
            <input
              value={friendInput}
              on:input={handleFriendInput}
              on:keydown={handleFriendKeydown}
              on:focus={() => queueUsernameSearch(friendInput)}
              on:blur={() => setTimeout(() => suggestionOpen = false, 120)}
              disabled={busy !== null}
              maxlength="80"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              placeholder={copy.addPlaceholder}
              aria-autocomplete="list"
              aria-expanded={suggestionOpen}
              class="min-h-[46px] w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary"
            />
            {#if suggestionOpen && suggestions.length > 0}
              <div class="absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[14px] border border-border-light bg-surface-raised p-1.5 shadow-lg" role="listbox">
                {#each suggestions as suggestion, index (suggestion.user_id)}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === suggestionIndex}
                    on:mousedown|preventDefault
                    on:click={() => chooseSuggestion(suggestion)}
                    class={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] px-3 text-start ${index === suggestionIndex ? 'bg-surface-level-1' : 'hover:bg-surface-level-1'}`}
                  >
                    <span class="truncate text-sm font-bold text-text">@{suggestion.username}</span>
                    {#if suggestion.full_name}<span class="truncate text-xs text-text-muted">{suggestion.full_name}</span>{/if}
                  </button>
                {/each}
              </div>
            {:else if searchingUsers}
              <span class="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-border border-t-primary"></span>
            {/if}
          </div>
          <Button type="submit" disabled={!friendInput.trim() || busy !== null} loading={busy === 'friend'}>{copy.add}</Button>
        </form>
      {/if}
    {/if}

    {#if !isOwner && !started}
      <div class="mt-5">
        {#if details.reserved_by_me}
          <div class="rounded-[14px] bg-success-light px-4 py-3 text-center text-sm font-bold text-success">{copy.yourSpot}</div>
        {:else if details.participant_by_me}
          <Button variant="secondary" className="w-full" loading={busy === 'leave'} on:click={leave}>{copy.leave}</Button>
        {:else if isOpen}
          <Button className="w-full" disabled={!canJoin} loading={busy === 'join'} on:click={join}>{copy.join}</Button>
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

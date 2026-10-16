<script lang="ts">
  import { hasFullAccess } from '$lib/stores/auth'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import Modal from '$lib/components/Modal.svelte'
  import Toggle from '$lib/components/Toggle.svelte'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import ShareMatch from '$lib/components/ShareMatch.svelte'
  import SegmentedControl from '$lib/components/SegmentedControl.svelte'
  import LoadingShape from '$lib/components/LoadingShape.svelte'
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
  let cancelDialogOpen = false
  let friendFormOpen = false
  let visibilityBlocked = false
  let cancellationBlocked = false
  let friendInput = ''
  let friendMode = 'registered'
  let searchError = false
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
    $hasFullAccess && details?.match_id
      && isOpen
      && !isOwner
      && !details.participant_by_me
      && !details.reserved_by_me
      && details.spots_left > 0
      && !started
  )
  $: canAddFriend = Boolean(
    $hasFullAccess && isOwner
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
    const query = friendMode === 'registered' ? trimmed.replace(/^@+/, '') : ''

    selectedSuggestion = null
    suggestionIndex = -1
    searchError = false

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
        suggestionOpen = true
      } catch {
        if (sequence !== searchSequence) return
        suggestions = []
        suggestionOpen = true
        searchError = true
      } finally {
        if (sequence === searchSequence) searchingUsers = false
      }
    }, 150)
  }

  function changeFriendMode(value: string) {
    friendMode = value
    friendInput = ''
    queueUsernameSearch('')
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
    if (!$hasFullAccess || !details || !isOwner || busy || started || details.capacity < 2) return
    visibilityBlocked = false
    if (isOpen && details.joined_count > 0) {
      visibilityBlocked = true
      return
    }
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
    if (!$hasFullAccess || !details?.match_id || !canJoin || busy) return
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
    if (!$hasFullAccess || !details?.match_id || !details.participant_by_me || busy || started) return
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
    if (friendMode === 'registered' && !selectedSuggestion) return
    const value = friendMode === 'registered' ? `@${selectedSuggestion!.username}` : friendInput.trim()
    if (!$hasFullAccess || !details?.match_id || !canAddFriend || !value || busy) return
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
    if (!$hasFullAccess || !details?.match_id || !entry.reservation_id || !isOwner || busy || started) return
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

  function requestCancellation() {
    if (!details || busy) return
    cancellationBlocked = details.joined_count > 0
    if (!cancellationBlocked) cancelDialogOpen = true
  }

  async function cancelMine() {
    if (!$hasFullAccess || !details || !isOwner || busy || started) return
    if (details.joined_count > 0) {
      cancellationBlocked = true
      cancelDialogOpen = false
      return
    }
    busy = 'cancel'
    try {
      await cancelBooking(details.booking_id)
      uiState.addToast(copy.cancelled, 'success')
      await goto(`/pitch/${details.pitch_id}`)
    } catch (e) {
      if (e instanceof BookingApiError && e.code === 'match_has_public_players') {
        cancellationBlocked = true
        cancelDialogOpen = false
        return
      }
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

<main class="uneem-page-narrow match-page">
  {#if loading}
    <div class="space-y-5" aria-busy="true" aria-label={ar ? 'تحميل تفاصيل المباراة' : 'Loading match details'}>
      <LoadingShape className="h-6 w-32" />
      <div class="rounded-[18px] bg-surface p-5 space-y-4"><LoadingShape className="h-5 w-3/4" /><LoadingShape className="h-8 w-32" /><LoadingShape className="h-3 w-1/2" /><LoadingShape className="h-3 w-2/3" /></div>
      <div class="match-workspace">
        <div class="rounded-[18px] bg-surface p-5 space-y-4"><LoadingShape className="h-4 w-28" /><LoadingShape className="h-12 w-full" /><LoadingShape className="h-12 w-full" /></div>
        <div class="rounded-[18px] bg-surface p-5 space-y-4"><LoadingShape className="h-4 w-28" /><LoadingShape className="h-3 w-3/4" /><LoadingShape className="h-10 w-full" /></div>
      </div>
    </div>
  {:else if error || !details}
    <section class="uneem-empty py-10">
      <p class="font-medium text-text">{error || copy.notFound}</p>
      <button on:click={() => load()} class="mt-3 min-h-10 text-sm font-medium text-primary">
        {copy.retry}
      </button>
    </section>
  {:else}
    <a href={`/pitch/${details.pitch_id}`} class="uneem-text-action mb-5">
      <Icon name={ar ? 'arrow-right' : 'arrow-left'} size={17}/>
      {copy.back}
    </a>

    <header class="match-page-heading">
      <h1 class="uneem-title">{isOwner && details.match_id ? (ar ? 'إدارة مباراتك' : 'Manage your match') : details.match_id ? (ar ? 'تفاصيل المباراة' : 'Match details') : copy.title}</h1>
    </header>

    <section class="match-summary" aria-label={ar ? 'ملخص المباراة' : 'Match summary'}>
      <div class="summary-heading">
        <h2>{details.pitch_name}</h2>
        <span class:status-open={isOpen} class="match-status">{isOpen ? copy.open : copy.closed}</span>
      </div>
      <div class="match-schedule">
        <div class="schedule-date"><span>{ar ? 'التاريخ' : 'Date'}</span><strong>{dateText(details.starts_at)}</strong></div>
        <div class="schedule-time"><span>{ar ? 'الوقت' : 'Time'}</span><strong dir="ltr">{timeText(details.starts_at)} <span>– {timeText(details.ends_at)}</span></strong></div>
      </div>
      <div class="match-meta">
        <p><Icon name="map-pin" size={14}/>{details.location}</p>
        <p>{copy.bookedBy} <a href={'/community/players/' + details.booker_username}><bdi>@{details.booker_username}</bdi></a></p>
      </div>
      {#if details.match_id && (isOpen || isOwner)}
        <div class="match-occupancy" aria-label={ar ? 'أماكن المباراة' : 'Match capacity'}>
          <div><p><strong>{usedSpots}<span> / {details.capacity}</span></strong><span>{copy.players}</span></p><p class="available-spots"><strong>{isOpen ? details.spots_left : 0}</strong><span>{copy.openSpots}</span></p></div>
          <progress value={Math.max(0, usedSpots)} max={Math.max(1, details.capacity)} aria-label={`${usedSpots}/${details.capacity} ${copy.players}`}></progress>
        </div>
      {/if}
    </section>

    <div class="match-social-actions">
      {#if isOpen && !started}<ShareMatch match={details}/>{/if}
      {#if details.match_id && (isOwner || details.participant_by_me || details.reserved_by_me)}<ActionLink href={'/community/chats/' + details.booking_id} variant="secondary" fullWidth><Icon name="message-circle" size={17}/>{ar ? 'محادثة المباراة' : 'Match chat'}</ActionLink>{/if}
    </div>

    {#if !$hasFullAccess}
      <ActionLink href="/verification" fullWidth size="lg" className="mt-4">{ar ? 'تحقق من هويتك للانضمام' : 'Verify ID to join'}</ActionLink>
    {:else if !isOwner && !started}
      <div class="mt-4">
        {#if details.reserved_by_me}
          <div class="rounded-[14px] bg-success-light px-4 py-3 text-center text-sm font-medium text-success">{copy.yourSpot}</div>
        {:else if details.participant_by_me}
          <div class="mb-3 text-sm font-medium text-success">{ar ? 'أنت مشارك في هذه المباراة' : 'You’re playing in this match'}</div>
          <Button variant="secondary" className="w-full" disabled={busy !== null} loading={busy === 'leave'} on:click={leave}>{copy.leave}</Button>
        {:else if isOpen}
          <Button className="w-full" disabled={!canJoin || busy !== null} loading={busy === 'join'} on:click={join}>{details.spots_left <= 0 ? (ar ? 'المباراة مكتملة' : 'Match full') : copy.join}</Button>
        {/if}
      </div>
    {/if}

    <div class="match-workspace">
      {#if details.match_id && (isOpen || isOwner)}
        <section class="roster-panel" aria-labelledby="players-heading">
          <header class="panel-heading">
            <div>
              <h2 id="players-heading">{copy.players}</h2>
            </div>
            {#if canAddFriend}
              <Button variant={friendFormOpen ? 'ghost' : 'primary'} size="sm" disabled={busy !== null} aria-expanded={friendFormOpen} aria-controls="add-player-form" on:click={() => friendFormOpen = !friendFormOpen}>
                <Icon name={friendFormOpen ? 'x' : 'plus'} size={16}/>
                {friendFormOpen ? (ar ? 'إغلاق' : 'Close') : (ar ? 'إضافة لاعب' : 'Add player')}
              </Button>
            {/if}
          </header>
      {#if canAddFriend && friendFormOpen}
        <form id="add-player-form" class="add-player-form flex flex-col gap-3" on:submit|preventDefault={addFriend}>
          <SegmentedControl options={[{ value: 'registered', label: ar ? 'لاعب مسجّل' : 'Find a player' }, { value: 'guest', label: ar ? 'ضيف' : 'Add a guest' }]} value={friendMode} ariaLabel={ar ? 'نوع اللاعب' : 'Player type'} onChange={changeFriendMode} />
          <div class="relative min-w-0 flex-1">
            <label for="booking-friend" class="mb-2 block text-sm font-medium text-text">{friendMode === 'registered' ? (ar ? 'ابحث باسم المستخدم' : 'Search username') : (ar ? 'اسم الضيف' : 'Guest name')}</label>
            <input
              id="booking-friend"
              role={friendMode === 'registered' ? 'combobox' : undefined}
              aria-controls="friend-suggestions"
              aria-activedescendant={suggestionIndex >= 0 ? `friend-option-${suggestionIndex}` : undefined}
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
              placeholder={friendMode === 'registered' ? (ar ? 'اسم المستخدم، مع @ أو بدونها' : 'Username, with or without @') : (ar ? 'اكتب اسم الضيف' : 'Enter guest name')}
              aria-autocomplete="list"
              aria-expanded={suggestionOpen}
              class="uneem-field"
            />
            {#if suggestionOpen && suggestions.length > 0}
              <div id="friend-suggestions" class="friend-suggestions absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-y-auto rounded-[18px] bg-surface-raised p-1.5 shadow-lg" role="listbox">
                {#each suggestions as suggestion, index (suggestion.user_id)}
                  <button
                    type="button"
                    role="option"
                    id={`friend-option-${index}`}
                    aria-selected={index === suggestionIndex}
                    on:mousedown|preventDefault
                    on:click={() => chooseSuggestion(suggestion)}
                    class={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] px-3 text-start ${index === suggestionIndex ? 'bg-surface-level-1' : 'hover:bg-surface-level-1'}`}
                  >
                    <span class="truncate text-sm font-medium text-text">@{suggestion.username}</span>
                    {#if suggestion.full_name}<span class="truncate text-xs text-text-muted">{suggestion.full_name}</span>{/if}
                  </button>
                {/each}
              </div>
            {:else if searchingUsers}
              <p class="mt-2 text-xs text-text-secondary" role="status">{ar ? 'البحث عن لاعبين…' : 'Finding players…'}</p>
            {:else if suggestionOpen && friendMode === 'registered'}
              <p class="mt-2 text-xs text-text-secondary" role="status">{searchError ? (ar ? 'تعذر البحث الآن. حاول مجدداً.' : 'Search is unavailable. Try again.') : (ar ? 'لا يوجد لاعب مطابق. جرّب اسم مستخدم آخر.' : 'No matching players. Try another username.')}</p>
            {/if}
          </div>
          <p class="text-xs leading-5 text-text-muted">{friendMode === 'registered' ? (ar ? 'اختر لاعباً من النتائج. الحجز يستخدم مكاناً متاحاً ولا يستبدل لاعباً مشاركاً.' : 'Choose a result to reserve one available spot.') : (ar ? 'الضيف لا يحتاج إلى حساب. حجزه يستخدم مكاناً متاحاً.' : 'Guests don’t need an account. Their reservation uses a free spot.')}</p>
          <Button type="submit" fullWidth disabled={!friendInput.trim() || (friendMode === 'registered' && !selectedSuggestion) || busy !== null} loading={busy === 'friend'}>{ar ? 'احجز مكاناً' : 'Reserve a spot'}</Button>
        </form>
      {/if}
          <div class="roster-list">
            {#each roster as member (member.entry_id)}
              <div class="player-row">
                <div class="player-avatar" aria-hidden="true">{member.display_name?.trim()?.[0]?.toUpperCase() || 'U'}</div>
                <div class="player-identity">
                  <p>{member.display_name || (member.username ? `@${member.username}` : copy.guest)}</p>
                  {#if member.username}<a href={'/community/players/' + member.username}><bdi>@{member.username}</bdi></a>
                  {:else if member.source === 'guest'}<span>{copy.guest}</span>{/if}
                </div>
                <span class:host-label={member.member_role === 'organizer'} class="player-role">
                  {member.member_role === 'organizer' ? copy.host : member.member_role === 'reserved' ? copy.reserved : (ar ? 'مشارك' : 'Joined')}
                </span>
                {#if $hasFullAccess && isOwner && member.reservation_id && !started}
                  <button type="button" disabled={busy !== null} on:click={() => removeFriend(member)} class="uneem-icon-button text-text-muted hover:bg-surface-level-1 hover:text-danger disabled:opacity-40" aria-label={`${ar ? 'إزالة الحجز المسبق لـ' : 'Remove reservation for'} ${member.display_name}`}>
                    <Icon name="x" size={16}/>
                  </button>
                {/if}
              </div>
            {:else}
              <p class="roster-empty">{ar ? 'ستظهر قائمة اللاعبين هنا.' : 'Players will appear here.'}</p>
            {/each}
          </div>
        </section>
      {/if}

      {#if isOpen || ($hasFullAccess && isOwner && !started)}
      <aside class="match-tools">
        {#if $hasFullAccess && isOwner && !started && details.capacity >= 2}
          <section class="visibility-settings">
            <Toggle checked={isOpen} label={copy.openToPlayers} disabled={busy !== null} onToggle={() => void toggleOpen()} />
            {#if visibilityBlocked}
              <p class="visibility-error" role="alert">{ar ? 'لا يمكنك إغلاق المباراة بعد انضمام لاعبين. أماكنهم تبقى محفوظة.' : 'You can’t close this match after players have joined. Their spots stay protected.'}</p>
            {/if}
          </section>
        {/if}
        {#if isOpen && !started}
          <section class="invite-section">
          </section>
        {/if}
        {#if isOpen}
          <details class="open-match-rules">
            <summary><Icon name="users" size={16}/>{ar ? 'قواعد الانضمام' : 'Joining rules'}</summary>
            <p>{ar ? 'الانضمام حسب أسبقية الحضور حتى اكتمال الأماكن. لا يحتاج اللاعب لموافقة المنظّم، ولا يمكنه طرد اللاعبين المنضمّين.' : 'Spots are first come, first served. Joining needs no organizer approval. Organizers can’t remove players who joined.'}</p>
          </details>
        {/if}
        {#if $hasFullAccess && isOwner && !started}
          <div class="cancel-section">
            <button type="button" disabled={busy !== null} on:click={requestCancellation} class="cancel-booking">{copy.cancel}</button>
            {#if cancellationBlocked}
              <p class="cancellation-error" role="alert">{ar ? 'لا يمكنك إلغاء المباراة بعد انضمام لاعبين. أماكنهم تبقى محفوظة.' : 'You can’t cancel this match after players have joined. Their spots stay protected.'}</p>
            {/if}
          </div>
        {/if}
      </aside>
      {/if}
    </div>
  {/if}
</main>

<Modal bind:open={cancelDialogOpen} title={copy.cancelConfirm} closeDisabled={busy === 'cancel'} size="sm">
  <p class="text-sm leading-6 text-text-secondary">{ar ? 'سيصبح هذا الموعد متاحاً لطلاب آخرين.' : 'This time will become available to other students.'}</p>
  <svelte:fragment slot="footer">
    <Button variant="secondary" disabled={busy === 'cancel'} on:click={() => cancelDialogOpen = false}>{ar ? 'الاحتفاظ بالحجز' : 'Keep booking'}</Button>
    <Button className="!bg-danger !text-white" loading={busy === 'cancel'} on:click={cancelMine}>{copy.cancel}</Button>
  </svelte:fragment>
</Modal>
<style>
  .match-social-actions { display:flex; gap:12px; margin-top:16px; }
  .match-social-actions > :global(*) { flex:1; }
  .match-page { max-width: 960px; }
  .match-page-heading { margin-bottom: 24px; }
  .match-summary { padding: 24px; border-radius: 20px; background: var(--surface); }
  .summary-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .summary-heading h2 { font-size: 20px; font-weight: 500; line-height: 1.35; overflow-wrap: anywhere; }
  .match-status { flex-shrink: 0; padding: 5px 10px; border-radius: 8px; background: var(--surface-level-1); font-size: 12px; font-weight: 500; color: var(--text-secondary); }
  .status-open { color: var(--success); background: var(--success-light); }
  .match-schedule { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px; }
  .match-schedule > div { display: flex; flex-direction: column; gap: 6px; }
  .match-schedule > div > span { font-size: 12px; color: var(--text-muted); }
  .match-schedule strong { font-size: 19px; line-height: 1.35; font-weight: 500; font-variant-numeric: tabular-nums; }
  .schedule-time strong { align-self: flex-start; }
  .schedule-time strong span { font-size: 16px; font-weight: 500; color: var(--text-secondary); }
  .match-meta { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 16px; }
  .match-meta p { display: flex; align-items: center; gap: 6px; font-size: 12px; line-height: 1.5; color: var(--text-secondary); overflow-wrap: anywhere; }
  .match-meta :global(svg) { flex-shrink: 0; }
  .match-meta a { font-weight: 500; color: var(--primary); }
  .match-workspace { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); gap: 20px; align-items: start; margin-top: 24px; }
  .roster-panel, .match-tools { min-width: 0; background: var(--surface); border-radius: 20px; }
  .roster-panel:only-child, .match-tools:only-child { grid-column: 1 / -1; }
  .panel-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 20px; }
  .panel-heading h2 { font-size: 18px; font-weight: 500; }
  .panel-heading :global(.ui-button) { flex-shrink: 0; }
  .roster-list { padding-inline: 20px; }
  .player-row { display: flex; align-items: center; gap: 12px; padding-block: 14px; border-top: 1px solid var(--surface-level-1); }
  .player-avatar { display: grid; place-items: center; height: 36px; width: 36px; flex-shrink: 0; border-radius: 12px; background: var(--surface-level-1); font-size: 12px; font-weight: 500; color: var(--text-secondary); }
  .player-identity { flex: 1; min-width: 0; }
  .player-identity p { font-size: 14px; font-weight: 500; overflow-wrap: anywhere; }
  .player-identity > span { display: block; margin-top: 2px; font-size: 12px; color: var(--text-muted); overflow-wrap: anywhere; text-align: start; }
  .player-role { flex-shrink: 0; font-size: 11px; color: var(--text-secondary); }
  .host-label { color: var(--primary); font-weight: 500; }
  .roster-empty { padding-block: 20px; font-size: 14px; color: var(--text-muted); }
  .add-player-form { padding: 20px; border-top: 1px solid var(--surface-level-1); background: var(--surface-level-1); }
  .add-player-form :global(.uneem-field) { background: var(--surface); }
  .match-tools { padding: 20px; }
  .match-tools:empty { display: none; }
  .visibility-settings .visibility-error { font-size: 12px; line-height: 1.6; color: var(--danger); margin-top: 8px; }
  .visibility-settings :global(.ui-toggle) { width: 100%; }
  .visibility-settings :global(.ui-toggle-label) { font-size: 13px; }
  .invite-section { margin-top: 20px; }
  .invite-section:first-child { margin-top: 0; }
  .cancel-section { margin-top: 20px; padding-top: 8px; border-top: 1px solid var(--surface-level-1); }
  .cancel-booking { min-height: 44px; width: 100%; text-align: start; font-size: 12px; color: var(--danger); font-weight: 500; }
  .cancel-booking:hover { text-decoration: underline; }
  .cancel-booking:disabled { opacity: .4; }
  .cancellation-error { font-size: 12px; line-height: 1.6; color: var(--danger); padding-bottom: 8px; }
  .cancel-booking:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 4px; }
  .friend-suggestions { max-height: min(240px, calc(var(--visual-height, 100dvh) * .4)); }
  .open-match-rules { margin-top: 20px; color: var(--text-secondary); }
  .open-match-rules summary { display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; font-size: 12px; font-weight: 500; }
  .open-match-rules summary::after { content: '+'; margin-inline-start: auto; font-size: 16px; }
  .open-match-rules[open] summary::after { content: '−'; }
  .open-match-rules summary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 4px; }
  .open-match-rules p { font-size: 12px; line-height: 1.7; padding-top: 4px; }
  .match-occupancy { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--surface-level-1); }
  .match-occupancy > div { display: flex; justify-content: space-between; gap: 16px; }
  .match-occupancy p { display: flex; align-items: baseline; gap: 8px; }
  .match-occupancy p > span { font-size: 12px; color: var(--text-secondary); }
  .match-occupancy strong { font-size: 22px; font-weight: 500; font-variant-numeric: tabular-nums; }
  .match-occupancy strong > span { font-size: 15px; font-weight: 500; color: var(--text-muted); }
  .available-spots strong { color: var(--primary); }
  progress { display: block; width: 100%; height: 5px; margin-top: 12px; appearance: none; border: 0; border-radius: 4px; overflow: hidden; background: var(--surface-level-1); }
  progress::-webkit-progress-bar { background: var(--surface-level-1); }
  progress::-webkit-progress-value { background: var(--primary); border-radius: 4px; }
  progress::-moz-progress-bar { background: var(--primary); }
  @media (max-width: 700px) {
    .match-workspace { grid-template-columns: minmax(0, 1fr); gap: 16px; margin-top: 20px; }
    .match-page-heading { margin-bottom: 20px; }
    .match-summary { padding: 20px; }
    .match-schedule { gap: 16px; margin-top: 20px; }
    .match-schedule strong { font-size: 16px; }
    .schedule-time strong span { font-size: 14px; }
    .panel-heading { padding: 18px 16px; }
    .roster-list { padding-inline: 16px; }
    .player-row { gap: 10px; }
    .add-player-form { padding: 16px; }
    .match-occupancy p { flex-direction: column; gap: 2px; }
    .match-occupancy .available-spots { align-items: flex-end; }
  }
</style>

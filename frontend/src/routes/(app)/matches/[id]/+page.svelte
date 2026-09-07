<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { language, uiState } from '$lib/stores/ui'
  import {
    listOpenMatches,
    listMyMatches,
    getMatchRoster,
    joinOpenMatch,
    leaveOpenMatch,
    updateReservedSpots,
    setMatchVisibility,
    MatchApiError,
    matchErrorCopy,
    type OpenMatch,
    type MyMatch,
    type MatchRosterMember
  } from '$lib/matchApi'

  let openMatch: OpenMatch | null = null
  let myMatch: MyMatch | null = null
  let roster: MatchRosterMember[] = []
  let loading = true
  let error = ''
  let busy: 'join' | 'leave' | 'reserved' | 'visibility' | null = null
  let matchId = ''

  $: matchId = $page.params.id || ''
  $: ar = $language === 'ar'
  $: isOrganizer = Boolean(openMatch?.organized_by_me || myMatch?.member_role === 'organizer')
  $: joinedByMe = Boolean(openMatch?.joined_by_me || myMatch?.member_role === 'player')
  $: visibility = myMatch?.visibility || (openMatch ? 'open' : 'private')
  $: capacity = Number(openMatch?.capacity ?? myMatch?.capacity ?? 0)
  $: reservedSpots = Number(openMatch?.reserved_spots ?? myMatch?.reserved_spots ?? 0)
  $: joinedCount = Number(openMatch?.joined_count ?? myMatch?.joined_count ?? 0)
  $: spotsLeft = Math.max(0, capacity - 1 - reservedSpots - joinedCount)
  $: usedSpots = Math.min(capacity, 1 + reservedSpots + joinedCount)
  $: maxReservedSpots = Math.max(0, capacity - 1 - joinedCount)
  $: startsAt = openMatch?.starts_at || myMatch?.starts_at || ''
  $: endsAt = openMatch?.ends_at || myMatch?.ends_at || ''
  $: timezone = openMatch?.timezone || myMatch?.timezone || 'Africa/Casablanca'
  $: pitchName = openMatch?.pitch_name || myMatch?.pitch_name || ''
  $: location = openMatch?.location || myMatch?.location || ''
  $: started = Boolean(startsAt && new Date(startsAt).getTime() <= Date.now())

  $: copy = ar ? {
    back:'المباريات', open:'مفتوح', closed:'مغلق على لاعبين جدد', started:'بدا الماتش', openSpots:'بلايص مفتوحة', used:'مستعملة', friends:'صحابك معاك', players:'اللاعبين', organizer:'المنظم', reserved:'صحاب محجوزين', join:'انضم', leave:'خرج', close:'سد على لاعبين جدد', reopen:'حل للاعبين', cannotClose:'كاينين لاعبين منضمين، الماتش غيبقى مفتوح.', retry:'عاود المحاولة', notFound:'هاد الماتش ما بقاش متاح.', closedToast:'تسد الماتش على لاعبين جدد. الحجز ديالك باقي.', openedToast:'الماتش مفتوح للاعبين.'
  } : {
    back:'Matches', open:'Open', closed:'Closed to new players', started:'Match started', openSpots:'Open spots', used:'Used', friends:'Friends with you', players:'Players', organizer:'Organizer', reserved:'friends reserved', join:'Join match', leave:'Leave match', close:'Close to new players', reopen:'Open to players', cannotClose:'Players already joined, so this match stays open.', retry:'Retry', notFound:'This match is no longer available.', closedToast:'Match closed to new players. Your booking stays active.', openedToast:'Match is open to players.'
  }

  onMount(() => { void load() })

  async function load(silent = false) {
    if (!silent) loading = true
    error = ''
    if (!matchId) {
      error = copy.notFound
      loading = false
      return
    }

    try {
      const [openRows, mineRows] = await Promise.all([listOpenMatches(), listMyMatches()])
      openMatch = openRows.find((item) => item.match_id === matchId) || null
      myMatch = mineRows.find((item) => item.match_id === matchId) || null

      if (!openMatch && !myMatch) {
        roster = []
        error = copy.notFound
        return
      }

      roster = await getMatchRoster(matchId)
    } catch (e) {
      error = matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language)
    } finally {
      if (!silent) loading = false
    }
  }

  async function join() {
    if (busy || started || spotsLeft < 1) return
    busy = 'join'
    try {
      await joinOpenMatch(matchId)
      uiState.addToast(ar ? 'تم الانضمام' : "You're in!", 'success')
      await load(true)
    } catch (e) {
      uiState.addToast(matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language), 'error')
    } finally { busy = null }
  }

  async function leave() {
    if (busy || started) return
    busy = 'leave'
    try {
      await leaveOpenMatch(matchId)
      uiState.addToast(ar ? 'خرجتي من الماتش' : 'You left the match.', 'success')
      await load(true)
    } catch (e) {
      uiState.addToast(matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language), 'error')
    } finally { busy = null }
  }

  async function changeReserved(next: number) {
    if (!isOrganizer || busy || started || visibility !== 'open') return
    const safe = Math.max(0, Math.min(maxReservedSpots, next))
    if (safe === reservedSpots) return
    busy = 'reserved'
    try {
      await updateReservedSpots(matchId, safe)
      await load(true)
    } catch (e) {
      uiState.addToast(matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language), 'error')
    } finally { busy = null }
  }

  async function changeVisibility(next: 'private' | 'open') {
    if (!isOrganizer || busy || started) return
    busy = 'visibility'
    try {
      await setMatchVisibility(matchId, next)
      uiState.addToast(next === 'open' ? copy.openedToast : copy.closedToast, 'success')
      if (next === 'private') {
        await goto('/bookings')
        return
      }
      await load(true)
    } catch (e) {
      uiState.addToast(matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language), 'error')
    } finally { busy = null }
  }

  function dateText(value: string) {
    return new Date(value).toLocaleDateString(ar ? 'ar-MA' : 'en', { weekday:'long', month:'short', day:'numeric', timeZone: timezone })
  }

  function timeText(value: string) {
    return new Date(value).toLocaleTimeString(ar ? 'ar-MA' : 'en', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone: timezone })
  }
</script>

<svelte:head><title>{pitchName || copy.back} · UNEEM</title></svelte:head>

<main class="uneem-page-narrow">
  <a href="/matches" class="uneem-text-action mb-5"><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={17}/>{copy.back}</a>

  {#if loading}
    <div class="space-y-3" aria-busy="true">
      <div class="h-24 animate-pulse rounded-[18px] bg-surface-level-1"></div>
      <div class="h-28 animate-pulse rounded-[18px] bg-surface-level-1"></div>
      <div class="h-48 animate-pulse rounded-[18px] bg-surface-level-1"></div>
    </div>
  {:else if error}
    <section class="uneem-empty py-10">
      <p class="font-bold text-text">{error}</p>
      <button on:click={() => load()} class="mt-3 min-h-10 text-sm font-bold text-primary">{copy.retry}</button>
    </section>
  {:else}
    <header class="mb-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="uneem-title truncate">{pitchName}</h1>
          <p class="mt-1 text-sm text-text-muted">{dateText(startsAt)} · {timeText(startsAt)}–{timeText(endsAt)}</p>
          <p class="mt-1 flex items-center gap-1.5 text-sm text-text-muted"><Icon name="map-pin" size={14}/>{location}</p>
        </div>
        <span class={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${started ? 'bg-surface-level-1 text-text-muted' : visibility === 'open' ? 'bg-success-light text-success' : 'bg-surface-level-1 text-text-secondary'}`}>
          {started ? copy.started : visibility === 'open' ? copy.open : copy.closed}
        </span>
      </div>
    </header>

    <section class="grid grid-cols-2 gap-2">
      <div class="rounded-[16px] bg-surface-level-1 p-4">
        <p class="text-xs font-semibold text-text-muted">{copy.openSpots}</p>
        <p class="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-text">{visibility === 'open' ? spotsLeft : 0}</p>
      </div>
      <div class="rounded-[16px] bg-surface-level-1 p-4">
        <p class="text-xs font-semibold text-text-muted">{copy.used}</p>
        <p class="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-text">{usedSpots}<span class="text-base text-text-muted">/{capacity}</span></p>
      </div>
    </section>

    {#if isOrganizer && !started}
      <section class="mt-4 rounded-[16px] border border-border-light bg-surface p-4">
        <div class="flex items-center justify-between gap-4">
          <span class="text-sm font-bold text-text">{copy.friends}</span>
          <div class="flex items-center gap-2">
            <button class="grid h-10 w-10 place-items-center rounded-[12px] bg-surface-level-1 text-lg font-bold text-text disabled:opacity-35" disabled={busy !== null || reservedSpots === 0 || visibility !== 'open'} on:click={() => changeReserved(reservedSpots - 1)} aria-label="Remove reserved friend">−</button>
            <span class="min-w-7 text-center text-lg font-extrabold text-text">{reservedSpots}</span>
            <button class="grid h-10 w-10 place-items-center rounded-[12px] bg-surface-level-1 text-lg font-bold text-text disabled:opacity-35" disabled={busy !== null || reservedSpots >= maxReservedSpots || visibility !== 'open'} on:click={() => changeReserved(reservedSpots + 1)} aria-label="Add reserved friend">+</button>
          </div>
        </div>
      </section>
    {/if}

    {#if !isOrganizer && !started}
      <div class="mt-4">
        {#if joinedByMe}
          <Button variant="secondary" className="w-full" loading={busy === 'leave'} on:click={leave}>{copy.leave}</Button>
        {:else}
          <Button className="w-full" disabled={visibility !== 'open' || spotsLeft === 0} loading={busy === 'join'} on:click={join}>{spotsLeft === 0 ? copy.closed : copy.join}</Button>
        {/if}
      </div>
    {/if}

    <section class="mt-6">
      <h2 class="mb-2 text-lg font-bold text-text">{copy.players}</h2>
      <div class="rounded-[16px] border border-border-light bg-surface px-4">
        {#each roster as member (member.user_id)}
          <div class="uneem-list-row min-h-[54px] py-2">
            <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-level-1 text-xs font-bold text-text-secondary">{member.full_name?.trim()?.[0]?.toUpperCase() || 'U'}</div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-text">{member.full_name}</p>
              <p class="truncate text-xs text-text-muted">@{member.username}</p>
            </div>
            {#if member.member_role === 'organizer'}<span class="text-xs font-bold text-primary">{copy.organizer}</span>{/if}
          </div>
        {/each}
        {#if reservedSpots > 0}
          <div class="uneem-list-row min-h-[50px] py-2 text-sm text-text-muted">
            <span class="flex-1">+{reservedSpots} {copy.reserved}</span>
          </div>
        {/if}
      </div>
    </section>

    {#if isOrganizer && !started}
      <div class="mt-5">
        {#if visibility === 'open' && joinedCount === 0}
          <Button variant="secondary" className="w-full" loading={busy === 'visibility'} on:click={() => changeVisibility('private')}>{copy.close}</Button>
        {:else if visibility === 'private'}
          <Button className="w-full" loading={busy === 'visibility'} on:click={() => changeVisibility('open')}>{copy.reopen}</Button>
        {:else if visibility === 'open' && joinedCount > 0}
          <p class="text-center text-xs font-semibold text-text-muted">{copy.cannotClose}</p>
        {/if}
      </div>
    {/if}
  {/if}
</main>

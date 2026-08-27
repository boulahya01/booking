<script lang="ts">
  import { onMount } from 'svelte'
  import { language, uiState } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'
  import Button from '$lib/components/Button.svelte'
  import {
    listOpenMatches,
    getMatchRoster,
    joinOpenMatch,
    leaveOpenMatch,
    matchErrorCopy,
    MatchApiError,
    type OpenMatch,
    type MatchRosterMember
  } from '$lib/matchApi'

  let matches: OpenMatch[] = []
  let loading = true
  let error = ''
  let busyId: string | null = null
  let rosterFor: string | null = null
  let roster: MatchRosterMember[] = []
  let loadingRoster = false

  $: ar = $language === 'ar'
  $: copy = ar ? {
    title:'المباريات', subtitle:'انضم لمباراة مفتوحة.', empty:'ما كايناش مباريات دابا.', emptyHint:'رجع من بعد أو افتح حجزك للاعبين.',
    spots:'أماكن', full:'ممتلئة', join:'انضم', leave:'غادر', mine:'مباراتك', players:'اللاعبون', hide:'إخفاء', reserved:'محجوزة', retry:'إعادة المحاولة', organizer:'المنظم'
  } : {
    title:'Matches', subtitle:'Join an open game.', empty:'No open matches right now.', emptyHint:'Check again later or open your own booking.',
    spots:'spots', full:'Full', join:'Join', leave:'Leave', mine:'Your match', players:'Players', hide:'Hide', reserved:'reserved', retry:'Retry', organizer:'Organizer'
  }

  onMount(load)

  async function load() {
    loading = true
    error = ''
    try { matches = await listOpenMatches() }
    catch (e) { error = matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language) }
    finally { loading = false }
  }

  async function join(match: OpenMatch) {
    busyId = match.match_id
    try {
      await joinOpenMatch(match.match_id)
      matches = matches.map((item) => item.match_id === match.match_id
        ? { ...item, joined_by_me: true, joined_count: item.joined_count + 1, spots_left: Math.max(0, item.spots_left - 1) }
        : item)
      uiState.addToast(ar ? 'تم الانضمام' : "You're in!", 'success')
      if (rosterFor === match.match_id) await showRoster(match.match_id)
    } catch (e) { uiState.addToast(matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language), 'error') }
    finally { busyId = null }
  }

  async function leave(match: OpenMatch) {
    busyId = match.match_id
    try {
      await leaveOpenMatch(match.match_id)
      matches = matches.map((item) => item.match_id === match.match_id
        ? { ...item, joined_by_me: false, joined_count: Math.max(0, item.joined_count - 1), spots_left: item.spots_left + 1 }
        : item)
      uiState.addToast(ar ? 'غادرت المباراة' : 'You left the match.', 'success')
      if (rosterFor === match.match_id) await showRoster(match.match_id)
    } catch (e) { uiState.addToast(matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language), 'error') }
    finally { busyId = null }
  }

  async function showRoster(matchId: string) {
    if (rosterFor === matchId && roster.length) { rosterFor = null; roster = []; return }
    rosterFor = matchId
    roster = []
    loadingRoster = true
    try { roster = await getMatchRoster(matchId) }
    catch (e) { uiState.addToast(matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language), 'error') }
    finally { loadingRoster = false }
  }

  function dateText(value: string) {
    return new Date(value).toLocaleDateString(ar ? 'ar-MA' : 'en', { weekday:'short', month:'short', day:'numeric' })
  }

  function timeText(value: string) {
    return new Date(value).toLocaleTimeString(ar ? 'ar-MA' : 'en', { hour:'2-digit', minute:'2-digit', hour12:false })
  }

  function sportLabel(value: string | null) {
    if (!value || !ar) return value || ''
    if (value.toLowerCase() === 'football') return 'كرة القدم'
    if (value.toLowerCase() === 'basketball') return 'كرة السلة'
    if (value.toLowerCase() === 'volleyball') return 'الكرة الطائرة'
    return value
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
    <div class="space-y-3" aria-busy="true">
      {#each [1,2,3] as _}<div class="h-40 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}
    </div>
  {:else if error}
    <section class="uneem-card text-center">
      <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger-light text-danger"><Icon name="alert-circle" size={22} /></div>
      <p class="mt-3 text-sm font-semibold text-danger">{error}</p>
      <button on:click={load} class="mt-3 min-h-10 text-sm font-bold text-primary">{copy.retry}</button>
    </section>
  {:else if matches.length === 0}
    <section class="uneem-empty">
      <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-text-muted"><Icon name="users" size={22} /></div>
      <h2 class="mt-3 font-bold text-text">{copy.empty}</h2>
      <p class="mx-auto mt-1 max-w-xs text-sm text-text-muted">{copy.emptyHint}</p>
      <a href="/bookings" class="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-primary">{ar ? 'شوف حجوزاتك' : 'Open My Sports'}</a>
    </section>
  {:else}
    <div class="space-y-3">
      {#each matches as match (match.match_id)}
        <article class="uneem-card">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              {#if match.sport_type}<p class="text-xs font-bold text-primary">{sportLabel(match.sport_type)}</p>{/if}
              <h2 class="mt-1 truncate text-lg font-bold tracking-[-0.02em] text-text">{match.pitch_name}</h2>
              <p class="mt-1 flex items-center gap-1.5 text-sm text-text-secondary"><Icon name="map-pin" size={14} />{match.location}</p>
            </div>
            <div class="shrink-0 text-end">
              <p class="text-sm font-bold text-text">{dateText(match.starts_at)}</p>
              <p class="mt-0.5 text-sm text-text-muted">{timeText(match.starts_at)}</p>
            </div>
          </div>

          <div class="mt-4 flex items-center gap-3 border-t border-border-light pt-4">
            <div class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-light text-xs font-extrabold text-primary">{match.organizer_name?.trim()?.[0]?.toUpperCase() || 'U'}</div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-text">{match.organizer_name}</p>
              <p class="truncate text-xs text-text-muted">@{match.organizer_username}</p>
            </div>
            <div class="shrink-0 text-end">
              <p class="text-base font-extrabold {match.spots_left === 0 ? 'text-text-muted' : 'text-primary'}">{match.spots_left === 0 ? copy.full : `${match.spots_left} ${copy.spots}`}</p>
              {#if match.reserved_spots > 0}<p class="text-xs text-text-muted">{match.reserved_spots} {copy.reserved}</p>{/if}
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            {#if match.organized_by_me}
              <div class="flex min-h-[50px] flex-1 items-center justify-center rounded-[18px] bg-primary-light text-sm font-bold text-primary">{copy.mine}</div>
            {:else if match.joined_by_me}
              <Button variant="secondary" size="lg" className="flex-1" loading={busyId === match.match_id} on:click={() => leave(match)}>{copy.leave}</Button>
            {:else}
              <Button size="lg" className="flex-1" disabled={match.spots_left === 0} loading={busyId === match.match_id} on:click={() => join(match)}>{match.spots_left === 0 ? copy.full : copy.join}</Button>
            {/if}
            <button on:click={() => showRoster(match.match_id)} class="min-h-[50px] rounded-[18px] px-4 text-sm font-bold text-text-secondary hover:bg-surface-level-1 hover:text-text">
              {rosterFor === match.match_id ? copy.hide : copy.players}
            </button>
          </div>

          {#if rosterFor === match.match_id}
            <div class="mt-4 border-t border-border-light pt-3">
              {#if loadingRoster}
                <div class="space-y-2">{#each [1,2] as _}<div class="h-10 animate-pulse rounded-xl bg-surface-level-1"></div>{/each}</div>
              {:else}
                <div>
                  {#each roster as member}
                    <div class="uneem-list-row min-h-[52px] py-2">
                      <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-level-1 text-xs font-bold text-text-secondary">{member.full_name?.trim()?.[0]?.toUpperCase() || 'U'}</div>
                      <div class="min-w-0 flex-1"><p class="truncate text-sm font-bold text-text">{member.full_name}</p><p class="truncate text-xs text-text-muted">@{member.username}</p></div>
                      {#if member.member_role === 'organizer'}<span class="text-xs font-bold text-primary">{copy.organizer}</span>{/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</main>

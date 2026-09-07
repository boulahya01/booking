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
    title:'المباريات', empty:'ما كاين حتى ماتش مفتوح دابا.', book:'احجز وقت', spots:'بلايص', full:'عامر', join:'انضم', leave:'خرج', mine:'الماتش ديالك', players:'اللاعبين', hide:'خبي', reserved:'محجوزة', retry:'عاود المحاولة', organizer:'المنظم'
  } : {
    title:'Matches', empty:'No open matches right now.', book:'Book a slot', spots:'spots', full:'Full', join:'Join', leave:'Leave', mine:'Your match', players:'Players', hide:'Hide', reserved:'reserved', retry:'Retry', organizer:'Organizer'
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
      uiState.addToast(ar ? 'خرجتي من الماتش' : 'You left the match.', 'success')
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

  function dateText(value: string, timezone: string) {
    return new Date(value).toLocaleDateString(ar ? 'ar-MA' : 'en', { weekday:'short', month:'short', day:'numeric', timeZone: timezone })
  }

  function timeText(value: string, timezone: string) {
    return new Date(value).toLocaleTimeString(ar ? 'ar-MA' : 'en', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone: timezone })
  }
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>

<main class="uneem-page-narrow">
  <header class="mb-6"><h1 class="uneem-title">{copy.title}</h1></header>

  {#if loading}
    <div class="space-y-2" aria-busy="true">{#each [1,2,3] as _}<div class="h-28 animate-pulse rounded-[18px] bg-surface-level-1"></div>{/each}</div>
  {:else if error}
    <div class="flex items-center justify-between gap-3 py-4">
      <p class="text-sm font-semibold text-danger">{error}</p>
      <button on:click={load} class="min-h-10 text-sm font-bold text-primary">{copy.retry}</button>
    </div>
  {:else if matches.length === 0}
    <section class="uneem-empty py-10">
      <div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-level-1 text-text-muted"><Icon name="users" size={21} /></div>
      <h2 class="mt-3 font-bold text-text">{copy.empty}</h2>
      <a href="/home" class="uneem-primary-action mt-5 min-w-[150px]">{copy.book}</a>
    </section>
  {:else}
    <div class="space-y-2">
      {#each matches as match (match.match_id)}
        <article class="rounded-[18px] border border-border-light bg-surface p-4">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <h2 class="truncate text-[17px] font-bold tracking-[-0.02em] text-text">{match.pitch_name}</h2>
              <p class="mt-1 text-sm text-text-secondary">{dateText(match.starts_at, match.timezone)} · {timeText(match.starts_at, match.timezone)}</p>
              <p class="mt-1 flex items-center gap-1.5 text-xs text-text-muted"><Icon name="map-pin" size={13}/>{match.location}</p>
            </div>
            <div class="shrink-0 text-end">
              <p class="text-sm font-bold {match.spots_left === 0 ? 'text-text-muted' : 'text-success'}">{match.spots_left === 0 ? copy.full : `${match.spots_left} ${copy.spots}`}</p>
              <p class="mt-1 text-xs text-text-muted">{match.joined_count + 1}/{match.capacity}</p>
            </div>
          </div>

          <div class="mt-3 flex items-center gap-2 border-t border-border-light pt-3">
            <div class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-level-1 text-[11px] font-bold text-text-secondary">{match.organizer_name?.trim()?.[0]?.toUpperCase() || 'U'}</div>
            <p class="min-w-0 flex-1 truncate text-sm text-text-secondary">{match.organizer_name}</p>
            {#if match.reserved_spots > 0}<span class="text-xs text-text-muted">{match.reserved_spots} {copy.reserved}</span>{/if}
          </div>

          <div class="mt-3 flex gap-2">
            {#if match.organized_by_me}
              <div class="flex min-h-[46px] flex-1 items-center justify-center rounded-[14px] bg-primary-light text-sm font-bold text-primary">{copy.mine}</div>
            {:else if match.joined_by_me}
              <Button variant="secondary" className="flex-1" loading={busyId === match.match_id} on:click={() => leave(match)}>{copy.leave}</Button>
            {:else}
              <Button className="flex-1" disabled={match.spots_left === 0} loading={busyId === match.match_id} on:click={() => join(match)}>{match.spots_left === 0 ? copy.full : copy.join}</Button>
            {/if}
            <button on:click={() => showRoster(match.match_id)} class="min-h-[46px] rounded-[14px] px-3 text-sm font-bold text-text-secondary hover:bg-surface-level-1 hover:text-text">{rosterFor === match.match_id ? copy.hide : copy.players}</button>
          </div>

          {#if rosterFor === match.match_id}
            <div class="mt-3 border-t border-border-light pt-2">
              {#if loadingRoster}
                <div class="space-y-2">{#each [1,2] as _}<div class="h-9 animate-pulse rounded-xl bg-surface-level-1"></div>{/each}</div>
              {:else}
                {#each roster as member}
                  <div class="uneem-list-row min-h-[48px] py-1.5">
                    <div class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-level-1 text-[11px] font-bold text-text-secondary">{member.full_name?.trim()?.[0]?.toUpperCase() || 'U'}</div>
                    <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold text-text">{member.full_name}</p><p class="truncate text-xs text-text-muted">@{member.username}</p></div>
                    {#if member.member_role === 'organizer'}<span class="text-xs font-bold text-primary">{copy.organizer}</span>{/if}
                  </div>
                {/each}
              {/if}
            </div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</main>

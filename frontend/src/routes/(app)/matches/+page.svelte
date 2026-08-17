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
    title:'مباريات مفتوحة', subtitle:'اختر مباراة وانضم.', empty:'لا توجد مباريات مفتوحة الآن.', emptyHint:'ارجع لاحقاً أو افتح حجزك للاعبين.',
    spots:'أماكن', full:'ممتلئة', join:'انضم', leave:'غادر', mine:'مباراتك', players:'اللاعبون', hide:'إخفاء', reserved:'محجوزة', retry:'إعادة المحاولة'
  } : {
    title:'Open matches', subtitle:'Pick a match and join.', empty:'No open matches right now.', emptyHint:'Check again later or open your own booking.',
    spots:'spots', full:'Full', join:'Join', leave:'Leave', mine:'Your match', players:'Players', hide:'Hide', reserved:'reserved', retry:'Retry'
  }

  onMount(load)

  async function load() {
    loading = true; error = ''
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
    rosterFor = matchId; roster = []; loadingRoster = true
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
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>

<div class="mx-auto w-full max-w-3xl px-4 pb-28 pt-5 sm:px-6 sm:pb-10 sm:pt-7">
  <header class="mb-6">
    <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text">{copy.title}</h1>
    <p class="mt-1 text-sm text-text-secondary">{copy.subtitle}</p>
  </header>

  {#if loading}
    <div class="space-y-3" aria-busy="true">
      {#each [1,2,3] as _}<div class="h-44 animate-pulse rounded-3xl bg-surface-level-1"></div>{/each}
    </div>
  {:else if error}
    <section class="rounded-3xl bg-danger-light p-6 text-center">
      <Icon name="alert-circle" size={28} className="mx-auto text-danger" />
      <p class="mt-3 text-sm font-medium text-danger">{error}</p>
      <button on:click={load} class="mt-4 min-h-11 rounded-xl px-4 text-sm font-semibold text-primary">{copy.retry}</button>
    </section>
  {:else if matches.length === 0}
    <section class="py-14 text-center">
      <div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-level-1 text-text-muted"><Icon name="users" size={22} /></div>
      <h2 class="mt-4 font-semibold text-text">{copy.empty}</h2>
      <p class="mx-auto mt-1 max-w-xs text-sm text-text-muted">{copy.emptyHint}</p>
    </section>
  {:else}
    <div class="space-y-3">
      {#each matches as match (match.match_id)}
        <article class="rounded-3xl bg-surface p-5 shadow-sm">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              {#if match.sport_type}<p class="text-xs font-semibold uppercase tracking-wide text-primary">{match.sport_type}</p>{/if}
              <h2 class="mt-1 truncate text-lg font-semibold text-text">{match.pitch_name}</h2>
              <p class="mt-1 flex items-center gap-1.5 text-sm text-text-secondary"><Icon name="map-pin" size={14} />{match.location}</p>
            </div>
            <div class="shrink-0 text-end">
              <p class="text-sm font-semibold text-text">{dateText(match.starts_at)}</p>
              <p class="mt-0.5 text-sm text-text-muted">{timeText(match.starts_at)}</p>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-surface-level-1 px-4 py-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-text">{match.organizer_name}</p>
              <p class="truncate text-xs text-text-muted">@{match.organizer_username}</p>
            </div>
            <div class="shrink-0 text-end">
              <p class="text-lg font-semibold {match.spots_left === 0 ? 'text-text-muted' : 'text-primary'}">{match.spots_left === 0 ? copy.full : `${match.spots_left} ${copy.spots}`}</p>
              {#if match.reserved_spots > 0}<p class="text-xs text-text-muted">{match.reserved_spots} {copy.reserved}</p>{/if}
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            {#if match.organized_by_me}
              <div class="flex min-h-[46px] flex-1 items-center justify-center rounded-xl bg-primary-light text-sm font-semibold text-primary">{copy.mine}</div>
            {:else if match.joined_by_me}
              <Button variant="secondary" className="flex-1" loading={busyId === match.match_id} on:click={() => leave(match)}>{copy.leave}</Button>
            {:else}
              <Button className="flex-1" disabled={match.spots_left === 0} loading={busyId === match.match_id} on:click={() => join(match)}>{match.spots_left === 0 ? copy.full : copy.join}</Button>
            {/if}
            <button on:click={() => showRoster(match.match_id)} class="min-h-[46px] rounded-xl px-4 text-sm font-semibold text-text-secondary hover:bg-surface-level-1">
              {rosterFor === match.match_id ? copy.hide : copy.players}
            </button>
          </div>

          {#if rosterFor === match.match_id}
            <div class="mt-4 border-t border-border-light pt-4">
              {#if loadingRoster}
                <div class="space-y-2">{#each [1,2] as _}<div class="h-10 animate-pulse rounded-xl bg-surface-level-1"></div>{/each}</div>
              {:else}
                <div class="space-y-2">
                  {#each roster as member}
                    <div class="flex items-center justify-between gap-3 py-1.5">
                      <div class="min-w-0"><p class="truncate text-sm font-medium text-text">{member.full_name}</p><p class="truncate text-xs text-text-muted">@{member.username}</p></div>
                      {#if member.member_role === 'organizer'}<span class="text-xs font-semibold text-primary">{ar ? 'المنظم' : 'Organizer'}</span>{/if}
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
</div>

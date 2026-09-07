<script lang="ts">
  import { onMount } from 'svelte'
  import { language, uiState } from '$lib/stores/ui'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'
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
    title:'المباريات', subtitle:'ماتشات مفتوحة تقدر تنضم ليها.', empty:'ما كاين حتى ماتش مفتوح دابا.', emptyHint:'حوّل حجز ديالك لماتش أو احجز مرفق جديد.', create:'دير ماتش', book:'احجز مرفق', spots:'بلايص', full:'عامر', join:'انضم', leave:'خرج', mine:'الماتش ديالك', players:'اللاعبين', hide:'خبي', reserved:'محجوزة', retry:'عاود المحاولة', organizer:'المنظم'
  } : {
    title:'Matches', subtitle:'Open games you can join.', empty:'No open matches right now.', emptyHint:'Turn one of your bookings into a match, or book a facility.', create:'Create match', book:'Book facility', spots:'spots', full:'Full', join:'Join', leave:'Leave', mine:'Your match', players:'Players', hide:'Hide', reserved:'reserved', retry:'Retry', organizer:'Organizer'
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
  <header class="mb-6 flex items-start justify-between gap-4">
    <div>
      <h1 class="uneem-title">{copy.title}</h1>
      <p class="mt-1 text-sm text-text-muted">{copy.subtitle}</p>
    </div>
    <a href="/bookings" class="uneem-primary-action min-h-11 shrink-0 px-4 text-sm">{copy.create}</a>
  </header>

  {#if loading}
    <div class="space-y-2" aria-busy="true">{#each [1,2,3] as _}<div class="h-28 animate-pulse rounded-[16px] bg-surface-level-1"></div>{/each}</div>
  {:else if error}
    <div class="flex items-center justify-between gap-3 py-4">
      <p class="text-sm font-semibold text-danger">{error}</p>
      <button on:click={load} class="min-h-10 text-sm font-bold text-primary">{copy.retry}</button>
    </div>
  {:else if matches.length === 0}
    <section class="rounded-[16px] border border-border-light bg-surface p-5">
      <h2 class="text-lg font-bold text-text">{copy.empty}</h2>
      <p class="mt-1 max-w-sm text-sm leading-6 text-text-muted">{copy.emptyHint}</p>
      <div class="mt-5 flex flex-wrap gap-2">
        <a href="/bookings" class="uneem-primary-action min-h-11 px-4 text-sm">{copy.create}</a>
        <a href="/home" class="uneem-secondary-action min-h-11 px-4 text-sm">{copy.book}</a>
      </div>
    </section>
  {:else}
    <div class="space-y-3">
      {#each matches as match (match.match_id)}
        <article class="rounded-[16px] border border-border-light bg-surface p-4">
          <div class="flex items-start gap-4">
            <div class="shrink-0">
              <p class="text-2xl font-extrabold leading-none tracking-[-0.04em] text-text">{timeText(match.starts_at, match.timezone)}</p>
              <p class="mt-2 text-xs font-semibold text-text-muted">{dateText(match.starts_at, match.timezone)}</p>
            </div>
            <div class="min-w-0 flex-1 border-s border-border-light ps-4">
              <h2 class="truncate text-base font-bold text-text">{match.pitch_name}</h2>
              <p class="mt-1 flex items-center gap-1.5 text-xs text-text-muted"><Icon name="map-pin" size={13}/>{match.location}</p>
            </div>
            <div class="shrink-0 text-end">
              <p class="text-sm font-extrabold {match.spots_left === 0 ? 'text-text-muted' : 'text-success'}">{match.spots_left === 0 ? copy.full : `${match.spots_left} ${copy.spots}`}</p>
              <p class="mt-1 text-xs text-text-muted">{match.joined_count + 1}/{match.capacity}</p>
            </div>
          </div>

          <div class="mt-4 flex items-center gap-2 border-t border-border-light pt-3">
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

<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { language, uiState } from '$lib/stores/ui'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import OpenMatchSheet from '$lib/components/OpenMatchSheet.svelte'
  import { getMyBookings, type MyBooking } from '$lib/bookingApi'
  import {
    listOpenMatches,
    joinOpenMatch,
    leaveOpenMatch,
    matchErrorCopy,
    MatchApiError,
    type OpenMatch
  } from '$lib/matchApi'

  let matches: OpenMatch[] = []
  let bookings: MyBooking[] = []
  let loading = true
  let error = ''
  let busyId: string | null = null
  let openTarget: MyBooking | null = null

  $: ar = $language === 'ar'
  $: copy = ar ? {
    title:'المباريات', empty:'لا توجد مباريات مفتوحة حالياً.', manage:'إدارة المباراة', openMine:'افتح حجزي', book:'احجز وقت', spots:'أماكن', full:'ممتلئ', join:'انضم', leave:'مغادرة', view:'عرض', reserved:'محجوزة', retry:'إعادة المحاولة'
  } : {
    title:'Matches', empty:'No open matches right now.', manage:'Manage match', openMine:'Open my booking', book:'Book a slot', spots:'spots', full:'Full', join:'Join', leave:'Leave', view:'View', reserved:'reserved', retry:'Retry'
  }

  $: myOpenMatch = matches.find((match) => match.organized_by_me) || null
  $: upcomingBooking = bookings.find((booking) => booking.lifecycle_status === 'upcoming' && booking.status === 'scheduled') || null
  $: headerAction = myOpenMatch ? copy.manage : upcomingBooking ? copy.openMine : copy.book

  onMount(load)

  async function load() {
    loading = true
    error = ''
    try {
      const [matchRows, bookingRows] = await Promise.all([listOpenMatches(), getMyBookings()])
      matches = matchRows
      bookings = bookingRows
    } catch (e) {
      error = matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language)
    } finally { loading = false }
  }

  async function primaryAction() {
    if (myOpenMatch) {
      await goto(`/matches/${myOpenMatch.match_id}`)
      return
    }
    if (upcomingBooking) {
      if ((upcomingBooking.pitches?.capacity ?? 1) < 2) {
        uiState.addToast(matchErrorCopy('match_capacity_too_small', $language), 'error')
        return
      }
      openTarget = upcomingBooking
      return
    }
    await goto('/home')
  }

  async function opened(matchId: string) {
    openTarget = null
    if (matchId) await goto(`/matches/${matchId}`)
    else await load()
  }

  async function join(match: OpenMatch) {
    busyId = match.match_id
    try {
      await joinOpenMatch(match.match_id)
      matches = matches.map((item) => item.match_id === match.match_id
        ? { ...item, joined_by_me: true, joined_count: item.joined_count + 1, spots_left: Math.max(0, item.spots_left - 1) }
        : item)
      uiState.addToast(ar ? 'تم الانضمام' : "You're in!", 'success')
    } catch (e) {
      uiState.addToast(matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language), 'error')
    } finally { busyId = null }
  }

  async function leave(match: OpenMatch) {
    busyId = match.match_id
    try {
      await leaveOpenMatch(match.match_id)
      matches = matches.map((item) => item.match_id === match.match_id
        ? { ...item, joined_by_me: false, joined_count: Math.max(0, item.joined_count - 1), spots_left: item.spots_left + 1 }
        : item)
      uiState.addToast(ar ? 'غادرت المباراة' : 'You left the match.', 'success')
    } catch (e) {
      uiState.addToast(matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language), 'error')
    } finally { busyId = null }
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
  <header class="mb-6 flex items-center justify-between gap-4">
    <h1 class="uneem-title">{copy.title}</h1>
    {#if !loading && !error}
      <button on:click={primaryAction} class="uneem-primary-action min-h-11 shrink-0 px-4 text-sm">{headerAction}</button>
    {/if}
  </header>

  {#if loading}
    <div class="space-y-2" aria-busy="true">{#each [1,2,3] as _}<div class="h-28 animate-pulse rounded-[16px] bg-surface-level-1"></div>{/each}</div>
  {:else if error}
    <div class="flex items-center justify-between gap-3 py-4">
      <p class="text-sm font-semibold text-danger">{error}</p>
      <button on:click={load} class="min-h-10 text-sm font-bold text-primary">{copy.retry}</button>
    </div>
  {:else if matches.length === 0}
    <section class="uneem-empty py-12">
      <div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-level-1 text-text-muted"><Icon name="users" size={21}/></div>
      <p class="mt-3 font-bold text-text">{copy.empty}</p>
    </section>
  {:else}
    <div class="space-y-3">
      {#each matches as match (match.match_id)}
        {@const usedSpots = Math.min(match.capacity, 1 + match.reserved_spots + match.joined_count)}
        <article class="rounded-[16px] border border-border-light bg-surface p-4">
          <div class="flex items-start gap-4">
            <div class="shrink-0">
              <p class="leading-none">
                <span class="text-2xl font-extrabold tracking-[-0.04em] text-text">{timeText(match.starts_at, match.timezone)}</span>
                <span class="ms-1 text-sm font-semibold text-text-muted">–{timeText(match.ends_at, match.timezone)}</span>
              </p>
              <p class="mt-2 text-xs font-semibold text-text-muted">{dateText(match.starts_at, match.timezone)}</p>
            </div>
            <div class="min-w-0 flex-1 border-s border-border-light ps-4">
              <h2 class="truncate text-base font-bold text-text">{match.pitch_name}</h2>
              <p class="mt-1 flex items-center gap-1.5 text-xs text-text-muted"><Icon name="map-pin" size={13}/>{match.location}</p>
            </div>
            <div class="shrink-0 text-end">
              <p class="text-sm font-extrabold {match.spots_left === 0 ? 'text-text-muted' : 'text-success'}">{match.spots_left === 0 ? copy.full : `${match.spots_left} ${copy.spots}`}</p>
              <p class="mt-1 text-xs text-text-muted">{usedSpots}/{match.capacity}</p>
            </div>
          </div>

          <div class="mt-4 flex items-center gap-2 border-t border-border-light pt-3">
            <div class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-level-1 text-[11px] font-bold text-text-secondary">{match.organizer_name?.trim()?.[0]?.toUpperCase() || 'U'}</div>
            <p class="min-w-0 flex-1 truncate text-sm text-text-secondary">{match.organizer_name}</p>
            {#if match.reserved_spots > 0}<span class="text-xs text-text-muted">{match.reserved_spots} {copy.reserved}</span>{/if}
          </div>

          <div class="mt-3 flex gap-2">
            {#if match.organized_by_me}
              <a href={`/matches/${match.match_id}`} class="uneem-primary-action min-h-[46px] flex-1">{copy.manage}</a>
            {:else if match.joined_by_me}
              <a href={`/matches/${match.match_id}`} class="uneem-secondary-action min-h-[46px] flex-1">{copy.view}</a>
              <Button variant="secondary" className="flex-1" loading={busyId === match.match_id} on:click={() => leave(match)}>{copy.leave}</Button>
            {:else}
              <a href={`/matches/${match.match_id}`} class="uneem-secondary-action min-h-[46px] flex-1">{copy.view}</a>
              <Button className="flex-1" disabled={match.spots_left === 0} loading={busyId === match.match_id} on:click={() => join(match)}>{match.spots_left === 0 ? copy.full : copy.join}</Button>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  {/if}
</main>

{#if openTarget}
  <OpenMatchSheet booking={openTarget} onClose={() => openTarget = null} onOpened={opened}/>
{/if}

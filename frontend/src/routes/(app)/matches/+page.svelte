<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { language } from '$lib/stores/ui'
  import {
    listOpenMatches,
    matchErrorCopy,
    MatchApiError,
    type OpenMatch
  } from '$lib/matchApi'

  let matches: OpenMatch[] = []
  let loading = true
  let error = ''

  $: ar = $language === 'ar'
  $: copy = ar ? {
    title:'المباريات',
    empty:'لا توجد حجوزات مفتوحة حالياً.',
    view:'عرض',
    players:'لاعبين',
    bookedBy:'محجوز بواسطة',
    retry:'إعادة المحاولة'
  } : {
    title:'Matches',
    empty:'No open bookings right now.',
    view:'View',
    players:'players',
    bookedBy:'Booked by',
    retry:'Retry'
  }

  onMount(load)

  async function load() {
    loading = true
    error = ''
    try {
      matches = await listOpenMatches()
    } catch (e) {
      error = matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language)
    } finally {
      loading = false
    }
  }

  function dateText(value: string, timezone: string) {
    return new Date(value).toLocaleDateString(ar ? 'ar-MA' : 'en', {
      weekday:'short',
      month:'short',
      day:'numeric',
      timeZone: timezone
    })
  }

  function timeText(value: string, timezone: string) {
    return new Date(value).toLocaleTimeString(ar ? 'ar-MA' : 'en', {
      hour:'2-digit',
      minute:'2-digit',
      hour12:false,
      timeZone: timezone
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

  {#if loading}
    <div class="space-y-2" aria-busy="true">
      {#each [1,2,3] as _}
        <div class="h-28 animate-pulse rounded-[16px] bg-surface-level-1"></div>
      {/each}
    </div>
  {:else if error}
    <div class="flex items-center justify-between gap-3 py-4">
      <p class="text-sm font-semibold text-danger">{error}</p>
      <button on:click={load} class="min-h-10 text-sm font-bold text-primary">
        {copy.retry}
      </button>
    </div>
  {:else if matches.length === 0}
    <section class="uneem-empty py-12">
      <div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-level-1 text-text-muted">
        <Icon name="users" size={21}/>
      </div>
      <p class="mt-3 font-bold text-text">{copy.empty}</p>
    </section>
  {:else}
    <div class="space-y-2">
      {#each matches as match (match.match_id)}
        {@const usedSpots = Math.min(match.capacity, 1 + match.reserved_spots + match.joined_count)}
        <article class="flex min-h-[112px] items-center gap-4 rounded-[16px] border border-border-light bg-surface p-4">
          <div class="w-[102px] shrink-0">
            <p class="leading-none">
              <span class="text-[28px] font-extrabold tracking-[-0.04em] text-text">
                {timeText(match.starts_at, match.timezone)}
              </span>
              <span class="mt-1 block text-sm font-semibold text-text-muted">
                – {timeText(match.ends_at, match.timezone)}
              </span>
            </p>
            <p class="mt-2 text-[11px] font-semibold text-text-muted">
              {dateText(match.starts_at, match.timezone)}
            </p>
          </div>

          <div class="min-w-0 flex-1 border-s border-border-light ps-4">
            <h2 class="truncate text-base font-bold text-text">{match.pitch_name}</h2>
            <p class="mt-1 flex items-center gap-1.5 truncate text-xs text-text-muted">
              <Icon name="map-pin" size={13}/>
              {match.location}
            </p>
            <p class="mt-1 truncate text-xs text-text-secondary">
              {copy.bookedBy}
              <span class="font-bold text-text">@{match.organizer_username}</span>
            </p>
            <p class="mt-1 text-xs font-bold text-success">
              {usedSpots}/{match.capacity} {copy.players}
            </p>
          </div>

          <a
            href={`/bookings/${match.booking_id}`}
            class="uneem-primary-action min-h-10 min-w-[72px] shrink-0 px-4 text-sm"
          >
            {copy.view}
          </a>
        </article>
      {/each}
    </div>
  {/if}
</main>

<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '$lib/components/Icon.svelte'
  import Button from '$lib/components/Button.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import { language } from '$lib/stores/ui'
  import { listOpenMatches, matchErrorCopy, MatchApiError, type OpenMatch } from '$lib/matchApi'

  let matches: OpenMatch[] = []
  let loading = true
  let refreshing = false
  let error = ''
  let disposed = false
  $: ar = $language === 'ar'
  $: copy = ar ? {
    title: 'المباريات المفتوحة', empty: 'لا توجد مباريات مفتوحة حالياً', emptyHint: 'احجز ملعباً وافتح حجزك للاعبين.',
    view: 'عرض المباراة', players: 'لاعبين', bookedBy: 'المُنظّم', retry: 'إعادة المحاولة', refresh: 'تحديث المباريات',
    browse: 'تصفح الملاعب', joined: 'أنت مشارك', yours: 'حجزك', full: 'مكتملة', available: 'مكان متاح', loading: 'تحميل المباريات'
  } : {
    title: 'Open matches', empty: 'No open matches yet', emptyHint: 'Book a court and open your booking to players.',
    view: 'View match', players: 'players', bookedBy: 'Hosted by', retry: 'Retry', refresh: 'Refresh matches',
    browse: 'Browse courts', joined: 'You’re playing', yours: 'Your booking', full: 'Full', available: 'spots left', loading: 'Loading matches'
  }

  onMount(() => { void load(); return () => { disposed = true } })

  async function load(force = false) {
    if (refreshing) return
    refreshing = true
    loading = matches.length === 0
    error = ''
    try {
      const next = await listOpenMatches(force)
      if (!disposed) matches = next
    } catch (e) {
      if (!disposed) error = matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language)
    } finally {
      if (!disposed) { loading = false; refreshing = false }
    }
  }

  function dateText(value: string, timezone: string) {
    return new Date(value).toLocaleDateString(ar ? 'ar-MA' : 'en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: timezone })
  }
  function timeText(value: string, timezone: string) {
    return new Date(value).toLocaleTimeString(ar ? 'ar-MA' : 'en', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone })
  }
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>

<main class="uneem-page matches-page">
  <header class="uneem-page-header matches-header">
    <h1 class="uneem-title">{copy.title}</h1>
    <button type="button" class="uneem-icon-button" disabled={refreshing} aria-label={copy.refresh} aria-busy={refreshing} on:click={() => void load(true)}>
      <Icon name="refresh-cw" size={20} className={refreshing ? 'animate-spin' : ''} />
    </button>
  </header>

  {#if error}
    <div class="matches-error" role="alert"><p>{error}</p><Button variant="secondary" size="sm" on:click={() => void load(true)}>{copy.retry}</Button></div>
  {/if}
  {#if loading}
    <div class="matches-grid" aria-busy="true" aria-label={copy.loading}>
      {#each [1, 2, 3, 4] as _}
        <div class="match-card match-skeleton" aria-hidden="true">
          <div class="h-4 w-32 animate-pulse rounded bg-surface-level-1"></div>
          <div class="h-7 w-40 animate-pulse rounded bg-surface-level-1"></div>
          <div class="h-5 w-3/4 animate-pulse rounded bg-surface-level-1"></div>
          <div class="h-4 w-1/2 animate-pulse rounded bg-surface-level-1"></div>
          <div class="mt-4 h-12 animate-pulse rounded-[16px] bg-surface-level-1"></div>
        </div>
      {/each}
    </div>
  {:else if matches.length === 0 && !error}
    <section class="match-empty">
      <div class="empty-symbol"><Icon name="users" size={30}/></div>
      <h2>{copy.empty}</h2>
      <p>{copy.emptyHint}</p>
      <ActionLink href="/home" variant="primary" size="lg" fullWidth>{copy.browse}</ActionLink>
    </section>
  {:else if matches.length > 0}
    <div class="matches-grid" aria-busy={refreshing}>
      {#each matches as match (match.match_id)}
        {@const usedSpots = Math.min(match.capacity, Math.max(0, 1 + match.reserved_spots + match.joined_count))}
        <article class="match-card">
          <div class="match-topline">
            <p class="match-date">{dateText(match.starts_at, match.timezone)}</p>
            {#if match.organized_by_me || match.joined_by_me}<span class="match-member"><Icon name="check" size={14} />{match.organized_by_me ? copy.yours : copy.joined}</span>{/if}
          </div>
          <p class="match-time" dir="ltr"><span>{timeText(match.starts_at, match.timezone)}</span><span class="time-end">– {timeText(match.ends_at, match.timezone)}</span></p>
          <div class="match-details">
            <h2>{match.pitch_name}</h2>
            {#if match.location}<p class="match-location"><Icon name="map-pin" size={16}/><span>{match.location}</span></p>{/if}
            <p class="match-host">{copy.bookedBy} <span>{match.organizer_username ? `@${match.organizer_username}` : match.organizer_name}</span></p>
          </div>
          <div class="match-capacity">
            <div class="capacity-copy"><span><Icon name="users" size={16}/>{usedSpots}/{match.capacity} {copy.players}</span><strong class:is-full={match.spots_left <= 0}>{match.spots_left <= 0 ? copy.full : `${match.spots_left} ${copy.available}`}</strong></div>
            <progress value={usedSpots} max={Math.max(1, match.capacity)} aria-label={`${usedSpots}/${match.capacity} ${copy.players}`}></progress>
          </div>
          <ActionLink href={`/bookings/${match.booking_id}`} variant={match.organized_by_me || match.joined_by_me ? 'secondary' : 'primary'} fullWidth>{copy.view}</ActionLink>
        </article>
      {/each}
    </div>
  {/if}
</main>

<style>
  .matches-page { max-width: 64rem; }
  .matches-header { align-items: center; }
  .matches-header h1 { min-width: 0; }
  .matches-header button { flex-shrink: 0; }
  .matches-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .match-card { display: flex; min-width: 0; flex-direction: column; gap: 16px; padding: 20px; border-radius: var(--radius-xl); background: var(--surface); }
  .match-topline { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
  .match-date { color: var(--text-secondary); font-size: 13px; font-weight: 550; }
  .match-member { display: inline-flex; align-items: center; gap: 4px; color: var(--primary); font-size: 12px; font-weight: 600; }
  .match-time { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; width: fit-content; font-size: 30px; line-height: 1.1; font-weight: 650; letter-spacing: -.04em; }
  .time-end { color: var(--text-secondary); font-size: 18px; font-weight: 450; letter-spacing: -.02em; }
  .match-details { min-width: 0; flex: 1; }
  .match-details h2 { font-size: 19px; font-weight: 650; line-height: 1.3; letter-spacing: -.025em; overflow-wrap: anywhere; }
  .match-location { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; color: var(--text-secondary); font-size: 13px; }
  .match-location :global(svg) { margin-top: 2px; }
  .match-host { margin-top: 6px; color: var(--text-muted); font-size: 13px; }
  .match-host span { color: var(--text-secondary); font-weight: 550; unicode-bidi: isolate; }
  .match-capacity { display: grid; gap: 8px; margin-block: 4px; }
  .capacity-copy { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--text-secondary); }
  .capacity-copy span { display: inline-flex; align-items: center; gap: 6px; }
  .capacity-copy strong { color: var(--success); font-weight: 600; }
  .capacity-copy strong.is-full { color: var(--text-muted); }
  progress { display: block; width: 100%; height: 4px; appearance: none; border: 0; overflow: hidden; border-radius: 8px; background: var(--surface-level-1); color: var(--primary); }
  progress::-webkit-progress-bar { background: var(--surface-level-1); }
  progress::-webkit-progress-value { background: var(--primary); border-radius: 8px; }
  progress::-moz-progress-bar { background: var(--primary); border-radius: 8px; }
  .matches-error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; padding: 16px; border-radius: var(--radius-lg); background: var(--danger-light); }
  .matches-error p { flex: 1 1 180px; color: var(--danger); font-size: 14px; }
  .match-empty { display: flex; max-width: 400px; flex-direction: column; align-items: center; gap: 12px; margin: 32px auto; text-align: center; }
  .empty-symbol { display: grid; width: 72px; height: 72px; margin-bottom: 8px; place-items: center; border-radius: 24px; background: var(--surface); color: var(--primary); }
  .match-empty h2 { font-size: 22px; line-height: 1.25; font-weight: 650; letter-spacing: -.025em; }
  .match-empty p { margin-bottom: 12px; color: var(--text-secondary); font-size: 14px; }
  @media (min-width: 760px) { .matches-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; } .match-card { padding: 24px; } }
</style>

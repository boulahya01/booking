<script lang="ts">
  import { onMount } from 'svelte'
  import { language } from '$lib/stores/ui'
  import { listOpenMatches, matchErrorCopy, MatchApiError, type OpenMatch } from '$lib/matchApi'
  import Icon from './Icon.svelte'
  import Button from './Button.svelte'
  import LoadingShape from './LoadingShape.svelte'

  export let standalone = false

  let matches: OpenMatch[] = []
  let loading = true
  let refreshing = false
  let loaded = false
  let error = ''
  let disposed = false
  let now = Date.now()
  let updatedAt = 0
  $: ar = $language === 'ar'
  $: visibleMatches = matches.filter(match => new Date(match.ends_at).getTime() > now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))

  function matchAction(match: OpenMatch) {
    return !match.organized_by_me && !match.joined_by_me && match.spots_left > 0 && Date.parse(match.starts_at) > now
      ? (ar ? 'انضم للمباراة' : 'Join match') : (ar ? 'عرض المباراة' : 'View match')
  }

  onMount(() => {
    void load()
    const refreshVisible = () => {
      now = Date.now()
      if (!document.hidden && navigator.onLine && (!updatedAt || now - updatedAt >= 30_000)) void load(true)
    }
    const timer = window.setInterval(refreshVisible, 30_000)
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener('focus', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible) }
  })

  async function load(force = false) {
    if (refreshing) return
    refreshing = true
    loading = !loaded
    error = ''
    try {
      const next = await listOpenMatches(force)
      if (!disposed) { matches = next; loaded = true; updatedAt = Date.now(); now = updatedAt }
    } catch (e) {
      if (!disposed) error = matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language)
    } finally {
      if (!disposed) { loading = false; refreshing = false }
    }
  }

  function schedule(match: OpenMatch) {
    const date = new Date(match.starts_at)
    const locale = ar ? 'ar-MA' : 'en'
    return {
      day: date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: match.timezone }),
      time: date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: match.timezone })
    }
  }
</script>

<section class="home-matches" class:standalone aria-labelledby="home-matches-heading">
  <header class="matches-heading">
    <div>{#if standalone}<h1 id="home-matches-heading" class="uneem-title">{ar ? 'المباريات المفتوحة' : 'Open matches'}</h1>{:else}<h2 id="home-matches-heading">{ar ? 'المباريات المفتوحة' : 'Open matches'}</h2>{/if}<p>{ar ? 'انضم للاعبين في مباراتك القادمة.' : 'Find players for your next game.'}</p></div>
    <button type="button" class="uneem-icon-button" disabled={refreshing} aria-busy={refreshing} aria-label={ar ? 'تحديث المباريات' : 'Refresh matches'} on:click={() => void load(true)}><Icon name="refresh-cw" size={18} className={refreshing ? 'animate-spin' : ''} /></button>
  </header>
  {#if error}
    <div class="matches-error" role="alert"><p>{error}</p><Button variant="secondary" size="sm" on:click={() => void load(true)}>{ar ? 'إعادة المحاولة' : 'Retry'}</Button></div>
  {/if}
  {#if loading}
    <div class="match-list" aria-busy="true" aria-label={ar ? 'تحميل المباريات' : 'Loading matches'}>
      {#each [1, 2] as row}
        <div class="match-row" aria-hidden="true"><div class="match-copy space-y-2"><LoadingShape className="h-4 w-3/4" /><LoadingShape className="h-3 w-1/2" /><LoadingShape className="h-3 w-24" /></div><LoadingShape className="h-4 w-20" /></div>
      {/each}
    </div>
  {:else if visibleMatches.length > 0}
    <ul class="match-list" aria-busy={refreshing}>
      {#each visibleMatches as match (match.match_id)}
        {@const time = schedule(match)}
        <li>
          <a href={`/bookings/${match.booking_id}`} class="match-row" aria-label={`${matchAction(match)}: ${match.pitch_name}, ${time.day}, ${time.time}`}>
            <div class="match-copy">
              <h3>{match.pitch_name}</h3>
              <p class="match-schedule">{time.day} · <span dir="ltr">{time.time}</span></p>
              <p class="match-spots" class:full={match.spots_left <= 0}>{match.organized_by_me ? (ar ? 'حجزك' : 'Your booking') : match.joined_by_me ? (ar ? 'أنت مشارك' : 'You’re playing') : match.spots_left <= 0 ? (ar ? 'مكتملة' : 'Full') : `${match.spots_left} ${ar ? 'مكان متاح' : 'spots left'}`}</p>
            </div>
            <span class="match-action">{matchAction(match)}<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={16} /></span>
          </a>
        </li>
      {/each}
    </ul>
  {:else if !error}
    <div class="matches-empty"><Icon name="users" size={22} /><div><h3>{ar ? 'لا توجد مباريات مفتوحة حالياً' : 'No open matches yet'}</h3><p>{ar ? 'احجز مرفقاً وادعُ لاعبين للانضمام.' : 'Book a facility and invite players to join.'}</p></div></div>
  {/if}
</section>

<style>
  .home-matches { margin-top: 32px; }
  .home-matches.standalone { margin-top: 0; }
  .matches-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; }
  h2 { font-size: 22px; font-weight: 650; letter-spacing: -.025em; }
  .matches-heading p { margin-top: 4px; color: var(--text-secondary); font-size: 13px; }
  .match-list { overflow: hidden; border-radius: var(--radius-lg); background: var(--surface); }
  .match-list li + li, .match-list > .match-row + .match-row { border-top: 1px solid var(--border-light); }
  .match-row { display: flex; min-height: 104px; align-items: center; gap: 14px; padding: 18px; transition: background var(--motion-fast); }
  a.match-row:hover { background: var(--surface-raised); }
  .match-action { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; color: var(--primary); font-size: 12px; font-weight: 600; }
  .match-copy { flex: 1; min-width: 0; }
  h3 { font-size: 16px; line-height: 1.4; font-weight: 600; overflow-wrap: anywhere; }
  .match-schedule { margin-top: 4px; font-size: 13px; color: var(--text-secondary); }
  .match-spots { margin-top: 5px; font-size: 12px; font-weight: 600; color: var(--success); }
  .match-spots.full { color: var(--text-muted); }
  .matches-empty { display: flex; align-items: flex-start; gap: 14px; padding: 20px; border-radius: var(--radius-lg); background: var(--surface); color: var(--text-secondary); }
  .matches-empty :global(svg) { flex-shrink: 0; margin-top: 3px; }
  .matches-empty h3 { color: var(--text); }
  .matches-empty p { margin-top: 5px; font-size: 13px; line-height: 1.5; }
  .matches-error { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 16px; border-radius: var(--radius-lg); background: var(--danger-light); }
  .matches-error p { flex: 1 1 180px; color: var(--danger); font-size: 14px; }
  @media (prefers-reduced-motion: reduce) { .match-row { transition: none; } }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { language } from '$lib/stores/ui'
  import { getMyBookings, type MyBooking } from '$lib/bookingApi'
  import { listMyMatches, type MyMatch } from '$lib/matchApi'
  import { peekCachedValue } from '$lib/requestCache'
  import { buildActivities, type Activity } from '$lib/activity'
  import Icon from '$lib/components/Icon.svelte'
  import Button from '$lib/components/Button.svelte'
  import LoadingShape from '$lib/components/LoadingShape.svelte'
  const cachedBookings = peekCachedValue<MyBooking[]>('my-bookings')
  const cachedMatches = peekCachedValue<MyMatch[]>('my-matches')
  let bookings = cachedBookings ?? []
  let matches = cachedMatches ?? []
  let loading = cachedBookings === undefined && cachedMatches === undefined
  let refreshing = false
  let error = ''
  let disposed = false
  let now = Date.now()
  $: ar = $language === 'ar'
  $: historyView = $page.url.searchParams.get('view') === 'history'
  $: activities = buildActivities(bookings, matches)
  $: upcoming = activities.filter(item => !item.cancelled && Date.parse(item.endsAt) > now)
  $: history = activities.filter(item => item.cancelled || Date.parse(item.endsAt) <= now).reverse()
  $: rows = historyView ? history : upcoming
  $: next = !historyView ? rows[0] : null

  async function load(force = false) {
    if (refreshing) return
    refreshing = true
    error = ''
    try {
      const results = await Promise.allSettled([
        getMyBookings(undefined, force).then(value => {
          if (!disposed) { bookings = value; loading = false }
        }),
        listMyMatches(force).then(value => {
          if (!disposed) { matches = value; loading = false }
        })
      ])
      if (!disposed && results.some(result => result.status === 'rejected')) {
        error = ar ? 'تعذر تحديث جزء من نشاطك. حاول مجدداً.' : 'Some activity couldn’t be updated. Try again.'
      }
    } finally { if (!disposed) { loading = false; refreshing = false } }
  }
  onMount(() => {
    void load()
    const update = () => { now = Date.now(); if (!document.hidden) void load() }
    document.addEventListener('visibilitychange', update)
    const timer = window.setInterval(() => { now = Date.now() }, 60_000)
    return () => { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', update) }
  })
  function roleLabel(item: Activity) {
    if (item.cancelled) return ar ? 'ملغى' : 'Cancelled'
    if (Date.parse(item.endsAt) <= now) return ar ? 'انتهى' : 'Finished'
    return ({booked: ar ? 'حجزك' : 'Booked', hosting: ar ? 'أنت المنظم' : 'Hosting', joined: ar ? 'أنت مشارك' : 'Joined', reserved: ar ? 'مكانك محجوز' : 'Spot reserved'})[item.role]
  }
  function dateText(item: Activity) {
    return new Intl.DateTimeFormat(ar ? 'ar' : 'en', {weekday:'short',month:'short',day:'numeric',timeZone:item.timezone}).format(new Date(item.startsAt))
  }
  function timeText(item: Activity) {
    return new Intl.DateTimeFormat(ar ? 'ar' : 'en', {hour:'2-digit',minute:'2-digit',hour12:false,timeZone:item.timezone}).format(new Date(item.startsAt))
  }
</script>
<svelte:head><title>{ar ? 'نشاطي' : 'My activity'} · UNEEM</title></svelte:head>
<main class="uneem-page-narrow activity-page">
  <header class="activity-heading"><div><h1 class="uneem-title">{ar ? 'نشاطي' : 'My activity'}</h1><p class="uneem-subtitle">{ar ? 'حجوزاتك والمباريات التي انضممت إليها.' : 'Your bookings and the matches you joined.'}</p></div><a class="uneem-text-action" href="/home">{ar ? 'احجز وقتاً' : 'Book a slot'}<Icon name="plus" size={17}/></a></header>
  <nav class="activity-tabs" aria-label={ar ? 'عرض النشاط' : 'Activity view'}>
    <a href="/bookings" aria-current={!historyView ? 'page' : undefined}>{ar ? 'القادمة' : 'Upcoming'}</a>
    <a href="/bookings?view=history" aria-current={historyView ? 'page' : undefined}>{ar ? 'السجل' : 'History'}</a>
  </nav>
  {#if error}<div class="activity-error" role="alert"><p>{error}</p><Button variant="ghost" size="sm" on:click={() => load(true)}>{ar ? 'إعادة المحاولة' : 'Retry'}</Button></div>{/if}
  {#if loading}
    <div aria-busy="true" aria-label={ar ? 'تحميل النشاط' : 'Loading activity'} class="activity-loading"><LoadingShape className="h-24 w-full rounded-xl"/><LoadingShape className="h-20 w-full rounded-xl"/></div>
  {:else if rows.length === 0 && refreshing}
    <div aria-busy="true" aria-label={ar ? 'تحميل النشاط' : 'Loading activity'} class="activity-loading"><LoadingShape className="h-24 w-full rounded-xl"/></div>
  {:else if rows.length === 0 && !error}
    <div class="activity-empty"><Icon name="calendar" size={30}/><h2>{historyView ? (ar ? 'لا يوجد نشاط سابق' : 'No past activity') : (ar ? 'موعدك القادم ينتظرك' : 'Your next game is waiting')}</h2><p>{historyView ? (ar ? 'سيظهر نشاطك المنتهي هنا.' : 'Finished activities will appear here.') : (ar ? 'احجز وقتاً أو انضم إلى مباراة مفتوحة.' : 'Book a time or join an open match.')}</p>{#if !historyView}<a href="/matches" class="uneem-text-action">{ar ? 'استكشف المباريات' : 'Explore open matches'}<Icon name={ar ? 'arrow-left' : 'arrow-right'} size={17}/></a>{/if}</div>
  {:else}
    {#if next}
      <a href={'/bookings/' + next.id} class="next-activity">
        <p class="activity-eyebrow">{Date.parse(next.startsAt) <= now ? (ar ? 'تلعب الآن' : 'Happening now') : (ar ? 'موعدك القادم' : 'Up next')}</p>
        <h2>{next.title}</h2><p>{dateText(next)} · <bdi>{timeText(next)}</bdi></p>
        <div class="activity-bottom"><span class="activity-role">{roleLabel(next)}</span><span class="next-action">{ar ? 'عرض التفاصيل' : 'View details'}<Icon name={ar ? 'arrow-left' : 'arrow-right'} size={17}/></span></div>
      </a>
    {/if}
    {#if (next ? rows.slice(1) : rows).length}
      <ul class="activity-list">
        {#each (next ? rows.slice(1) : rows) as item (item.id)}
          <li><a href={'/bookings/' + item.id}><Icon name={item.role === 'joined' || item.role === 'reserved' ? 'users' : 'calendar-check'} size={22}/><div class="activity-copy"><h2>{item.title}</h2><p>{dateText(item)} · <bdi>{timeText(item)}</bdi></p><span class="activity-role">{roleLabel(item)}</span></div><Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18}/></a></li>
        {/each}
      </ul>
    {/if}
  {/if}
</main>
<style>
  .activity-page { max-width: 760px; }
  .activity-heading { display: flex; align-items: start; justify-content: space-between; flex-wrap: wrap; gap: 18px; }
  .activity-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--border-light); margin-block: 24px; padding-bottom: 12px; }
  .activity-tabs a { min-height: 44px; padding: 10px 18px; border-radius: 10px; color: var(--text-secondary); font-size: 15px; }
  .activity-tabs a[aria-current='page'] { color: var(--primary); background: var(--primary-light); }
  .next-activity { display: block; padding: 24px; border: 1px solid var(--border); border-radius: 18px; background: var(--surface); }
  .activity-eyebrow { font-size: 14px; color: var(--primary); margin-bottom: 12px; }
  h2 { font-size: 20px; font-weight: 500; line-height: 1.4; }
  .next-activity > p:not(.activity-eyebrow), .activity-copy p { color: var(--text-secondary); font-size: 14px; margin-top: 6px; }
  .activity-bottom { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 24px; }
  .activity-role { display: inline-block; color: var(--text-secondary); font-size: 13px; }
  .next-action { display: inline-flex; align-items: center; gap: 8px; color: var(--primary); font-size: 15px; font-weight: 500; }
  .activity-list { margin-top: 24px; border: 1px solid var(--border-light); border-radius: 16px; overflow: hidden; }
  .activity-list li + li { border-top: 1px solid var(--border-light); }
  .activity-list a { display: flex; align-items: center; gap: 16px; padding: 20px; background: var(--surface); }
  .activity-copy { flex: 1; min-width: 0; }
  .activity-copy h2 { font-size: 17px; }
  .activity-copy .activity-role { margin-top: 6px; }
  .activity-error { display: flex; align-items: center; gap: 16px; padding-block: 12px; font-size: 14px; color: var(--danger); }
  .activity-empty { text-align: center; padding: 48px 16px; color: var(--text-secondary); }
  .activity-empty :global(svg) { margin-inline: auto; }
  .activity-empty h2 { margin-block: 16px 8px; color: var(--text); }
  .activity-empty p { font-size: 15px; margin-bottom: 20px; }
  .activity-loading { display: grid; gap: 20px; }
</style>

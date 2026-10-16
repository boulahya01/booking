<script lang="ts">
  import { onMount } from 'svelte'
  import { authState } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'
  import { listCommunityPlayers, communityError, communitySports, type PlayerProfile } from '$lib/communityApi'
  import Button from '$lib/components/Button.svelte'
  import LoadingShape from '$lib/components/LoadingShape.svelte'
  import Icon from '$lib/components/Icon.svelte'
  let players: PlayerProfile[] = [], query = '', activeQuery = '', loading = true, refreshing = false, error = '', more = false, version = 0
  let now = Date.now()
  $: ar = $language === 'ar'
  async function load(append = false) {
    const request = ++version
    refreshing = true; error = ''
    if (!append) activeQuery = query.trim().replace(/^@/, '').toLowerCase()
    try {
      const rows = await listCommunityPlayers(activeQuery, append ? players.at(-1)?.username : '', true)
      if (request !== version) return
      players = append ? [...players, ...rows] : rows; more = rows.length === 24
    } catch (failure) { if (request === version) error = communityError(failure, ar) }
    finally { if (request === version) { loading = false; refreshing = false } }
  }
  onMount(() => { void load(); const timer = setInterval(() => now = Date.now(), 60_000); return () => { version++; clearInterval(timer) } })
  function sportLabel(value: string, arabic: boolean) { const sport = communitySports.find(item => item.value === value); return sport ? (arabic ? sport.ar : sport.en) : value }
</script>
<svelte:head><title>{ar ? 'اللاعبون' : 'Players'} · UNEEM</title></svelte:head>
<div class="uneem-page-narrow players-page">
  <header class="players-heading"><div><h1 class="uneem-title">{ar ? 'اعثر على رفاق اللعب' : 'Find your next teammates'}</h1><p class="uneem-subtitle">{ar ? 'تعرّف على اللاعبين الذين اختاروا الظهور في المجتمع.' : 'Meet players who choose to be discoverable.'}</p></div>{#if $authState.user?.username && $authState.account?.role !== 'admin'}<a class="uneem-text-action" href={'/community/players/' + $authState.user.username}>{ar ? 'بطاقة اللاعب الخاصة بي' : 'My player card'}</a>{/if}</header>
  <form class="player-search" on:submit|preventDefault={() => load()}><label class="sr-only" for="player-search">{ar ? 'البحث باسم المستخدم' : 'Search username'}</label><input id="player-search" class="uneem-field" bind:value={query} maxlength="24" autocomplete="off" placeholder={ar ? 'ابحث عن @اسم_المستخدم' : 'Search @username'}/><Button variant="secondary" loading={refreshing} type="submit">{ar ? 'بحث' : 'Search'}</Button></form>
  {#if error}<p class="players-error" role="alert">{error}</p>{/if}
  {#if loading}<div class="player-grid" aria-busy="true"><LoadingShape className="h-36 rounded-2xl"/><LoadingShape className="h-36 rounded-2xl"/></div>
  {:else if players.length}<ul class="player-grid">{#each players as player (player.id)}<li><a class="player-card" href={'/community/players/' + player.username}><span class="player-avatar" aria-hidden="true">{player.full_name.charAt(0)}</span><div><h2>{player.full_name}</h2><p><bdi>@{player.username}</bdi></p>{#if player.available_until && Date.parse(player.available_until) > now}<span class="available">{ar ? 'متاح للعب' : 'Available to play'}</span>{/if}</div>{#if player.sports.length}<p class="player-sports">{player.sports.map(value => sportLabel(value, ar)).join(' · ')}</p>{/if}{#if player.bio}<p class="player-bio">{player.bio}</p>{/if}</a></li>{/each}</ul>{#if more}<div class="more-players"><Button variant="secondary" loading={refreshing} on:click={() => load(true)}>{ar ? 'المزيد من اللاعبين' : 'More players'}</Button></div>{/if}
  {:else if !error}<div class="players-empty"><Icon name="users" size={30}/><h2>{activeQuery ? (ar ? 'لم نجد لاعباً مطابقاً' : 'No matching players') : (ar ? 'كن من أوائل اللاعبين هنا' : 'Be one of the first players here')}</h2><p>{ar ? 'يمكنك اختيار الظهور من بطاقة اللاعب الخاصة بك.' : 'Choose to appear here from your player card.'}</p></div>{/if}
</div>
<style>
  .players-page { max-width:760px; } .players-heading { display:flex; justify-content:space-between; align-items:start; gap:18px; flex-wrap:wrap; } .player-search { display:flex; gap:10px; margin-block:24px; } .player-search input { min-width:0; }
  .player-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; } .player-card { display:grid; grid-template-columns:48px 1fr; align-items:center; gap:12px; padding:20px; border:1px solid var(--border-light); background:var(--surface); border-radius:16px; height:100%; }
  .player-avatar { display:grid; place-items:center; width:48px; height:48px; border-radius:50%; background:var(--primary-light); color:var(--primary); font-size:22px; } h2 { font-size:17px; font-weight:500; overflow-wrap:anywhere; } .player-card div p { font-size:13px; color:var(--text-secondary); margin-top:4px; overflow-wrap:anywhere; } .available { display:inline-block; color:var(--success); font-size:12px; margin-top:8px; }
  .player-sports,.player-bio { grid-column:1 / -1; font-size:13px; line-height:1.6; color:var(--text-secondary); overflow-wrap:anywhere; } .players-empty { text-align:center; padding:48px 16px; color:var(--text-secondary); } .players-empty :global(svg) { margin:auto auto 16px; } .players-empty p { font-size:14px; margin-top:8px; } .players-error { color:var(--danger); font-size:14px; margin-block:16px; } .more-players { margin-top:20px; text-align:center; }
  @media(max-width:540px) { .player-grid { grid-template-columns:1fr; } }
</style>

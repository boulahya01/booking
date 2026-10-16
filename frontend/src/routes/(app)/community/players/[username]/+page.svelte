<script lang="ts">
  import { browser } from '$app/environment'
  import { onDestroy, onMount } from 'svelte'
  import { page } from '$app/stores'
  import { authState } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'
  import { getPlayerProfile, updateCommunityProfile, setCommunityBlock, communityError, communitySports, type PlayerProfile } from '$lib/communityApi'
  import { listOpenMatches, type OpenMatch } from '$lib/matchApi'
  import SharedMatchCard from '$lib/components/SharedMatchCard.svelte'
  import Button from '$lib/components/Button.svelte'
  import LoadingShape from '$lib/components/LoadingShape.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import Icon from '$lib/components/Icon.svelte'
  let profile: PlayerProfile | null = null, matches: OpenMatch[] = [], allMatches: OpenMatch[] = []
  let loaded = '', loading = true, error = '', saving = false, bio = '', sports: string[] = [], discoverable = false, available = false, saved = false, inviting = false, blocking = false, version = 0, now = Date.now()
  $: ar = $language === 'ar'
  $: own = profile?.id === $authState.user?.id
  $: if (browser && $page.params.username && $page.params.username !== loaded) { loaded = $page.params.username; void load(loaded) }
  async function load(username: string) {
    const request = ++version
    loading = true; error = ''; profile = null; matches = []; allMatches = []; saved = false; saving = false; blocking = false; inviting = false
    try {
      const result = await getPlayerProfile(username, true)
      if (request !== version) return
      profile = result
      if (result) {
        bio = result.bio; sports = result.sports; discoverable = result.discoverable; available = !!result.available_until && Date.parse(result.available_until) > now
        void listOpenMatches().then(rows => { if (request === version) { allMatches = rows; matches = rows.filter(row => row.organizer_id === result.id) } }).catch(() => undefined)
      }
    } catch (failure) { if (request === version) error = communityError(failure, ar) }
    finally { if (request === version) loading = false }
  }
  async function save() {
    if (saving) return
    const request = version
    saving = true; saved = false; error = ''
    try { const result = await updateCommunityProfile(bio, sports, discoverable, available); if (request === version) { profile = result; saved = true } }
    catch (failure) { if (request === version) error = communityError(failure, ar) } finally { if (request === version) saving = false }
  }
  async function block() {
    if (!profile || blocking) return
    const request = version
    blocking = true
    try { await setCommunityBlock(profile.id, !profile.blocked); if (request === version && profile) profile = { ...profile, blocked: !profile.blocked } }
    catch (failure) { if (request === version) error = communityError(failure, ar) } finally { if (request === version) blocking = false }
  }
  onMount(() => { const timer = setInterval(() => now = Date.now(), 60_000); return () => clearInterval(timer) })
  onDestroy(() => { version++ })
</script>
<svelte:head><title>{profile ? '@' + profile.username : (ar ? 'بطاقة اللاعب' : 'Player card')} · UNEEM</title></svelte:head>
<div class="uneem-page-narrow player-profile">
  <a href="/community/players" class="uneem-text-action profile-back"><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={17}/>{ar ? 'اللاعبون' : 'Players'}</a>
  {#if error}<div class="profile-error" role="alert">{error}{#if !profile}<Button variant="ghost" on:click={() => load(loaded)}>{ar ? 'إعادة المحاولة' : 'Retry'}</Button>{/if}</div>{/if}
  {#if loading}<LoadingShape className="h-52 rounded-2xl"/>
  {:else if profile}
    <header class="player-heading"><span class="player-avatar" aria-hidden="true">{profile.full_name.charAt(0)}</span><div><p class="profile-eyebrow">{own ? (ar ? 'بطاقة اللاعب الخاصة بك' : 'Your player card') : (ar ? 'لاعب في المجتمع' : 'Community player')}</p><h1 class="uneem-title">{profile.full_name}</h1><p class="username"><bdi>@{profile.username}</bdi></p>{#if profile.available_until && Date.parse(profile.available_until) > now}<p class="available">{ar ? 'متاح للعب' : 'Available to play'}</p>{/if}</div></header>
    {#if own}
      <form class="player-editor" on:submit|preventDefault={save}>
        <h2>{ar ? 'تواصل مع رفاق اللعب' : 'Connect with teammates'}</h2><p class="field-note">{ar ? 'البريد الإلكتروني ورقم الطالب وسجل الحجوزات الخاص لا تظهر في بطاقة اللاعب.' : 'Your email, student ID, and private booking history stay off your player card.'}</p>
        <label class="check-row"><input type="checkbox" bind:checked={discoverable} disabled={saving}/><span>{ar ? 'إظهاري في اكتشاف اللاعبين' : 'Show me in player discovery'}</span></label>
        <label class="check-row"><input type="checkbox" bind:checked={available} disabled={saving}/><span>{ar ? 'متاح للعب خلال الساعات الأربع القادمة' : 'Available to play for the next 4 hours'}</span></label>
        <label class="bio-field">{ar ? 'نبذة قصيرة' : 'Short bio'}<textarea bind:value={bio} class="uneem-field" maxlength="240" rows="3" disabled={saving}></textarea></label>
        <fieldset><legend>{ar ? 'رياضاتك المفضلة' : 'Sports you enjoy'}</legend><div class="sport-options">{#each communitySports as sport}<label><input type="checkbox" bind:group={sports} value={sport.value} disabled={saving}/>{ar ? sport.ar : sport.en}</label>{/each}</div></fieldset>
        <div class="editor-actions"><Button type="submit" loading={saving}>{ar ? 'حفظ بطاقة اللاعب' : 'Save player card'}</Button>{#if saved}<p role="status">{ar ? 'تم حفظ بطاقة اللاعب.' : 'Player card saved.'}</p>{/if}</div>
      </form>
    {:else}
      {#if profile.bio}<p class="player-bio">{profile.bio}</p>{/if}
      {#if profile.sports.length}<div class="sport-tags">{#each profile.sports as value}<span>{ar ? communitySports.find(s => s.value === value)?.ar || value : communitySports.find(s => s.value === value)?.en || value}</span>{/each}</div>{/if}
      <div class="player-actions">{#if !profile.blocked}<Button on:click={() => inviting = true}>{ar ? 'دعوة إلى مباراة' : 'Invite to a match'}</Button>{/if}<Button variant="secondary" loading={blocking} on:click={block}>{profile.blocked ? (ar ? 'إلغاء حظر اللاعب' : 'Unblock player') : (ar ? 'حظر اللاعب' : 'Block player')}</Button><a class="uneem-text-action" href={'/report/user/' + profile.id}>{ar ? 'إبلاغ' : 'Report'}</a></div>
      {#if profile.blocked}<p class="field-note">{ar ? 'ستُخفى رسائل هذا اللاعب. أماكن المباريات لا تتغير.' : 'This player’s messages are hidden. Match places stay unchanged.'}</p>{/if}
    {/if}
    {#if matches.length}<section class="profile-matches"><h2>{ar ? 'مباريات مفتوحة' : 'Open matches'}</h2>{#each matches as match}<SharedMatchCard match={match}/>{/each}</section>{/if}
  {:else if !error}<h1 class="uneem-title">{ar ? 'لم نجد اللاعب' : 'Player not found'}</h1>{/if}
</div>
{#if inviting && profile}<Modal bind:open={inviting} title={ar ? 'دعوة في ساحة المجتمع' : 'Invite in the lobby'}><p class="field-note">{ar ? 'اختر مباراة مفتوحة. ستكون دعوتك مرئية للمجتمع.' : 'Choose an open match. Your invitation will be visible to the community.'}</p><div class="invite-list">{#each allMatches as match}<a href={'/community?share=' + match.booking_id + '&to=' + encodeURIComponent(profile.username)}>{match.pitch_name}<Icon name={ar ? 'arrow-left' : 'arrow-right'} size={16}/></a>{:else}<p>{ar ? 'لا توجد مباريات مفتوحة حالياً.' : 'No open matches right now.'}</p><a href="/home">{ar ? 'احجز مرفقاً' : 'Book a facility'}</a>{/each}</div></Modal>{/if}
<style>
  .player-profile { max-width:720px; } .profile-back { margin-bottom:24px; } .player-heading { display:flex; align-items:center; gap:20px; margin-bottom:28px; } .player-avatar { display:grid; place-items:center; width:76px; height:76px; flex-shrink:0; border-radius:50%; background:var(--primary-light); color:var(--primary); font-size:34px; }
  .profile-eyebrow { color:var(--primary); font-size:13px; margin-bottom:8px; } .username { font-size:14px; color:var(--text-secondary); margin-top:8px; overflow-wrap:anywhere; } .available { color:var(--success); font-size:13px; margin-top:10px; }
  h2 { font-size:20px; font-weight:500; } .player-editor { padding:24px; border:1px solid var(--border-light); border-radius:18px; background:var(--surface); } .field-note { font-size:13px; line-height:1.65; color:var(--text-secondary); margin-block:12px 20px; }
  .check-row { display:flex; align-items:center; gap:12px; min-height:48px; font-size:14px; } input[type=checkbox] { width:18px; height:18px; border-radius:5px; color:var(--primary); flex-shrink:0; } .bio-field { display:grid; gap:10px; font-size:14px; margin-block:20px; } textarea { resize:vertical; } legend { font-size:14px; margin-bottom:12px; } .sport-options { display:flex; flex-wrap:wrap; gap:10px 20px; } .sport-options label { display:flex; align-items:center; gap:8px; min-height:44px; font-size:13px; }
  .editor-actions { display:flex; align-items:center; flex-wrap:wrap; gap:14px; margin-top:24px; } .editor-actions p { color:var(--success); font-size:14px; } .player-bio { white-space:pre-wrap; overflow-wrap:anywhere; font-size:16px; line-height:1.7; } .sport-tags { display:flex; flex-wrap:wrap; gap:8px; margin-block:20px; } .sport-tags span { font-size:13px; background:var(--surface); padding:10px 14px; border-radius:10px; } .player-actions { display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-top:24px; }
  .profile-matches { display:grid; gap:14px; margin-top:32px; } .profile-error { display:flex; align-items:center; gap:14px; color:var(--danger); font-size:14px; padding-block:16px; } .invite-list { display:grid; gap:10px; } .invite-list a { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:14px; border-radius:12px; background:var(--surface-level-1); font-size:14px; }
  @media(max-width:400px) { .player-heading { gap:14px; } .player-avatar { width:58px; height:58px; font-size:28px; } .player-editor { padding:18px; } }
</style>

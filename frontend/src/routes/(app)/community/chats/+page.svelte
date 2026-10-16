<script lang="ts">
  import { onMount } from 'svelte'
  import { language } from '$lib/stores/ui'
  import { setCommunityRooms } from '$lib/stores/community'
  import { listCommunityChats, communityError, type CommunityRoom } from '$lib/communityApi'
  import { peekCachedValue } from '$lib/requestCache'
  import Button from '$lib/components/Button.svelte'
  import LoadingShape from '$lib/components/LoadingShape.svelte'
  import Icon from '$lib/components/Icon.svelte'
  let chats: CommunityRoom[] = peekCachedValue<CommunityRoom[]>('community:chats') || []
  let loading = chats.length === 0, busy = false, error = '', disposed = false
  $: ar = $language === 'ar'
  async function load() {
    if (busy) return
    busy = true; error = ''
    try { const rows = await listCommunityChats(true); if (!disposed) { chats = rows; setCommunityRooms(rows) } }
    catch (failure) { if (!disposed) error = communityError(failure, ar) } finally { if (!disposed) { loading = false; busy = false } }
  }
  onMount(() => { void load(); const wake = () => { if (!document.hidden) void load() }; document.addEventListener('visibilitychange', wake); return () => { disposed = true; document.removeEventListener('visibilitychange', wake) } })
</script>
<svelte:head><title>{ar ? 'المحادثات' : 'Chats'} · UNEEM</title></svelte:head>
<div class="uneem-page-narrow chats-page"><header class="chats-heading"><div><h1 class="uneem-title">{ar ? 'محادثات المباريات' : 'Your match conversations'}</h1><p class="uneem-subtitle">{ar ? 'خطط مع اللاعبين الذين انضممت إليهم.' : 'Make plans with the players you joined.'}</p></div><button class="uneem-icon-button" disabled={busy} type="button" on:click={load} aria-label={ar ? 'تحديث المحادثات' : 'Refresh conversations'}><Icon name="refresh-cw" size={19}/></button></header>
{#if error}<div class="chat-error" role="alert">{error}<Button variant="ghost" on:click={load}>{ar ? 'إعادة المحاولة' : 'Retry'}</Button></div>{/if}
{#if loading}<div class="chat-list" aria-busy="true"><LoadingShape className="h-24 rounded-xl"/><LoadingShape className="h-24 rounded-xl"/></div>{:else if chats.length}<ul class="chat-list">{#each chats as chat}<li><a href={'/community/chats/' + chat.booking_id}><span class="chat-icon"><Icon name={chat.muted ? 'bell-off' : 'message-circle'} size={23}/></span><div><h2>{chat.title}</h2><p>{chat.starts_at ? new Date(chat.starts_at).toLocaleString(ar ? 'ar' : 'en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: chat.timezone }) : ''}</p>{#if !chat.can_send}<span>{ar ? 'للقراءة فقط' : 'Read-only'}</span>{/if}</div>{#if chat.unread && !chat.muted}<span class="unread" aria-label={ar ? 'رسائل غير مقروءة' : 'Unread messages'}>{chat.unread}</span>{/if}<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={17}/></a></li>{/each}</ul>{:else if !error}<div class="chats-empty"><Icon name="message-circle" size={30}/><h2>{ar ? 'فريقك القادم ينتظرك' : 'Your next team is waiting'}</h2><p>{ar ? 'انضم إلى مباراة لفتح محادثة اللاعبين.' : 'Join a match to open its player conversation.'}</p><a class="uneem-text-action" href="/matches">{ar ? 'استكشف المباريات المفتوحة' : 'Explore open matches'}</a></div>{/if}</div>
<style>.chats-page { max-width:760px; }.chats-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; }.chat-list { display:grid; gap:12px; margin-top:28px; }.chat-list a { display:flex; align-items:center; gap:16px; padding:20px; background:var(--surface); border:1px solid var(--border-light); border-radius:16px; }.chat-icon { color:var(--primary); }.chat-list a > div { flex:1; min-width:0; }h2 { font-size:17px; font-weight:500; overflow-wrap:anywhere; }.chat-list p,.chat-list div > span { font-size:13px; color:var(--text-secondary); margin-top:6px; }.unread { color:var(--primary); background:var(--primary-light); border-radius:20px; padding:4px 9px; font-size:12px; }.chat-error { display:flex; align-items:center; gap:12px; font-size:14px; color:var(--danger); margin-top:20px; }.chats-empty { text-align:center; padding:48px 16px; color:var(--text-secondary); }.chats-empty :global(svg) { margin:auto auto 16px; }.chats-empty p { margin-block:12px 20px; font-size:14px; }</style>

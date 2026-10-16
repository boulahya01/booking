<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { get } from 'svelte/store'
  import { authState, isAdmin } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'
  import { communityDrafts, setCommunityRoomUnread } from '$lib/stores/community'
  import { getBookingDetails } from '$lib/bookingApi'
  import { listOpenMatches, type OpenMatch } from '$lib/matchApi'
  import { peekCachedValue, setCachedValue, invalidateRequestCache } from '$lib/requestCache'
  import { CommunityError, communityError, getCommunityRoom, listCommunityMessages, getCommunityMessage, sendCommunityMessage, updateCommunityRead, subscribeCommunity, hideCommunityMessage, type CommunityMessage, type CommunityRoom, type SharedMatch } from '$lib/communityApi'
  import SharedMatchCard from './SharedMatchCard.svelte'
  import LoadingShape from './LoadingShape.svelte'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'
  export let bookingId: string | null = null
  export let shareId: string | null = null
  export let mention: string | null = null
  const owner = get(authState).user!.id
  const draftKey = owner + ':' + (bookingId || 'lobby')
  const saved = communityDrafts.get(draftKey)
  let body = saved?.body || (mention && /^[a-z0-9_]{3,24}$/.test(mention) ? '@' + mention + ' ' : '')
  let attachment: SharedMatch | null = null
  let pending: { body: string; clientId: string; sharedBookingId: string | null } | null = saved?.clientId ? { body, clientId: saved.clientId, sharedBookingId: saved.sharedBookingId || null } : null
  let messages: CommunityMessage[] = bookingId ? [] : peekCachedValue<CommunityMessage[]>('community:messages:lobby') || []
  let room: CommunityRoom | null = null, error = '', loading = messages.length === 0, sending = false, older = false, more = false, muting = false
  let picker = false, choices: OpenMatch[] = [], picking = false, loadedShare = '', mounted = false, disposed = false, syncing = false
  let list: HTMLDivElement, composer: HTMLTextAreaElement
  let unsubscribe: (() => void) | null = null
  let snapshotVersion = 0
  const hiddenIds = new Set<string>()
  let readTimer: ReturnType<typeof setTimeout> | null = null
  $: ar = $language === 'ar'
  $: if (mounted && (shareId || saved?.sharedBookingId) && loadedShare !== (shareId || saved?.sharedBookingId)) void attach(shareId || saved!.sharedBookingId!)
  const current = () => !disposed && get(authState).user?.id === owner
  function merge(rows: CommunityMessage[]) {
    const all = new Map(messages.map(row => [row.id, row]))
    rows.forEach(row => { if (!hiddenIds.has(row.id)) all.set(row.id, row) })
    messages = [...all.values()].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0)
    invalidateRequestCache('community:messages:' + (bookingId || 'lobby'))
    setCachedValue('community:messages:' + (bookingId || 'lobby'), messages.slice(-30), 10_000)
  }
  function nearBottom() { return !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80 }
  async function bottom() { await tick(); if (current() && list) { list.scrollTop = list.scrollHeight; markRead() } }
  function markRead() {
    if (!room || document.hidden || !nearBottom() || !messages.length) return
    const last = messages.at(-1)!.id
    if (BigInt(last) <= BigInt(room.last_read)) return
    if (readTimer) clearTimeout(readTimer)
    readTimer = setTimeout(() => {
      if (current()) void updateCommunityRead(bookingId, last).then(() => {
        if (!current() || !room) return
        if (BigInt(last) > BigInt(room.last_read)) room = { ...room, last_read: last }
        setCommunityRoomUnread(bookingId, messages.filter(row => BigInt(row.id) > BigInt(room!.last_read) && row.sender_id !== owner).length, room.muted)
      }).catch(() => undefined)
    }, 350)
  }
  function fail(failure: unknown) {
    if (!current()) return
    error = communityError(failure, ar)
    if (failure instanceof CommunityError && ['community_access_required', 'authentication_required', 'account_not_approved'].includes(failure.code)) { messages = []; room = null; unsubscribe?.(); unsubscribe = null }
  }
  function ensureSubscription() {
    if (current() && room && !unsubscribe) unsubscribe = subscribeCommunity(bookingId, id => void receive(id), () => void catchUp())
  }
  async function initialize() {
    const request = ++snapshotVersion
    error = ''
    const results = await Promise.allSettled([
      getCommunityRoom(bookingId).then(value => { if (current() && request === snapshotVersion) { room = value; ensureSubscription() } }),
      listCommunityMessages(bookingId, undefined, undefined, true).then(value => {
        if (current() && request === snapshotVersion) { messages = value.filter(row => !hiddenIds.has(row.id)); more = value.length === 30; loading = false; void bottom() }
      })
    ])
    if (!current() || request !== snapshotVersion) return
    loading = false
    for (const result of results) if (result.status === 'rejected') fail(result.reason)
    ensureSubscription()
  }
  async function catchUp() {
    if (syncing || !current()) return
    syncing = true
    const stayAtBottom = nearBottom()
    try {
      const context = await getCommunityRoom(bookingId)
      if (!current()) return
      room = context
      // Bound each request and catch up in order without skipping a reconnect gap.
      for (let page = 0; page < 20 && current(); page++) {
        const rows = await listCommunityMessages(bookingId, undefined, messages.at(-1)?.id, true)
        if (!current()) return
        merge(rows)
        if (rows.length < 30) break
      }
      if (stayAtBottom) void bottom()
    } catch (failure) { fail(failure) } finally { syncing = false }
  }
  async function receive(id: string) {
    const stayAtBottom = nearBottom()
    try {
      const row = await getCommunityMessage(id)
      if (!current()) return
      if (row && row.booking_id === bookingId) {
        snapshotVersion++; loading = false; merge([row])
        if (room) setCommunityRoomUnread(bookingId, messages.filter(item => BigInt(item.id) > BigInt(room!.last_read) && item.sender_id !== owner).length, room.muted)
      }
      else { snapshotVersion++; hiddenIds.add(id); messages = messages.filter(item => item.id !== id); merge([]) }
      if (stayAtBottom) void bottom()
    } catch (failure) { fail(failure) }
  }
  async function loadOlder() {
    if (older || !messages.length) return
    older = true
    const height = list?.scrollHeight || 0
    try {
      const rows = await listCommunityMessages(bookingId, messages[0].id)
      if (!current()) return
      more = rows.length === 30; merge(rows)
      await tick(); if (list) list.scrollTop += list.scrollHeight - height
    } catch (failure) { fail(failure) } finally { older = false }
  }
  async function send() {
    if (sending || !room?.can_send || (!body.trim() && !pending)) return
    sending = true; error = ''
    pending ||= { body: body.trim(), clientId: crypto.randomUUID(), sharedBookingId: attachment?.booking_id || null }
    try {
      const row = await sendCommunityMessage({ ...pending, bookingId })
      if (!current()) return
      snapshotVersion++; loading = false; merge([row]); body = ''; attachment = null; pending = null; communityDrafts.delete(draftKey)
      await bottom(); composer?.focus()
    } catch (failure) {
      if (failure instanceof CommunityError && failure.code !== 'network') pending = null
      fail(failure)
    } finally { sending = false }
  }
  async function attach(id: string) {
    loadedShare = id
    if (!/^[0-9a-f-]{36}$/i.test(id)) return
    try {
      const details = await getBookingDetails(id, true)
      if (!current()) return
      if (!details?.match_open || details.booking_status !== 'scheduled' || Date.parse(details.ends_at) <= Date.now()) throw new CommunityError('community_match_not_open')
      attachment = details
      if (!body.trim()) body = ar ? 'انضموا إلينا في هذه المباراة.' : 'Join us for this match.'
    } catch (failure) { fail(failure) }
  }
  async function openPicker() {
    picker = !picker
    if (!picker) return
    picking = true
    try { const rows = await listOpenMatches(true); if (current()) choices = rows } catch (failure) { fail(failure) } finally { picking = false }
  }
  async function mute() {
    if (!room || muting) return
    muting = true
    try { await updateCommunityRead(bookingId, undefined, !room.muted); if (current() && room) { room = { ...room, muted: !room.muted }; setCommunityRoomUnread(bookingId, messages.filter(item => BigInt(item.id) > BigInt(room!.last_read) && item.sender_id !== owner).length, room.muted) } } catch (failure) { fail(failure) } finally { muting = false }
  }
  async function hide(id: string) {
    try { await hideCommunityMessage(id); if (current()) { snapshotVersion++; hiddenIds.add(id); messages = messages.filter(row => row.id !== id); merge([]) } } catch (failure) { fail(failure) }
  }
  onMount(() => {
    mounted = true; void initialize()
    const wake = () => { if (!document.hidden) void initialize() }
    document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake)
    return () => {
      if (get(authState).user?.id === owner && (body.trim() || pending)) communityDrafts.set(draftKey, { body, clientId: pending?.clientId, sharedBookingId: pending?.sharedBookingId || attachment?.booking_id })
      disposed = true; unsubscribe?.(); if (readTimer) clearTimeout(readTimer)
      document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake)
    }
  })
</script>
<section class="community-thread" aria-label={bookingId ? (ar ? 'محادثة المباراة' : 'Match conversation') : (ar ? 'ساحة المجتمع' : 'Community lobby')}>
  <header class="thread-heading"><div><h2>{bookingId ? (room?.title || (ar ? 'محادثة المباراة' : 'Match chat')) : (ar ? 'الساحة' : 'Lobby')}</h2><p>{bookingId ? (ar ? 'للمنظم واللاعبين المسجلين.' : 'For the organizer and registered players.') : (ar ? 'ساحة مشتركة للاعبين المعتمدين.' : 'A shared space for verified players.')}</p></div>{#if room}<button class="uneem-icon-button" type="button" disabled={muting} on:click={mute} aria-label={room.muted ? (ar ? 'إلغاء كتم المحادثة' : 'Unmute conversation') : (ar ? 'كتم المحادثة' : 'Mute conversation')}><Icon name={room.muted ? 'bell-off' : 'bell'} size={19}/></button>{/if}</header>
  {#if error}<div class="thread-error" role="alert"><p>{error}</p>{#if !pending}<Button variant="ghost" size="sm" on:click={initialize}>{ar ? 'إعادة المحاولة' : 'Retry'}</Button>{/if}</div>{/if}
  <div class="message-list" bind:this={list} on:scroll={markRead} role="log" aria-live="polite" aria-relevant="additions" aria-busy={loading} aria-label={ar ? 'الرسائل' : 'Messages'}>
    {#if loading}<div class="thread-placeholder"><LoadingShape className="h-16 w-3/4 rounded-xl"/><LoadingShape className="h-16 w-3/4 rounded-xl"/></div>
    {:else}
      {#if more}<Button variant="ghost" size="sm" loading={older} on:click={loadOlder}>{ar ? 'رسائل أقدم' : 'Older messages'}</Button>{/if}
      {#each messages as message (message.id)}
        <article class="community-message" class:own={message.sender_id === owner}>
          <div class="message-meta"><a href={'/community/players/' + message.username}><bdi>@{message.username}</bdi></a><time datetime={message.created_at}>{new Date(message.created_at).toLocaleTimeString(ar ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit', hour12: false })}</time></div>
          <p class="message-body" dir="auto">{message.body}</p>
          {#if message.shared_booking_id}<SharedMatchCard match={message.shared_match}/>{/if}
          <div class="message-tools">{#if message.sender_id !== owner}<a href={'/report/user/' + message.sender_id + '?message=' + message.id}>{ar ? 'إبلاغ' : 'Report'}</a>{/if}{#if $isAdmin}<button type="button" on:click={() => hide(message.id)}>{ar ? 'إخفاء الرسالة' : 'Hide message'}</button>{/if}</div>
        </article>
      {/each}
      {#if !messages.length && !error}<div class="thread-empty"><Icon name="message-circle" size={28}/><h3>{ar ? 'من يريد اللعب؟' : 'Who’s up for a game?'}</h3><p>{ar ? 'شارك مباراة مفتوحة أو اقترح رياضة وموعداً.' : 'Share an open match or suggest a sport and time.'}</p></div>{/if}
    {/if}
  </div>
  {#if room?.can_send}
    <form class="thread-composer" on:submit|preventDefault={send}>
      {#if attachment}<div class="attachment"><SharedMatchCard match={attachment}/><button disabled={!!pending} type="button" class="uneem-icon-button" aria-label={ar ? 'إزالة المباراة' : 'Remove match'} on:click={() => attachment = null}><Icon name="x" size={17}/></button></div>{/if}
      {#if picker}<div class="match-picker"><h3>{ar ? 'اختر مباراة مفتوحة' : 'Choose an open match'}</h3>{#if picking}<p>{ar ? 'جارٍ تحميل المباريات…' : 'Loading matches…'}</p>{:else}{#each choices as choice}<button type="button" on:click={() => { void attach(choice.booking_id); picker = false }}>{choice.pitch_name}<span>{new Date(choice.starts_at).toLocaleString(ar ? 'ar' : 'en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: choice.timezone })}</span></button>{:else}<p>{ar ? 'لا توجد مباريات مفتوحة حالياً.' : 'No open matches right now.'}</p><a href="/home">{ar ? 'احجز مرفقاً' : 'Book a facility'}</a>{/each}{/if}</div>{/if}
      <label class="sr-only" for={'community-message-' + (bookingId || 'lobby')}>{ar ? 'رسالتك' : 'Your message'}</label>
      <textarea bind:this={composer} bind:value={body} disabled={!!pending} id={'community-message-' + (bookingId || 'lobby')} class="uneem-field" maxlength="1000" rows="2" placeholder={ar ? 'ما خطتك للمباراة القادمة؟' : 'What’s the plan for your next game?'}></textarea>
      <div class="composer-actions"><button class="attach-match" type="button" disabled={!!pending} aria-expanded={picker} on:click={openPicker}><Icon name="plus" size={17}/>{ar ? 'مشاركة مباراة' : 'Share match'}</button><Button type="submit" size="sm" loading={sending} loadingLabel={ar ? 'جارٍ الإرسال…' : 'Sending…'} disabled={!body.trim() && !pending}>{pending && !sending ? (ar ? 'إعادة الإرسال بأمان' : 'Retry send') : (ar ? 'إرسال' : 'Send')}<Icon name="send" size={15}/></Button></div>
      {#if !bookingId}<p class="composer-note">{ar ? 'الرسائل ظاهرة للمجتمع. يُحجز المكان فقط عند تأكيد الانضمام.' : 'Messages are visible to the community. Only a confirmed join reserves a place.'}</p>{/if}
    </form>
  {:else if room}<p class="read-only">{ar ? 'المحادثة للقراءة فقط.' : 'This conversation is read-only.'}</p>{/if}
</section>
<style>
  .community-thread { border:1px solid var(--border-light); border-radius:18px; background:var(--surface); overflow:hidden; }
  .thread-heading { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:18px 20px; border-bottom:1px solid var(--border-light); }
  h2 { font-size:18px; font-weight:500; } .thread-heading p { font-size:13px; color:var(--text-secondary); margin-top:5px; }
  .message-list { display:flex; flex-direction:column; gap:18px; max-height:55dvh; min-height:260px; padding:22px 20px; overflow:auto; overscroll-behavior:contain; scrollbar-width:thin; }
  .community-message { align-self:flex-start; width:min(92%,540px); border-radius:14px; background:var(--surface-level-1); padding:14px 16px; }
  .community-message.own { align-self:flex-end; background:var(--primary-light); }
  .message-meta { display:flex; align-items:center; justify-content:space-between; gap:16px; font-size:12px; } .message-meta a { color:var(--primary); font-weight:500; } time { color:var(--text-muted); font-size:11px; }
  .message-body { font-size:15px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; margin-block:8px; }
  .message-tools { display:flex; gap:14px; justify-content:flex-end; font-size:11px; color:var(--text-muted); margin-top:8px; } .message-tools button,.message-tools a { min-height:24px; }
  .thread-placeholder { display:grid; gap:22px; } .thread-empty { margin:auto; text-align:center; padding:32px 12px; color:var(--text-secondary); } .thread-empty :global(svg) { margin:0 auto 12px; } h3 { font-weight:500; font-size:16px; } .thread-empty p { margin-top:8px; font-size:14px; line-height:1.6; }
  .thread-error { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 20px; font-size:14px; color:var(--danger); background:var(--danger-light); }
  .thread-composer { padding:16px 20px; border-top:1px solid var(--border-light); } textarea { resize:vertical; min-height:80px; font-size:15px; }
  .composer-actions { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:10px; } .attach-match { display:flex; align-items:center; gap:6px; min-height:44px; font-size:13px; color:var(--primary); }
  .composer-note,.read-only { font-size:12px; color:var(--text-muted); line-height:1.6; margin-top:10px; } .read-only { padding:16px 20px; }
  .attachment { display:flex; align-items:center; gap:8px; margin-bottom:12px; } .attachment :global(.shared-match) { flex:1; min-width:0; }
  .match-picker { display:grid; gap:8px; margin-bottom:16px; } .match-picker button { display:flex; justify-content:space-between; gap:12px; text-align:start; font-size:14px; padding:12px; border-radius:10px; background:var(--surface-level-1); } .match-picker span,.match-picker p { font-size:12px; color:var(--text-secondary); }
  @media(max-width:480px) { .thread-heading,.thread-composer { padding:16px; } .message-list { padding:18px 12px; } .community-message { width:96%; padding:12px; } }
  @media(max-width:640px) { .message-tools button,.message-tools a { display:inline-flex; align-items:center; min-height:44px; } }
</style>

<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { language } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'
  import Button from '$lib/components/Button.svelte'
  import SegmentedControl from '$lib/components/SegmentedControl.svelte'
  import {
    adminReplySupportThread,
    adminSetSupportStatus,
    getAdminSupportMessages,
    getAdminSupportThreadContext,
    listAdminSupportThreads,
    type AdminSupportThreadContext,
    type SupportMessage,
    type SupportThreadSummary
  } from '$lib/supportApi'

  type InboxFilter = 'active' | 'resolved'

  let filter: InboxFilter = 'active'
  let threads: SupportThreadSummary[] = []
  let selected: SupportThreadSummary | null = null
  let context: AdminSupportThreadContext | null = null
  let messages: SupportMessage[] = []
  let loading = true
  let loadingMessages = false
  let refreshing = false
  let saving = false
  let error = ''
  let reply = ''
  let messagesElement: HTMLDivElement | null = null

  $: ar = $language === 'ar'
  $: visibleThreads = threads.filter((item) => filter === 'resolved' ? item.status === 'resolved' : item.status !== 'resolved')
  $: copy = ar ? {
    title: 'الدعم', active: 'النشطة', resolved: 'المحلولة', empty: 'لا توجد محادثات',
    guest: 'زائر', user: 'مستخدم', report: 'بلاغ', support: 'دعم', appeal: 'مراجعة الحساب',
    needsReply: 'بحاجة إلى رد', waiting: 'في انتظار المستخدم', resolvedStatus: 'تم الحل',
    back: 'العودة إلى المحادثات', resolve: 'حل', reopen: 'إعادة الفتح',
    placeholder: 'اكتب الرد…', send: 'إرسال', generic: 'تعذر إكمال العملية.',
    context: 'السياق', target: 'النوع', reason: 'السبب'
  } : {
    title: 'Support', active: 'Active', resolved: 'Resolved', empty: 'No conversations',
    guest: 'Guest', user: 'User', report: 'Report', support: 'Support', appeal: 'Account review',
    needsReply: 'Needs reply', waiting: 'Waiting for user', resolvedStatus: 'Resolved',
    back: 'Back to conversations', resolve: 'Resolve', reopen: 'Reopen',
    placeholder: 'Write a reply…', send: 'Send', generic: 'Couldn’t complete that action.',
    context: 'Context', target: 'Target', reason: 'Reason'
  }
  $: filterOptions = [
    { value: 'active', label: copy.active },
    { value: 'resolved', label: copy.resolved }
  ]

  onMount(() => {
    void loadThreads()
    const refreshVisible = () => { if (document.visibilityState === 'visible') void refreshInbox() }
    document.addEventListener('visibilitychange', refreshVisible)
    window.addEventListener('online', refreshVisible)
    const timer = window.setInterval(refreshVisible, 6000)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshVisible); window.removeEventListener('online', refreshVisible) }
  })

  function statusLabel(status: string) {
    if (status === 'resolved') return copy.resolvedStatus
    if (status === 'waiting') return copy.waiting
    return copy.needsReply
  }

  function kindLabel(kind: string) {
    if (kind === 'report') return copy.report
    if (kind === 'appeal') return copy.appeal
    return copy.support
  }

  function readable(value: string | null | undefined) {
    if (!value) return '—'
    return value.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase())
  }

  function when(value: string | null | undefined) {
    if (!value) return ''
    return new Date(value).toLocaleString(ar ? 'ar-MA' : 'en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  async function loadThreads(silent = false) {
    if (!silent) loading = true
    if (!silent) error = ''
    try {
      threads = await listAdminSupportThreads(null)
      if (selected) {
        const fresh = threads.find((item) => item.id === selected?.id)
        if (fresh) selected = fresh
      }
    } catch {
      if (!silent) error = copy.generic
    } finally {
      if (!silent) loading = false
    }
  }

  async function refreshInbox() {
    if (refreshing || saving || loading || loadingMessages || document.visibilityState === 'hidden') return
    refreshing = true
    try {
      await loadThreads(true)
      if (selected) {
        const threadId = selected.id
        const before = messages.length
        const nearBottom = !messagesElement || messagesElement.scrollHeight - messagesElement.scrollTop - messagesElement.clientHeight < 80
        const [freshMessages, freshContext] = await Promise.all([
          getAdminSupportMessages(threadId),
          getAdminSupportThreadContext(threadId)
        ])
        if (selected?.id !== threadId || saving) return
        messages = freshMessages
        context = freshContext
        if (messages.length > before && nearBottom) await scrollToLatest()
      }
    } catch {
      // Background refresh stays silent so the current conversation remains usable.
    } finally {
      refreshing = false
    }
  }

  async function openThread(item: SupportThreadSummary) {
    selected = item
    context = null
    messages = []
    loadingMessages = true
    error = ''
    try {
      const [freshMessages, freshContext] = await Promise.all([
        getAdminSupportMessages(item.id),
        getAdminSupportThreadContext(item.id)
      ])
      if (selected?.id !== item.id) return
      messages = freshMessages
      context = freshContext
      await scrollToLatest()
    } catch {
      if (selected?.id === item.id) error = copy.generic
    } finally {
      if (selected?.id === item.id) loadingMessages = false
    }
  }

  function closeThread() {
    if (saving) return
    loadingMessages = false
    selected = null
    context = null
    messages = []
    reply = ''
    error = ''
  }

  async function sendReply() {
    const body = reply.trim()
    if (!selected || !body || saving || loadingMessages) return
    saving = true
    error = ''
    try {
      await adminReplySupportThread(selected.id, body, 'waiting')
      reply = ''
      messages = await getAdminSupportMessages(selected.id)
      selected = { ...selected, status: 'waiting' }
      if (context) context = { ...context, status: 'waiting' }
      await loadThreads(true)
      await scrollToLatest()
    } catch {
      error = copy.generic
    } finally {
      saving = false
    }
  }

  async function toggleResolved() {
    if (!selected || saving || loadingMessages) return
    saving = true
    error = ''
    const next = selected.status === 'resolved' ? 'open' : 'resolved'
    try {
      await adminSetSupportStatus(selected.id, next)
      selected = { ...selected, status: next }
      if (context) context = { ...context, status: next }
      await loadThreads(true)
    } catch {
      error = copy.generic
    } finally {
      saving = false
    }
  }

  async function scrollToLatest() {
    await tick()
    if (!messagesElement) return
    messagesElement.scrollTop = messagesElement.scrollHeight
  }
</script>

<svelte:head><title>{copy.title} · UNEEM Admin</title></svelte:head>

<main class="uneem-page max-w-4xl">
  {#if !selected}
    <header class="mb-5">
      <h1 class="uneem-title">{copy.title}</h1>
    </header>

    <div class="mb-4 max-w-sm">
      <SegmentedControl
        options={filterOptions}
        value={filter}
        ariaLabel={copy.title}
        onChange={(value) => (filter = value as InboxFilter)}
      />
    </div>

    {#if error}<div class="mb-4 rounded-xl bg-danger-light px-4 py-3 text-sm font-medium text-danger" role="alert">{error}</div>{/if}

    <section class="overflow-hidden rounded-[22px] bg-surface px-5">
      {#if loading}
        <div class="space-y-1 py-2" aria-busy="true">
          {#each [1, 2, 3] as _}<div class="h-[68px] animate-pulse rounded-xl bg-surface-level-1"></div>{/each}
        </div>
      {:else if visibleThreads.length === 0}
        <div class="px-5 py-12 text-center">
          <Icon name="message-circle" size={22} className="mx-auto text-text-muted" />
          <p class="mt-3 text-sm font-semibold text-text-secondary">{copy.empty}</p>
        </div>
      {:else}
        {#each visibleThreads as item}
          <button on:click={() => openThread(item)} class="thread-row">
            <span class={`h-2.5 w-2.5 shrink-0 rounded-full ${item.status === 'open' ? 'bg-primary' : item.status === 'waiting' ? 'bg-text-muted' : 'bg-success'}`}></span>
            <span class="min-w-0 flex-1">
              <span class="flex min-w-0 flex-wrap items-center gap-2">
                <span class="line-clamp-2 text-base font-semibold leading-6 text-text">{item.subject || (item.user_id ? copy.user : copy.guest)}</span>
                {#if item.kind !== 'support'}<span class="rounded-md bg-surface-level-1 px-1.5 py-0.5 text-xs font-medium text-text-muted">{kindLabel(item.kind)}</span>{/if}
              </span>
              <span class={`mt-1 block text-xs font-medium ${item.status === 'open' ? 'text-primary' : 'text-text-muted'}`}>{statusLabel(item.status)}</span>
            </span>
            <time class="thread-time text-xs text-text-muted" datetime={item.last_message_at || item.updated_at}>{when(item.last_message_at || item.updated_at)}</time>
          </button>
        {/each}
      {/if}
    </section>
  {:else}
    <section class="conversation">
      <header class="mb-2 flex min-h-12 items-center gap-2">
        <button disabled={saving} on:click={closeThread} class="uneem-icon-button shrink-0" aria-label={copy.back}>
          <Icon name={ar ? 'arrow-right' : 'arrow-left'} size={18} />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-[18px] font-semibold text-text">{selected.subject || (selected.user_id ? copy.user : copy.guest)}</h1>
          <p class={`mt-0.5 text-xs font-medium ${selected.status === 'open' ? 'text-primary' : 'text-text-muted'}`}>{statusLabel(selected.status)}</p>
        </div>
        <Button variant="secondary" size="sm" disabled={saving || loadingMessages} on:click={toggleResolved} className="shrink-0">
          {selected.status === 'resolved' ? copy.reopen : copy.resolve}
        </Button>
      </header>

      {#if context?.kind === 'report'}
        <div class="mb-3 flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-surface-level-1 px-3 py-2 text-xs text-text-secondary">
          <span class="font-semibold text-text-muted">{copy.context}</span>
          <span>{copy.target}: <strong class="text-text">{readable(context.target_type)}</strong></span>
          <span>{copy.reason}: <strong class="text-text">{readable(context.reason_code)}</strong></span>
        </div>
      {/if}

      {#if error}<div class="mb-3 rounded-xl bg-danger-light px-4 py-3 text-sm font-medium text-danger" role="alert">{error}</div>{/if}

      <div bind:this={messagesElement} class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain py-4" role="log" aria-label={ar ? 'الرسائل' : 'Messages'} aria-live="polite">
        {#if loadingMessages}
          <div class="space-y-3" aria-busy="true"><div class="h-16 w-3/4 animate-pulse rounded-2xl bg-surface-level-1"></div><div class="ms-auto h-16 w-3/4 animate-pulse rounded-2xl bg-surface-level-1"></div></div>
        {:else}
          {#each messages as item (item.id)}
            {@const fromAdmin = item.sender_role === 'admin'}
            <div class={`max-w-[88%] sm:max-w-[75%] ${fromAdmin ? 'ms-auto' : 'me-auto'}`}>
              <div class={`rounded-2xl px-4 py-3 ${fromAdmin ? 'bg-primary-light text-text' : 'bg-surface-level-1 text-text'}`}>
                <p class="whitespace-pre-wrap text-sm leading-6">{item.body}</p>
              </div>
              <time class={`mt-1 block px-1 text-[10px] text-text-muted ${fromAdmin ? 'text-end' : 'text-start'}`}>
                {new Date(item.created_at).toLocaleString(ar ? 'ar-MA' : 'en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          {/each}
        {/if}
      </div>

      <form on:submit|preventDefault={sendReply} class="mt-3 flex shrink-0 items-end gap-3 rounded-[22px] bg-surface p-3">
        <textarea bind:value={reply} rows="2" disabled={saving || loadingMessages} maxlength="4000" class="uneem-field max-h-40 min-h-[56px] min-w-0 flex-1 resize-y" placeholder={copy.placeholder} aria-label={copy.placeholder}></textarea>
        <Button type="submit" loading={saving} disabled={!reply.trim() || loadingMessages} className="h-14 w-14 shrink-0 !p-0" aria-label={copy.send}>
          <Icon name={ar ? 'arrow-left' : 'arrow-right'} size={22} />
        </Button>
      </form>
    </section>
  {/if}
</main>

<style>
  .thread-row { display: grid; grid-template-columns: 10px minmax(0, 1fr); column-gap: 16px; row-gap: 8px; align-items: center; width: 100%; padding: 20px 0; text-align: start; transition: background 140ms; }
  .thread-row + .thread-row { border-top: 1px solid var(--border-light); }
  .thread-row:hover { background: var(--surface-level-1); }
  .thread-time { grid-column: 2; }
  .conversation { display: flex; flex-direction: column; height: max(260px, calc(var(--visual-height, 100dvh) - 210px)); max-height: 900px; }
  @media (min-width: 640px) { .thread-row { grid-template-columns: 10px minmax(0, 1fr) auto; } .thread-time { grid-column: 3; } }
</style>

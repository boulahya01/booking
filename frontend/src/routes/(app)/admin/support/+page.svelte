<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { language } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'
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
    title: 'الدعم', active: 'النشطة', resolved: 'المحلولة', empty: 'ما كاين حتى محادثة',
    guest: 'زائر', user: 'مستخدم', report: 'بلاغ', support: 'دعم', appeal: 'مراجعة الحساب',
    needsReply: 'خاصها رد', waiting: 'في انتظار المستخدم', resolvedStatus: 'تم الحل',
    back: 'الرجوع للمحادثات', resolve: 'حل', reopen: 'إعادة الفتح',
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

  onMount(() => {
    void loadThreads()
    const timer = window.setInterval(() => void refreshInbox(), 3500)
    return () => window.clearInterval(timer)
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
    if (refreshing || saving || document.visibilityState === 'hidden') return
    refreshing = true
    try {
      await loadThreads(true)
      if (selected) {
        const before = messages.length
        const [freshMessages, freshContext] = await Promise.all([
          getAdminSupportMessages(selected.id),
          getAdminSupportThreadContext(selected.id)
        ])
        messages = freshMessages
        context = freshContext
        if (messages.length > before) await scrollToLatest()
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
      ;[messages, context] = await Promise.all([
        getAdminSupportMessages(item.id),
        getAdminSupportThreadContext(item.id)
      ])
      await scrollToLatest()
    } catch {
      error = copy.generic
    } finally {
      loadingMessages = false
    }
  }

  function closeThread() {
    selected = null
    context = null
    messages = []
    reply = ''
    error = ''
  }

  async function sendReply() {
    const body = reply.trim()
    if (!selected || !body) return
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
    if (!selected) return
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

<main class="uneem-page-narrow max-w-3xl">
  {#if !selected}
    <header class="mb-5">
      <h1 class="uneem-title">{copy.title}</h1>
    </header>

    <div class="mb-4 flex gap-2">
      <button on:click={() => filter = 'active'} class="uneem-chip" class:is-active={filter === 'active'}>{copy.active}</button>
      <button on:click={() => filter = 'resolved'} class="uneem-chip" class:is-active={filter === 'resolved'}>{copy.resolved}</button>
    </div>

    {#if error}<div class="mb-4 rounded-xl bg-danger-light px-4 py-3 text-sm font-medium text-danger" role="alert">{error}</div>{/if}

    <section class="uneem-panel overflow-hidden">
      {#if loading}
        <div class="space-y-1 p-3" aria-busy="true">
          {#each [1, 2, 3] as _}<div class="h-[72px] animate-pulse rounded-xl bg-surface-level-1"></div>{/each}
        </div>
      {:else if visibleThreads.length === 0}
        <div class="px-5 py-12 text-center">
          <div class="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-surface-level-1 text-text-muted"><Icon name="message-circle" size={20} /></div>
          <p class="mt-3 text-sm font-semibold text-text-secondary">{copy.empty}</p>
        </div>
      {:else}
        {#each visibleThreads as item}
          <button on:click={() => openThread(item)} class="uneem-list-row min-h-[72px] w-full px-4 text-start sm:px-5">
            <span class={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.status === 'open' ? 'bg-primary-light text-primary' : 'bg-surface-level-1 text-text-muted'}`}>
              <Icon name={item.kind === 'report' ? 'alert-circle' : 'message-circle'} size={18} />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="truncate text-sm font-semibold text-text">{item.subject || (item.user_id ? copy.user : copy.guest)}</span>
                {#if item.kind !== 'support'}<span class="shrink-0 text-[10px] font-bold uppercase tracking-wide text-text-muted">{kindLabel(item.kind)}</span>{/if}
              </span>
              <span class={`mt-1 block text-xs font-medium ${item.status === 'open' ? 'text-primary' : 'text-text-muted'}`}>{statusLabel(item.status)}</span>
            </span>
            <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={16} className="shrink-0 text-text-muted" />
          </button>
        {/each}
      {/if}
    </section>
  {:else}
    <section class="flex min-h-[calc(100dvh-180px)] flex-col">
      <header class="mb-3 flex min-h-12 items-center gap-3">
        <button on:click={closeThread} class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-text-secondary hover:bg-surface-level-1 hover:text-text" aria-label={copy.back}>
          <Icon name={ar ? 'arrow-right' : 'arrow-left'} size={18} />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-[18px] font-semibold text-text">{selected.subject || (selected.user_id ? copy.user : copy.guest)}</h1>
          <p class={`mt-0.5 text-xs font-medium ${selected.status === 'open' ? 'text-primary' : 'text-text-muted'}`}>{statusLabel(selected.status)}</p>
        </div>
        <button disabled={saving} on:click={toggleResolved} class="min-h-10 shrink-0 px-2 text-sm font-semibold text-text-secondary hover:text-text">
          {selected.status === 'resolved' ? copy.reopen : copy.resolve}
        </button>
      </header>

      {#if context?.kind === 'report'}
        <div class="mb-3 flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-surface-level-1 px-3 py-2 text-xs text-text-secondary">
          <span class="font-semibold text-text-muted">{copy.context}</span>
          <span>{copy.target}: <strong class="text-text">{readable(context.target_type)}</strong></span>
          <span>{copy.reason}: <strong class="text-text">{readable(context.reason_code)}</strong></span>
        </div>
      {/if}

      {#if error}<div class="mb-3 rounded-xl bg-danger-light px-4 py-3 text-sm font-medium text-danger" role="alert">{error}</div>{/if}

      <div bind:this={messagesElement} class="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border-light bg-surface px-4 py-5 sm:px-5" aria-live="polite">
        {#if loadingMessages}
          <div class="space-y-3" aria-busy="true"><div class="h-16 w-3/4 animate-pulse rounded-2xl bg-surface-level-1"></div><div class="ms-auto h-16 w-3/4 animate-pulse rounded-2xl bg-surface-level-1"></div></div>
        {:else}
          {#each messages as item}
            {@const fromAdmin = item.sender_role === 'admin'}
            <div class={`max-w-[84%] ${fromAdmin ? 'ms-auto' : 'me-auto'}`}>
              <div class={`rounded-2xl px-4 py-3 ${fromAdmin ? 'bg-primary-action text-white' : 'bg-surface-level-1 text-text'}`}>
                <p class="whitespace-pre-wrap text-sm leading-6">{item.body}</p>
              </div>
              <time class={`mt-1 block px-1 text-[10px] text-text-muted ${fromAdmin ? 'text-end' : 'text-start'}`}>
                {new Date(item.created_at).toLocaleString(ar ? 'ar-MA' : 'en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          {/each}
        {/if}
      </div>

      <form on:submit|preventDefault={sendReply} class="mt-3 flex items-end gap-2">
        <textarea bind:value={reply} rows="1" maxlength="4000" class="uneem-field max-h-32 min-h-[48px] flex-1 resize-none" placeholder={copy.placeholder} aria-label={copy.placeholder}></textarea>
        <button disabled={saving || !reply.trim()} class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-action text-white disabled:opacity-40" aria-label={copy.send}>
          <Icon name={ar ? 'arrow-left' : 'arrow-right'} size={18} />
        </button>
      </form>
    </section>
  {/if}
</main>

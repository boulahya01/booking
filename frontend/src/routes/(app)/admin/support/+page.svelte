<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { language } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'
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

    <div class="mb-4 max-w-sm">
      <SegmentedControl
        options={filterOptions}
        value={filter}
        ariaLabel={copy.title}
        onChange={(value) => (filter = value as InboxFilter)}
      />
    </div>

    {#if error}<div class="mb-4 rounded-xl bg-danger-light px-4 py-3 text-sm font-medium text-danger" role="alert">{error}</div>{/if}

    <section class="border-y border-border-light">
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
          <button on:click={() => openThread(item)} class="flex min-h-[68px] w-full items-center gap-3 border-b border-border-light px-1 text-start transition-colors last:border-0 hover:bg-surface-level-1/70">
            <span class={`h-2.5 w-2.5 shrink-0 rounded-full ${item.status === 'open' ? 'bg-primary' : item.status === 'waiting' ? 'bg-text-muted' : 'bg-success'}`}></span>
            <span class="min-w-0 flex-1">
              <span class="flex min-w-0 items-center gap-2">
                <span class="truncate text-sm font-semibold text-text">{item.subject || (item.user_id ? copy.user : copy.guest)}</span>
                {#if item.kind !== 'support'}<span class="shrink-0 text-[10px] font-bold uppercase tracking-wide text-text-muted">{kindLabel(item.kind)}</span>{/if}
              </span>
              <span class={`mt-1 block text-xs font-medium ${item.status === 'open' ? 'text-primary' : 'text-text-muted'}`}>{statusLabel(item.status)}</span>
            </span>
            <span class="shrink-0 text-[10px] text-text-muted">{when(item.last_message_at || item.updated_at)}</span>
          </button>
        {/each}
      {/if}
    </section>
  {:else}
    <section class="flex min-h-[calc(100dvh-175px)] flex-col">
      <header class="mb-2 flex min-h-12 items-center gap-2">
        <button on:click={closeThread} class="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-text-secondary hover:bg-surface-level-1 hover:text-text" aria-label={copy.back}>
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

      <div bind:this={messagesElement} class="min-h-0 flex-1 space-y-3 overflow-y-auto py-4" aria-live="polite">
        {#if loadingMessages}
          <div class="space-y-3" aria-busy="true"><div class="h-16 w-3/4 animate-pulse rounded-2xl bg-surface-level-1"></div><div class="ms-auto h-16 w-3/4 animate-pulse rounded-2xl bg-surface-level-1"></div></div>
        {:else}
          {#each messages as item}
            {@const fromAdmin = item.sender_role === 'admin'}
            <div class={`max-w-[82%] ${fromAdmin ? 'ms-auto' : 'me-auto'}`}>
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

      <form on:submit|preventDefault={sendReply} class="mt-2 flex items-end gap-2 border-t border-border-light pt-3">
        <textarea bind:value={reply} rows="1" maxlength="4000" class="uneem-field max-h-32 min-h-[48px] flex-1 resize-none" placeholder={copy.placeholder} aria-label={copy.placeholder}></textarea>
        <button disabled={saving || !reply.trim()} class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-action text-white disabled:opacity-40" aria-label={copy.send}>
          <Icon name={ar ? 'arrow-left' : 'arrow-right'} size={18} />
        </button>
      </form>
    </section>
  {/if}
</main>

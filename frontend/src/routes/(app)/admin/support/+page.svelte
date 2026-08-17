<script lang="ts">
  import { onMount } from 'svelte'
  import {
    adminReplySupportThread,
    adminSetSupportStatus,
    getAdminSupportMessages,
    getAdminSupportThreadContext,
    listAdminSupportThreads,
    type AdminSupportThreadContext,
    type SupportMessage,
    type SupportStatus,
    type SupportThreadSummary
  } from '$lib/supportApi'

  let filter: SupportStatus | 'all' = 'open'
  let threads: SupportThreadSummary[] = []
  let selected: SupportThreadSummary | null = null
  let context: AdminSupportThreadContext | null = null
  let messages: SupportMessage[] = []
  let loading = true
  let loadingMessages = false
  let saving = false
  let error = ''
  let reply = ''

  onMount(loadThreads)

  async function loadThreads() {
    loading = true
    error = ''
    try {
      threads = await listAdminSupportThreads(filter === 'all' ? null : filter)
      if (selected && !threads.some((item) => item.id === selected?.id)) {
        selected = null
        context = null
        messages = []
      }
    } catch (e: any) {
      error = e.message
    } finally {
      loading = false
    }
  }

  async function changeFilter(next: SupportStatus | 'all') {
    filter = next
    selected = null
    context = null
    messages = []
    await loadThreads()
  }

  async function openThread(item: SupportThreadSummary) {
    selected = item
    context = null
    loadingMessages = true
    error = ''
    try {
      const [nextMessages, nextContext] = await Promise.all([
        getAdminSupportMessages(item.id),
        getAdminSupportThreadContext(item.id)
      ])
      messages = nextMessages
      context = nextContext
    } catch (e: any) {
      error = e.message
    } finally {
      loadingMessages = false
    }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return
    saving = true
    error = ''
    try {
      await adminReplySupportThread(selected.id, reply, 'waiting')
      reply = ''
      messages = await getAdminSupportMessages(selected.id)
      selected = { ...selected, status: 'waiting' }
      if (context) context = { ...context, status: 'waiting' }
      threads = threads.map((item) => item.id === selected?.id ? { ...item, status: 'waiting' } : item)
    } catch (e: any) {
      error = e.message
    } finally {
      saving = false
    }
  }

  async function setStatus(status: SupportStatus) {
    if (!selected) return
    saving = true
    error = ''
    try {
      await adminSetSupportStatus(selected.id, status)
      const id = selected.id
      selected = { ...selected, status }
      if (context) context = { ...context, status }
      threads = filter !== 'all' && filter !== status
        ? threads.filter((item) => item.id !== id)
        : threads.map((item) => item.id === id ? { ...item, status } : item)
    } catch (e: any) {
      error = e.message
    } finally {
      saving = false
    }
  }

  function readableReason(reason: string | null | undefined) {
    if (!reason) return ''
    return reason.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase())
  }
</script>

<svelte:head><title>Help & Reports - UNEEM Admin</title></svelte:head>

<div class="mx-auto w-full max-w-6xl pb-20">
  <header class="mb-6 sm:mb-8">
    <p class="text-sm font-semibold text-primary">Admin</p>
    <h1 class="mt-1 text-2xl font-semibold tracking-[-0.03em] text-text sm:text-3xl">Help & Reports</h1>
    <p class="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Private conversations for account help, verification appeals and reports. Replies and status changes are audited.</p>
  </header>

  <div class="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
    {#each ['open', 'waiting', 'resolved', 'all'] as item}
      <button
        on:click={() => changeFilter(item as SupportStatus | 'all')}
        class="min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition"
        class:bg-primary={filter === item}
        class:text-text-inverse={filter === item}
        class:bg-surface={filter !== item}
        class:text-text-secondary={filter !== item}
      >{item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)}</button>
    {/each}
  </div>

  {#if error}<div class="mb-5 rounded-2xl bg-danger-light px-4 py-3 text-sm text-danger" role="alert">{error}</div>{/if}

  <div class="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
    <section class="uneem-panel overflow-hidden">
      <div class="border-b border-border-light px-4 py-3.5 sm:px-5">
        <p class="text-sm font-semibold text-text">Inbox</p>
      </div>

      {#if loading}
        <div class="space-y-3 p-4" aria-busy="true">
          {#each [1,2,3] as _}<div class="h-20 animate-pulse rounded-2xl bg-surface-level-1"></div>{/each}
        </div>
      {:else if threads.length === 0}
        <div class="px-5 py-12 text-center">
          <p class="text-sm font-semibold text-text">Nothing here</p>
          <p class="mt-1 text-sm text-text-muted">No {filter === 'all' ? '' : filter} conversations right now.</p>
        </div>
      {:else}
        <div class="divide-y divide-border-light">
          {#each threads as item}
            <button on:click={() => openThread(item)} class="w-full px-4 py-4 text-start transition hover:bg-surface-level-1 sm:px-5" class:bg-surface-level-1={selected?.id === item.id}>
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="rounded-full bg-surface-level-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{item.kind}</span>
                    <span class="text-xs text-text-muted">{item.message_count} msgs</span>
                  </div>
                  <p class="mt-2 truncate text-sm font-semibold text-text">{item.subject || 'Support conversation'}</p>
                  <p class="mt-1 truncate text-xs text-text-muted">{item.contact_email || (item.user_id ? 'Signed-in student' : 'Guest')}</p>
                </div>
                <span class="text-[11px] text-text-muted">{new Date(item.last_message_at || item.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </section>

    <section class="uneem-panel min-h-[430px] overflow-hidden">
      {#if !selected}
        <div class="grid min-h-[430px] place-items-center px-6 text-center">
          <div>
            <p class="text-sm font-semibold text-text">Select a conversation</p>
            <p class="mt-1 text-sm text-text-muted">Open a request to review its context and reply.</p>
          </div>
        </div>
      {:else}
        <div class="flex min-h-[430px] flex-col">
          <div class="border-b border-border-light px-4 py-4 sm:px-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-text">{selected.subject || 'Support conversation'}</p>
                <p class="mt-1 text-xs text-text-muted">{selected.kind} · {selected.status}</p>
              </div>
              <div class="flex gap-2">
                {#if selected.status !== 'open'}<button disabled={saving} on:click={() => setStatus('open')} class="min-h-10 rounded-xl border border-border px-3 text-xs font-semibold text-text">Reopen</button>{/if}
                {#if selected.status !== 'resolved'}<button disabled={saving} on:click={() => setStatus('resolved')} class="min-h-10 rounded-xl bg-success-light px-3 text-xs font-semibold text-success">Resolve</button>{/if}
              </div>
            </div>

            {#if context?.kind === 'report'}
              <div class="mt-4 rounded-2xl bg-surface-level-1 px-4 py-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Report context</p>
                <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-secondary">
                  <span><strong class="font-semibold text-text">Target:</strong> {context.target_type || 'unknown'}</span>
                  <span><strong class="font-semibold text-text">Reason:</strong> {readableReason(context.reason_code)}</span>
                </div>
                {#if context.target_id}
                  <p class="mt-2 break-all font-mono text-[11px] text-text-muted">{context.target_id}</p>
                {/if}
              </div>
            {/if}
          </div>

          <div class="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-5">
            {#if loadingMessages}
              <div class="space-y-3" aria-busy="true"><div class="h-16 w-3/4 animate-pulse rounded-2xl bg-surface-level-1"></div><div class="ms-auto h-16 w-3/4 animate-pulse rounded-2xl bg-surface-level-1"></div></div>
            {:else}
              {#each messages as message}
                <div class:item-admin={message.sender_role === 'admin'} class="support-message max-w-[88%] rounded-2xl px-4 py-3">
                  <p class="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                  <p class="mt-1.5 text-[11px] opacity-60">{new Date(message.created_at).toLocaleString()}</p>
                </div>
              {/each}
            {/if}
          </div>

          <form on:submit|preventDefault={sendReply} class="border-t border-border-light p-4 sm:p-5">
            <textarea bind:value={reply} rows="3" maxlength="4000" class="uneem-field resize-none" placeholder="Write a reply…"></textarea>
            <div class="mt-3 flex justify-end"><button disabled={saving || !reply.trim()} class="uneem-primary-action w-full sm:w-auto sm:min-w-[140px]">{saving ? 'Sending…' : 'Reply'}</button></div>
          </form>
        </div>
      {/if}
    </section>
  </div>
</div>

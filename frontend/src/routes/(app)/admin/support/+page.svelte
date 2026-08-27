<script lang="ts">
  import { onMount } from 'svelte'
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

  $: ar = $language === 'ar'
  $: copy = ar ? {
    title:'الدعم والتقارير', subtitle:'راجع ورد على الطلبات.', inbox:'الوارد', all:'الكل', open:'مفتوحة', waiting:'في انتظار المستخدم', resolved:'تم الحل', empty:'ما كاين حتى طلب', select:'اختار محادثة', selectHint:'افتح طلب باش تشوف السياق وترد.',
    support:'دعم', report:'تقرير', messages:'رسائل', signed:'طالب مسجل', guest:'زائر', reportContext:'سياق التقرير', target:'النوع', reason:'السبب', reopen:'إعادة الفتح', resolve:'حل', reply:'اكتب رد…', send:'إرسال', sending:'جاري الإرسال…', generic:'تعذر إكمال العملية.'
  } : {
    title:'Help & reports', subtitle:'Review and reply to requests.', inbox:'Inbox', all:'All', open:'Open', waiting:'Waiting', resolved:'Resolved', empty:'Nothing here', select:'Select a conversation', selectHint:'Open a request to review context and reply.',
    support:'Support', report:'Report', messages:'messages', signed:'Signed-in student', guest:'Guest', reportContext:'Report context', target:'Target', reason:'Reason', reopen:'Reopen', resolve:'Resolve', reply:'Write a reply…', send:'Reply', sending:'Sending…', generic:'Couldn’t complete that action.'
  }

  onMount(loadThreads)

  function statusLabel(value: string) {
    if (value === 'resolved') return copy.resolved
    if (value === 'waiting') return copy.waiting
    return copy.open
  }

  function kindLabel(value: string) {
    return value === 'report' ? copy.report : copy.support
  }

  function readableReason(reason: string | null | undefined) {
    if (!reason) return '—'
    return reason.replaceAll('_',' ').replace(/^./,(char)=>char.toUpperCase())
  }

  async function loadThreads() {
    loading = true
    error = ''
    try {
      threads = await listAdminSupportThreads(filter === 'all' ? null : filter)
      if (selected && !threads.some((item) => item.id === selected?.id)) { selected=null;context=null;messages=[] }
    } catch { error=copy.generic }
    finally { loading=false }
  }

  async function changeFilter(next: SupportStatus | 'all') {
    filter=next;selected=null;context=null;messages=[];await loadThreads()
  }

  async function openThread(item: SupportThreadSummary) {
    selected=item;context=null;loadingMessages=true;error=''
    try { [messages,context]=await Promise.all([getAdminSupportMessages(item.id),getAdminSupportThreadContext(item.id)]) }
    catch { error=copy.generic }
    finally { loadingMessages=false }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return
    saving=true;error=''
    try {
      await adminReplySupportThread(selected.id,reply,'waiting')
      reply=''
      messages=await getAdminSupportMessages(selected.id)
      selected={...selected,status:'waiting'}
      if (context) context={...context,status:'waiting'}
      threads=threads.map((item)=>item.id===selected?.id?{...item,status:'waiting'}:item)
    } catch { error=copy.generic }
    finally { saving=false }
  }

  async function setStatus(status: SupportStatus) {
    if (!selected) return
    saving=true;error=''
    try {
      await adminSetSupportStatus(selected.id,status)
      const id=selected.id
      selected={...selected,status}
      if (context) context={...context,status}
      threads=filter!=='all'&&filter!==status?threads.filter((item)=>item.id!==id):threads.map((item)=>item.id===id?{...item,status}:item)
    } catch { error=copy.generic }
    finally { saving=false }
  }
</script>

<svelte:head><title>{copy.title} · UNEEM Admin</title></svelte:head>

<main class="uneem-page max-w-7xl">
  <header class="uneem-page-header"><div><p class="uneem-kicker">Admin</p><h1 class="uneem-title">{copy.title}</h1><p class="uneem-subtitle">{copy.subtitle}</p></div></header>

  <div class="mb-4 flex gap-2 overflow-x-auto pb-1">
    {#each [{value:'open',label:copy.open},{value:'waiting',label:copy.waiting},{value:'resolved',label:copy.resolved},{value:'all',label:copy.all}] as item}
      <button on:click={() => changeFilter(item.value as SupportStatus|'all')} class="uneem-chip" class:is-active={filter===item.value}>{item.label}</button>
    {/each}
  </div>

  {#if error}<div class="mb-4 rounded-2xl bg-danger-light px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</div>{/if}

  <div class="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
    <section class="uneem-panel overflow-hidden">
      <div class="flex min-h-14 items-center justify-between border-b border-border-light px-4 sm:px-5"><h2 class="font-bold text-text">{copy.inbox}</h2><span class="text-xs font-bold text-text-muted">{threads.length}</span></div>
      {#if loading}
        <div class="space-y-2 p-3" aria-busy="true">{#each [1,2,3] as _}<div class="h-20 animate-pulse rounded-2xl bg-surface-level-1"></div>{/each}</div>
      {:else if threads.length===0}
        <div class="px-5 py-12 text-center"><div class="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-surface-level-1 text-text-muted"><Icon name="mail" size={20}/></div><p class="mt-3 font-bold text-text">{copy.empty}</p></div>
      {:else}
        <div class="px-3">
          {#each threads as item}
            <button on:click={() => openThread(item)} class="uneem-list-row w-full rounded-xl px-2 text-start" class:bg-surface-level-1={selected?.id===item.id}>
              <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary"><Icon name={item.kind==='report'?'alert-circle':'mail'} size={18}/></div>
              <div class="min-w-0 flex-1"><div class="flex items-center gap-2"><span class="text-[10px] font-extrabold uppercase tracking-wide text-primary">{kindLabel(item.kind)}</span><span class="text-[10px] text-text-muted">{item.message_count} {copy.messages}</span></div><p class="mt-1 truncate text-sm font-bold text-text">{item.subject || copy.support}</p><p class="mt-0.5 truncate text-xs text-text-muted">{item.contact_email || (item.user_id?copy.signed:copy.guest)}</p></div>
              <span class="shrink-0 text-[10px] font-semibold text-text-muted">{statusLabel(item.status)}</span>
            </button>
          {/each}
        </div>
      {/if}
    </section>

    <section class="uneem-panel min-h-[440px] overflow-hidden">
      {#if !selected}
        <div class="grid min-h-[440px] place-items-center px-6 text-center"><div><div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface-level-1 text-text-muted"><Icon name="message-circle" size={21}/></div><p class="mt-3 font-bold text-text">{copy.select}</p><p class="mt-1 text-sm text-text-muted">{copy.selectHint}</p></div></div>
      {:else}
        <div class="flex min-h-[440px] flex-col">
          <header class="border-b border-border-light px-4 py-4 sm:px-5">
            <div class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><h2 class="truncate font-bold text-text">{selected.subject || copy.support}</h2><p class="mt-1 text-xs font-semibold text-text-muted">{kindLabel(selected.kind)} · {statusLabel(selected.status)}</p></div><div class="flex gap-2">{#if selected.status!=='open'}<button disabled={saving} on:click={() => setStatus('open')} class="uneem-secondary-action min-h-10 px-3 text-xs">{copy.reopen}</button>{/if}{#if selected.status!=='resolved'}<button disabled={saving} on:click={() => setStatus('resolved')} class="min-h-10 rounded-xl bg-success-light px-3 text-xs font-bold text-success">{copy.resolve}</button>{/if}</div></div>
            {#if context?.kind==='report'}
              <div class="mt-3 rounded-2xl bg-surface-level-1 px-4 py-3"><p class="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-muted">{copy.reportContext}</p><div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm"><span class="text-text-secondary">{copy.target}: <strong class="text-text">{context.target_type || '—'}</strong></span><span class="text-text-secondary">{copy.reason}: <strong class="text-text">{readableReason(context.reason_code)}</strong></span></div></div>
            {/if}
          </header>

          <div class="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-5">
            {#if loadingMessages}<div class="space-y-3" aria-busy="true"><div class="h-16 w-3/4 animate-pulse rounded-2xl bg-surface-level-1"></div><div class="ms-auto h-16 w-3/4 animate-pulse rounded-2xl bg-surface-level-1"></div></div>{:else}{#each messages as message}<div class:item-admin={message.sender_role==='admin'} class="support-message max-w-[88%] rounded-2xl px-4 py-3"><p class="whitespace-pre-wrap text-sm leading-6">{message.body}</p><p class="mt-1.5 text-[11px] opacity-60">{new Date(message.created_at).toLocaleString(ar?'ar-MA':'en')}</p></div>{/each}{/if}
          </div>

          <form on:submit|preventDefault={sendReply} class="border-t border-border-light p-4 sm:p-5"><textarea bind:value={reply} rows="3" maxlength="4000" class="uneem-field resize-none" placeholder={copy.reply}></textarea><button disabled={saving||!reply.trim()} class="uneem-primary-action mt-3 w-full sm:ms-auto sm:flex sm:w-auto sm:min-w-32">{saving?copy.sending:copy.send}</button></form>
        </div>
      {/if}
    </section>
  </div>
</main>

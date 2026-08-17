<script lang="ts">
  import { onMount } from 'svelte'
  import { authState } from '$lib/stores/auth'
  import { language, uiState } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'
  import {
    addAuthenticatedSupportMessage,
    addGuestSupportMessage,
    createAuthenticatedSupportThread,
    createGuestSupportThread,
    getGuestSupportThread,
    getMySupportThread,
    listMySupportThreads,
    type MySupportThreadSummary,
    type SupportThread
  } from '$lib/supportApi'

  const STORAGE_KEY = 'uneem_support_access_token'

  let contactEmail = ''
  let subject = ''
  let message = ''
  let submitting = false
  let loadingThread = true
  let error = ''
  let success = ''
  let guestToken = ''
  let thread: SupportThread | null = null
  let myThreads: MySupportThreadSummary[] = []
  let showingNewRequest = false
  let initialized = false
  let loadedAuthenticated = false

  $: signedIn = !!$authState.user
  $: restriction = $authState.account?.access_status === 'suspended'
  $: defaultKind = restriction ? 'appeal' : 'support'
  $: ar = $language === 'ar'
  $: backHref = signedIn ? '/profile' : '/login'
  $: if (initialized && signedIn && !loadedAuthenticated) void loadAuthenticatedThreads()

  $: copy = ar ? {
    title:'المساعدة', subtitle: restriction ? 'طلب مراجعة لحسابك.' : 'شنو نقدر نعاونك فيه؟', newRequest:'طلب جديد', existing:'المحادثات',
    contact:'بريد للتواصل', optional:'اختياري', subject:'الموضوع', subjectPlaceholder: restriction ? 'مراجعة توقيف الحساب' : 'الحساب، الحجز، التحقق…',
    message:'الرسالة', messagePlaceholder:'اكتب شنو محتاج…', sendAppeal:'إرسال الطلب', start:'ابدأ المحادثة', sending:'جاري الإرسال…', reply:'رد', replyPlaceholder:'اكتب ردك…', sendReply:'إرسال الرد',
    noThread:'ما كايناش محادثة', open:'مفتوحة', waiting:'في انتظارك', resolved:'تم الحل', newGuest:'طلب جديد',
    safe:'ما ترسلش كلمة المرور أو معلومات الدفع هنا.', genericError:'تعذر إكمال الطلب. حاول مرة أخرى.', sent:'تم إرسال طلبك.', signIn:'رجوع',
    guestHint:'تقدر تطلب المساعدة بلا تسجيل الدخول.'
  } : {
    title:'Help', subtitle: restriction ? 'Ask us to review your account.' : 'What do you need help with?', newRequest:'New request', existing:'Conversations',
    contact:'Contact email', optional:'optional', subject:'Subject', subjectPlaceholder: restriction ? 'Account restriction review' : 'Account, booking, verification…',
    message:'Message', messagePlaceholder:'Tell us what you need…', sendAppeal:'Send request', start:'Start conversation', sending:'Sending…', reply:'Reply', replyPlaceholder:'Write a reply…', sendReply:'Send reply',
    noThread:'No conversation', open:'Open', waiting:'Waiting for you', resolved:'Resolved', newGuest:'New request',
    safe:'Never send passwords or payment details here.', genericError:'Couldn’t complete that request. Try again.', sent:'Request sent.', signIn:'Back',
    guestHint:'You can get help without signing in.'
  }

  onMount(async () => {
    initialized = true
    if (signedIn) return
    guestToken = localStorage.getItem(STORAGE_KEY) || ''
    if (!guestToken) { loadingThread = false; return }
    try {
      thread = await getGuestSupportThread(guestToken)
      if (!thread) localStorage.removeItem(STORAGE_KEY)
    } catch {
      error = copy.genericError
    } finally { loadingThread = false }
  })

  function toggleLanguage() {
    uiState.setLanguage(ar ? 'en' : 'ar')
  }

  async function loadAuthenticatedThreads() {
    loadedAuthenticated = true
    loadingThread = true
    error = ''
    try {
      myThreads = await listMySupportThreads()
      const active = myThreads.find((item) => item.status !== 'resolved') ?? myThreads[0]
      if (active) thread = await getMySupportThread(active.id)
      showingNewRequest = !active
    } catch {
      error = copy.genericError
    } finally { loadingThread = false }
  }

  async function openMyThread(threadId: string) {
    loadingThread = true
    error = ''
    success = ''
    showingNewRequest = false
    try {
      thread = await getMySupportThread(threadId)
      if (!thread) error = copy.noThread
    } catch {
      error = copy.genericError
    } finally { loadingThread = false }
  }

  function beginNewRequest() {
    thread = null
    showingNewRequest = true
    subject = restriction ? (ar ? 'مراجعة توقيف الحساب' : 'Account restriction review') : ''
    message = ''
    error = ''
    success = ''
  }

  async function submitNewThread() {
    if (!message.trim()) return
    submitting = true
    error = ''
    success = ''
    try {
      if (signedIn) {
        const threadId = await createAuthenticatedSupportThread({ kind: defaultKind, subject, body: message })
        message = ''
        subject = ''
        myThreads = await listMySupportThreads()
        thread = await getMySupportThread(threadId)
        showingNewRequest = false
        success = copy.sent
      } else {
        const created = await createGuestSupportThread({ contactEmail, subject, body: message })
        guestToken = created.accessToken
        localStorage.setItem(STORAGE_KEY, guestToken)
        thread = await getGuestSupportThread(guestToken)
        message = ''
        subject = ''
      }
    } catch {
      error = copy.genericError
    } finally { submitting = false }
  }

  async function replyToThread() {
    if (!thread || !message.trim()) return
    submitting = true
    error = ''
    success = ''
    try {
      if (signedIn) {
        await addAuthenticatedSupportMessage(thread.id, message)
        message = ''
        thread = await getMySupportThread(thread.id)
        myThreads = await listMySupportThreads()
      } else if (guestToken) {
        await addGuestSupportMessage(guestToken, message)
        message = ''
        thread = await getGuestSupportThread(guestToken)
      }
    } catch {
      error = copy.genericError
    } finally { submitting = false }
  }

  function startAnotherGuestThread() {
    localStorage.removeItem(STORAGE_KEY)
    guestToken = ''
    thread = null
    message = ''
    subject = ''
    error = ''
  }

  function statusLabel(status: SupportThread['status']) {
    if (status === 'resolved') return copy.resolved
    if (status === 'waiting') return copy.waiting
    return copy.open
  }
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>

<div class="min-h-screen bg-background">
  <header class="border-b border-border-light bg-surface/94 backdrop-blur-xl">
    <div class="mx-auto flex h-[60px] max-w-3xl items-center justify-between px-4 sm:px-6">
      <a href={backHref} class="flex min-h-11 items-center gap-2 text-sm font-bold text-text-secondary hover:text-text">
        <Icon name={ar ? 'arrow-right' : 'arrow-left'} size={18}/><span>{copy.signIn}</span>
      </a>
      <a href="/login" class="text-[17px] font-extrabold tracking-[0.15em] text-text">UNEEM</a>
      <button on:click={toggleLanguage} class="min-h-11 rounded-full px-3 text-sm font-bold text-primary hover:bg-primary-light">{ar ? 'EN' : 'AR'}</button>
    </div>
  </header>

  <main class="uneem-page-narrow max-w-2xl">
    <header class="uneem-page-header">
      <div>
        <h1 class="uneem-title">{copy.title}</h1>
        <p class="uneem-subtitle">{copy.subtitle}</p>
        {#if !signedIn}<p class="mt-1 text-xs text-text-muted">{copy.guestHint}</p>{/if}
      </div>
      {#if signedIn && !showingNewRequest}<button on:click={beginNewRequest} class="uneem-secondary-action min-h-11 shrink-0 px-3 text-sm">{copy.newRequest}</button>{/if}
    </header>

    {#if error}<div class="mb-4 rounded-2xl bg-danger-light px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</div>{/if}
    {#if success}<div class="mb-4 rounded-2xl bg-success-light px-4 py-3 text-sm font-semibold text-success" role="status">{success}</div>{/if}

    {#if signedIn && myThreads.length > 1 && !showingNewRequest}
      <div class="-mx-4 mb-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label={copy.existing}>
        <div class="flex min-w-max gap-2">
          {#each myThreads as item}
            <button on:click={() => openMyThread(item.id)} class="uneem-chip max-w-[15rem]" class:is-active={thread?.id === item.id}>
              <span class="truncate">{item.subject || (item.kind === 'appeal' ? (ar ? 'مراجعة الحساب' : 'Account review') : copy.title)}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if loadingThread}
      <section class="uneem-panel space-y-3 p-5" aria-busy="true"><div class="h-5 w-1/3 animate-pulse rounded-full bg-surface-level-2"></div><div class="h-16 animate-pulse rounded-2xl bg-surface-level-1"></div><div class="h-12 animate-pulse rounded-2xl bg-surface-level-1"></div></section>
    {:else if thread && !showingNewRequest}
      <section class="uneem-panel overflow-hidden">
        <div class="flex items-center justify-between gap-4 border-b border-border-light px-4 py-4 sm:px-5">
          <div class="min-w-0"><p class="truncate font-bold text-text">{thread.subject || (thread.kind === 'appeal' ? (ar ? 'مراجعة الحساب' : 'Account review') : copy.title)}</p><p class="mt-0.5 text-xs font-semibold text-text-muted">{statusLabel(thread.status)}</p></div>
          {#if !signedIn}<button on:click={startAnotherGuestThread} class="min-h-10 text-sm font-bold text-primary">{copy.newGuest}</button>{/if}
        </div>

        <div class="space-y-3 px-4 py-5 sm:px-5">
          {#each thread.messages as item}
            <div class:item-admin={item.sender_role === 'admin'} class="support-message max-w-[88%] rounded-2xl px-4 py-3">
              <p class="whitespace-pre-wrap text-sm leading-6">{item.body}</p>
              <p class="mt-1.5 text-[11px] opacity-60">{new Date(item.created_at).toLocaleString(ar ? 'ar-MA' : 'en')}</p>
            </div>
          {/each}
        </div>

        <form on:submit|preventDefault={replyToThread} class="border-t border-border-light p-4 sm:p-5">
          <label class="text-sm font-bold text-text" for="reply">{copy.reply}</label>
          <textarea id="reply" bind:value={message} rows="3" maxlength="4000" class="uneem-field mt-2 resize-none" placeholder={copy.replyPlaceholder}></textarea>
          <button disabled={submitting || !message.trim()} class="uneem-primary-action mt-3 w-full">{submitting ? copy.sending : copy.sendReply}</button>
        </form>
      </section>
    {:else}
      <form on:submit|preventDefault={submitNewThread} class="uneem-panel p-4 sm:p-5">
        {#if signedIn && myThreads.length > 0}<button type="button" on:click={() => openMyThread(myThreads[0].id)} class="mb-4 min-h-10 text-sm font-bold text-primary">{copy.existing}</button>{/if}
        {#if !signedIn}
          <label class="text-sm font-bold text-text" for="email">{copy.contact} <span class="font-normal text-text-muted">({copy.optional})</span></label>
          <input id="email" bind:value={contactEmail} type="email" autocomplete="email" class="uneem-field mt-2" placeholder="you@example.com" />
        {/if}
        <label class="mt-4 block text-sm font-bold text-text" for="subject">{copy.subject}</label>
        <input id="subject" bind:value={subject} maxlength="120" class="uneem-field mt-2" placeholder={copy.subjectPlaceholder} />
        <label class="mt-4 block text-sm font-bold text-text" for="message">{copy.message}</label>
        <textarea id="message" bind:value={message} rows="5" maxlength="4000" class="uneem-field mt-2 resize-none" placeholder={copy.messagePlaceholder}></textarea>
        <button disabled={submitting || !message.trim()} class="uneem-primary-action mt-5 w-full">{submitting ? copy.sending : restriction ? copy.sendAppeal : copy.start}</button>
      </form>
    {/if}

    <p class="mx-auto mt-4 max-w-md text-center text-xs leading-5 text-text-muted">{copy.safe}</p>
  </main>
</div>

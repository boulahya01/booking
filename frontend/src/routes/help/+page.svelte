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
  let defaultKind: 'support' | 'appeal' = 'support'

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
      <button type="button" on:click={toggleLanguage} class="min-h-11 rounded-xl px-3 text-sm font-bold text-text-secondary hover:bg-surface-level-1">{ar ? 'EN' : 'ع'}</button>
    </div>
  </header>

  <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <div class="mb-7">
      <p class="uneem-kicker">UNEEM</p>
      <h1 class="mt-1 text-3xl font-extrabold tracking-[-0.03em] text-text">{copy.title}</h1>
      <p class="mt-2 text-sm leading-6 text-text-secondary">{copy.subtitle}</p>
    </div>

    {#if error}<div class="mb-4 rounded-2xl bg-danger-light px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</div>{/if}
    {#if success}<div class="mb-4 rounded-2xl bg-success-light px-4 py-3 text-sm font-semibold text-success" role="status">{success}</div>{/if}

    {#if signedIn && myThreads.length > 0}
      <div class="mb-5 flex gap-2 overflow-x-auto pb-1">
        {#each myThreads as item}
          <button type="button" on:click={() => openMyThread(item.id)} class={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${thread?.id === item.id && !showingNewRequest ? 'bg-primary text-white' : 'bg-surface-level-1 text-text-secondary'}`}>{item.subject || copy.existing}</button>
        {/each}
        <button type="button" on:click={beginNewRequest} class={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${showingNewRequest ? 'bg-primary text-white' : 'bg-surface-level-1 text-text-secondary'}`}>+ {copy.newRequest}</button>
      </div>
    {/if}

    {#if loadingThread}
      <div class="uneem-card p-5 text-sm text-text-muted">Loading…</div>
    {:else if thread && !showingNewRequest}
      <section class="uneem-card overflow-hidden">
        <div class="border-b border-border-light px-5 py-4">
          <div class="flex items-start justify-between gap-4">
            <div><p class="text-xs font-extrabold uppercase tracking-[0.08em] text-primary">{statusLabel(thread.status)}</p><h2 class="mt-1 text-lg font-extrabold text-text">{thread.subject || copy.title}</h2></div>
            {#if !signedIn}<button type="button" on:click={startAnotherGuestThread} class="text-xs font-bold text-primary">{copy.newGuest}</button>{/if}
          </div>
        </div>
        <div class="max-h-[52vh] space-y-3 overflow-y-auto p-5">
          {#each thread.messages as item}
            <div class={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${item.sender_role === 'admin' ? 'bg-surface-level-1 text-text' : 'ms-auto bg-primary text-white'}`}>{item.body}</div>
          {/each}
        </div>
        {#if thread.status !== 'resolved'}
          <div class="border-t border-border-light p-4">
            <label for="support-reply" class="sr-only">{copy.reply}</label>
            <textarea id="support-reply" bind:value={message} rows="3" maxlength="4000" placeholder={copy.replyPlaceholder} class="uneem-field min-h-24 resize-y"></textarea>
            <button type="button" on:click={replyToThread} disabled={submitting || !message.trim()} class="uneem-primary-action mt-3 w-full">{submitting ? copy.sending : copy.sendReply}</button>
          </div>
        {/if}
      </section>
    {:else}
      <section class="uneem-card p-5">
        {#if !signedIn}
          <p class="mb-5 rounded-2xl bg-primary-light px-4 py-3 text-sm font-semibold text-primary">{copy.guestHint}</p>
          <label class="block"><span class="text-sm font-bold text-text">{copy.contact} <span class="font-medium text-text-muted">({copy.optional})</span></span><input bind:value={contactEmail} type="email" autocomplete="email" class="uneem-field mt-2" /></label>
        {/if}
        <label class="mt-4 block"><span class="text-sm font-bold text-text">{copy.subject}</span><input bind:value={subject} maxlength="120" placeholder={copy.subjectPlaceholder} class="uneem-field mt-2" /></label>
        <label class="mt-4 block"><span class="text-sm font-bold text-text">{copy.message}</span><textarea bind:value={message} rows="6" maxlength="4000" placeholder={copy.messagePlaceholder} class="uneem-field mt-2 min-h-36 resize-y"></textarea></label>
        <p class="mt-3 text-xs leading-5 text-text-muted">{copy.safe}</p>
        <button type="button" on:click={submitNewThread} disabled={submitting || !message.trim()} class="uneem-primary-action mt-5 w-full">{submitting ? copy.sending : restriction ? copy.sendAppeal : copy.start}</button>
      </section>
    {/if}
  </main>
</div>
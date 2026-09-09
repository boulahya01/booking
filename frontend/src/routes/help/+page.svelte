<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { authState } from '$lib/stores/auth'
  import { language, uiState } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'
  import Button from '$lib/components/Button.svelte'
  import {
    addAuthenticatedSupportMessage,
    addGuestSupportMessage,
    claimGuestSupportThread,
    createAuthenticatedSupportThread,
    createGuestSupportThread,
    getGuestSupportThread,
    getMySupportThread,
    listMySupportThreads,
    type SupportThread
  } from '$lib/supportApi'

  const TOKEN_KEY = 'uneem_support_access_token'
  const NAME_KEY = 'uneem_support_guest_name'

  let displayName = ''
  let message = ''
  let submitting = false
  let loading = true
  let refreshing = false
  let error = ''
  let guestToken = ''
  let thread: SupportThread | null = null
  let mounted = false
  let loadedFor = ''
  let messagesElement: HTMLDivElement | null = null

  $: signedIn = !!$authState.user
  $: authReady = !$authState.loading
  $: restriction = $authState.account?.access_status === 'suspended'
  $: ar = $language === 'ar'
  $: backHref = signedIn ? '/profile' : '/login'
  $: identity = $authState.user?.username
    ? `@${$authState.user.username}`
    : ($authState.user?.full_name || '')
  $: authKey = authReady ? (signedIn ? `user:${$authState.user?.id || ''}` : 'guest') : 'loading'
  $: if (mounted && authReady && authKey !== loadedFor) {
    loadedFor = authKey
    void initialize()
  }

  $: copy = ar ? {
    title: 'الدعم', intro: 'كيف يمكننا مساعدتك؟', name: 'اسمك', namePlaceholder: 'مثال: مروان',
    messagePlaceholder: 'صف المشكلة التي تواجهها…', send: 'إرسال', sending: 'جارٍ الإرسال…',
    safe: 'لا ترسل كلمة المرور أو معلومات الدفع.', resolved: 'تم الحل', newChat: 'محادثة جديدة',
    signedAs: 'مسجل باسم', back: 'رجوع', generic: 'تعذر إكمال العملية. حاول مرة أخرى.',
    nameRequired: 'أدخل اسمك للمتابعة.', messageRequired: 'صف المشكلة التي تواجهها.',
    appeal: 'مراجعة الحساب'
  } : {
    title: 'Support', intro: 'How can we help?', name: 'Your name', namePlaceholder: 'e.g. Marwan',
    messagePlaceholder: 'Describe your problem…', send: 'Send', sending: 'Sending…',
    safe: 'Never send your password or payment details.', resolved: 'Resolved', newChat: 'New conversation',
    signedAs: 'Signed in as', back: 'Back', generic: 'Couldn’t complete that action. Try again.',
    nameRequired: 'Add your name so we know who we are talking to.', messageRequired: 'Describe the problem first.',
    appeal: 'Account review'
  }

  onMount(() => {
    mounted = true
    const timer = window.setInterval(() => void refreshCurrentThread(), 3500)
    return () => window.clearInterval(timer)
  })

  function toggleLanguage() {
    uiState.setLanguage(ar ? 'en' : 'ar')
  }

  function actionableError(cause: unknown) {
    if (cause instanceof Error && cause.message.trim()) return cause.message
    return copy.generic
  }

  async function initialize() {
    loading = true
    error = ''
    thread = null
    guestToken = localStorage.getItem(TOKEN_KEY) || ''
    displayName = localStorage.getItem(NAME_KEY) || ''

    try {
      if (signedIn) {
        if (guestToken) {
          try {
            const claimedId = await claimGuestSupportThread(guestToken)
            if (claimedId) {
              localStorage.removeItem(TOKEN_KEY)
              guestToken = ''
            }
          } catch {
            // A support claim is a continuity enhancement, never a login blocker.
          }
        }
        await loadAuthenticatedConversation()
      } else if (guestToken) {
        thread = await getGuestSupportThread(guestToken)
        if (!thread) {
          localStorage.removeItem(TOKEN_KEY)
          guestToken = ''
        }
      }
    } catch (cause) {
      error = actionableError(cause)
    } finally {
      loading = false
      await scrollToLatest()
    }
  }

  async function loadAuthenticatedConversation() {
    const conversations = await listMySupportThreads()
    const active = conversations.find((item) => item.status !== 'resolved')
    const latest = active ?? conversations[0]
    thread = latest ? await getMySupportThread(latest.id) : null
  }

  async function refreshCurrentThread() {
    if (!thread || refreshing || submitting || document.visibilityState === 'hidden') return
    refreshing = true
    const activeThread = thread.id
    const activeAuth = authKey
    const nearBottom = !messagesElement || messagesElement.scrollHeight - messagesElement.scrollTop - messagesElement.clientHeight < 80
    try {
      const before = thread.messages.length
      const fresh = signedIn
        ? await getMySupportThread(thread.id)
        : guestToken
          ? await getGuestSupportThread(guestToken)
          : null
      if (fresh && thread?.id === activeThread && authKey === activeAuth) {
        thread = fresh
        if (fresh.messages.length > before && nearBottom) await scrollToLatest()
      }
    } catch {
      // Background refresh never replaces an active conversation with an error state.
    } finally {
      refreshing = false
    }
  }

  function userIdentitySubject() {
    if ($authState.user?.username) return `@${$authState.user.username}`
    return $authState.user?.full_name?.trim() || (restriction ? copy.appeal : copy.title)
  }

  async function startConversation() {
    const body = message.trim()
    const name = displayName.trim()
    error = ''

    if (!body) {
      error = copy.messageRequired
      return
    }
    if (!signedIn && name.length < 2) {
      error = copy.nameRequired
      return
    }

    submitting = true
    try {
      if (signedIn) {
        const threadId = await createAuthenticatedSupportThread({
          kind: restriction ? 'appeal' : 'support',
          subject: userIdentitySubject(),
          body
        })
        thread = await getMySupportThread(threadId)
      } else {
        localStorage.setItem(NAME_KEY, name.slice(0, 60))
        const created = await createGuestSupportThread({ subject: name.slice(0, 60), body })
        guestToken = created.accessToken
        localStorage.setItem(TOKEN_KEY, guestToken)
        thread = await getGuestSupportThread(guestToken)
      }
      message = ''
      await scrollToLatest()
    } catch (cause) {
      error = actionableError(cause)
    } finally {
      submitting = false
    }
  }

  async function reply() {
    const body = message.trim()
    if (!thread || !body || submitting) return

    submitting = true
    error = ''
    try {
      if (signedIn) {
        await addAuthenticatedSupportMessage(thread.id, body)
        thread = await getMySupportThread(thread.id)
      } else if (guestToken) {
        await addGuestSupportMessage(guestToken, body)
        thread = await getGuestSupportThread(guestToken)
      }
      message = ''
      await scrollToLatest()
    } catch (cause) {
      error = actionableError(cause)
    } finally {
      submitting = false
    }
  }

  function startNewConversation() {
    if (!signedIn) {
      localStorage.removeItem(TOKEN_KEY)
      guestToken = ''
    }
    thread = null
    message = ''
    error = ''
  }

  async function scrollToLatest() {
    await tick()
    if (!messagesElement) return
    messagesElement.scrollTop = messagesElement.scrollHeight
  }
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>

<div class="support-shell flex flex-col bg-background">
  <header class="shrink-0 bg-background" style="padding-top: var(--app-safe-top);">
    <div class="mx-auto flex h-[56px] w-full max-w-3xl items-center justify-between px-3 sm:px-6">
      <a href={backHref} class="uneem-icon-button" aria-label={copy.back}>
        <Icon name={ar ? 'arrow-right' : 'arrow-left'} size={19} />
      </a>
      <h1 class="text-[16px] font-semibold text-text">{copy.title}</h1>
      <button on:click={toggleLanguage} class="uneem-icon-button text-sm font-semibold">{ar ? 'EN' : 'AR'}</button>
    </div>
  </header>

  <main class="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
    {#if loading}
      <div class="flex flex-1 items-center justify-center px-6" aria-busy="true">
        <span class="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden="true"></span>
      </div>
    {:else if !thread}
      <section class="mx-auto w-full max-w-xl overflow-y-auto px-5 pb-10 pt-8 sm:px-6 sm:pt-12">
        <div class="mb-7">
          <h2 class="text-[26px] font-semibold tracking-[-0.035em] text-text">{copy.intro}</h2>
          {#if signedIn && identity}<p class="mt-2 text-sm text-text-muted">{copy.signedAs} <span class="font-semibold text-text-secondary">{identity}</span></p>{/if}
        </div>

        {#if error}<div class="mb-4 rounded-xl bg-danger-light px-4 py-3 text-sm font-medium text-danger" role="alert">{error}</div>{/if}

        <form on:submit|preventDefault={startConversation} class="space-y-3">
          {#if !signedIn}
            <div>
              <label for="support-name" class="mb-2 block text-sm font-semibold text-text-secondary">{copy.name}</label>
              <input id="support-name" bind:value={displayName} maxlength="60" autocomplete="name" class="uneem-field" placeholder={copy.namePlaceholder} />
            </div>
          {/if}
          <textarea bind:value={message} rows="4" maxlength="4000" class="uneem-field resize-none" placeholder={copy.messagePlaceholder} aria-label={copy.messagePlaceholder}></textarea>
          <Button type="submit" fullWidth size="lg" loading={submitting} disabled={!message.trim()}>{copy.send}</Button>
        </form>
        <p class="mt-4 text-xs leading-5 text-text-muted">{copy.safe}</p>
      </section>
    {:else}
      <section class="flex min-h-0 flex-1 flex-col">
        <div class="flex min-h-14 shrink-0 items-center justify-between gap-3 px-5 sm:px-6">
          <div class="min-w-0">
            <p class="break-words text-sm font-semibold text-text">{thread.subject || copy.title}</p>
            {#if thread.status === 'resolved'}<p class="mt-0.5 text-xs font-medium text-success">{copy.resolved}</p>{/if}
          </div>
          {#if thread.status === 'resolved'}
            <button on:click={startNewConversation} class="min-h-11 shrink-0 px-2 text-sm font-semibold text-primary">{copy.newChat}</button>
          {/if}
        </div>

        {#if error}<div class="mx-4 mt-4 rounded-xl bg-danger-light px-4 py-3 text-sm font-medium text-danger sm:mx-6" role="alert">{error}</div>{/if}

        <div bind:this={messagesElement} class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
          {#each thread.messages as item}
            {@const fromAdmin = item.sender_role === 'admin'}
            <div class={`max-w-[82%] ${fromAdmin ? 'me-auto' : 'ms-auto'}`}>
              <div class={`rounded-2xl px-4 py-3 ${fromAdmin ? 'bg-surface-level-1 text-text' : 'bg-primary-light text-text'}`}>
                <p class="whitespace-pre-wrap break-words text-sm leading-6">{item.body}</p>
              </div>
              <time class={`mt-1 block px-1 text-[10px] text-text-muted ${fromAdmin ? 'text-start' : 'text-end'}`}>
                {new Date(item.created_at).toLocaleString(ar ? 'ar-MA' : 'en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          {/each}
        </div>

        <form on:submit|preventDefault={reply} class="shrink-0 bg-background px-4 pt-3 sm:px-6" style="padding-bottom: max(0.9rem, var(--app-safe-bottom));">
          <div class="flex items-end gap-2">
            <textarea bind:value={message} rows="1" maxlength="4000" class="uneem-field max-h-32 min-h-[48px] flex-1 resize-none" placeholder={copy.messagePlaceholder} aria-label={copy.messagePlaceholder}></textarea>
            <button disabled={submitting || !message.trim()} class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-action text-white disabled:opacity-40" aria-label={copy.send}>
              <Icon name={ar ? 'arrow-left' : 'arrow-right'} size={18} />
            </button>
          </div>
        </form>
      </section>
    {/if}
  </main>
</div>

<style>
  .support-shell { height: calc(var(--visual-height, 100dvh) - var(--verification-notice-height, 0px)); }
</style>

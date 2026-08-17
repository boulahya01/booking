<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { authState } from '$lib/stores/auth'
  import {
    addGuestSupportMessage,
    createAuthenticatedSupportThread,
    createGuestSupportThread,
    getGuestSupportThread,
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

  $: signedIn = !!$authState.user
  $: restriction = $authState.account?.access_status === 'suspended'
  $: defaultKind = restriction ? 'appeal' : 'support'

  onMount(async () => {
    guestToken = localStorage.getItem(STORAGE_KEY) || ''
    if (!guestToken) {
      loadingThread = false
      return
    }

    try {
      thread = await getGuestSupportThread(guestToken)
      if (!thread) localStorage.removeItem(STORAGE_KEY)
    } catch (e: any) {
      error = e.message
    } finally {
      loadingThread = false
    }
  })

  async function submitNewThread() {
    if (!message.trim()) return
    submitting = true
    error = ''
    success = ''

    try {
      if (signedIn) {
        await createAuthenticatedSupportThread({ kind: defaultKind, subject, body: message })
        success = restriction
          ? 'Your appeal was sent. You can keep using account security while it is reviewed.'
          : 'Your message was sent to the UNEEM support team.'
        message = ''
        subject = ''
      } else {
        const created = await createGuestSupportThread({ contactEmail, subject, body: message })
        guestToken = created.accessToken
        localStorage.setItem(STORAGE_KEY, guestToken)
        thread = await getGuestSupportThread(guestToken)
        message = ''
        subject = ''
      }
    } catch (e: any) {
      error = e.message
    } finally {
      submitting = false
    }
  }

  async function replyToGuestThread() {
    if (!guestToken || !message.trim()) return
    submitting = true
    error = ''
    try {
      await addGuestSupportMessage(guestToken, message)
      message = ''
      thread = await getGuestSupportThread(guestToken)
    } catch (e: any) {
      error = e.message
    } finally {
      submitting = false
    }
  }

  function startAnotherGuestThread() {
    localStorage.removeItem(STORAGE_KEY)
    guestToken = ''
    thread = null
    message = ''
    subject = ''
    error = ''
  }
</script>

<svelte:head>
  <title>Help & support - UNEEM</title>
  <meta name="description" content="Contact UNEEM support for account, verification and sports access help." />
</svelte:head>

<div class="min-h-screen bg-bg px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
  <main class="mx-auto w-full max-w-xl">
    <header class="mb-7">
      <a href={signedIn ? '/profile' : '/login'} class="inline-flex min-h-11 items-center text-sm font-semibold text-text-secondary hover:text-text">← Back</a>
      <p class="mt-5 text-sm font-semibold text-primary">UNEEM Support</p>
      <h1 class="mt-1 text-3xl font-semibold tracking-[-0.03em] text-text">How can we help?</h1>
      <p class="mt-3 max-w-lg text-sm leading-6 text-text-secondary">
        {#if restriction}
          Your account restriction does not block support. Tell us what happened and the team can review your appeal.
        {:else if signedIn}
          Ask about your account, student verification, booking or a match. Your conversation stays linked to this account.
        {:else}
          You can contact support even if you cannot sign in. This browser keeps a private key for your conversation.
        {/if}
      </p>
    </header>

    {#if loadingThread}
      <section class="uneem-panel space-y-3 p-5" aria-busy="true">
        <div class="h-5 w-1/3 animate-pulse rounded-full bg-surface-level-2"></div>
        <div class="h-16 animate-pulse rounded-2xl bg-surface-level-1"></div>
        <div class="h-12 animate-pulse rounded-2xl bg-surface-level-1"></div>
      </section>
    {:else if !signedIn && thread}
      <section class="uneem-panel overflow-hidden">
        <div class="border-b border-border-light px-5 py-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-text">{thread.subject || 'Support conversation'}</p>
              <p class="mt-1 text-xs text-text-muted">{thread.status === 'resolved' ? 'Resolved' : thread.status === 'waiting' ? 'Waiting for you' : 'Open'}</p>
            </div>
            <button on:click={startAnotherGuestThread} class="min-h-11 rounded-xl px-3 text-sm font-semibold text-text-secondary hover:bg-surface-level-1">New request</button>
          </div>
        </div>

        <div class="space-y-3 px-4 py-5 sm:px-5">
          {#each thread.messages as item}
            <div class:item-admin={item.sender_role === 'admin'} class="support-message max-w-[88%] rounded-2xl px-4 py-3">
              <p class="whitespace-pre-wrap text-sm leading-6">{item.body}</p>
              <p class="mt-1.5 text-[11px] opacity-60">{new Date(item.created_at).toLocaleString()}</p>
            </div>
          {/each}
        </div>

        <form on:submit|preventDefault={replyToGuestThread} class="border-t border-border-light p-4 sm:p-5">
          <label class="text-sm font-semibold text-text" for="reply">Reply</label>
          <textarea id="reply" bind:value={message} rows="3" maxlength="4000" class="uneem-field mt-2 resize-none" placeholder="Write your message…"></textarea>
          <button disabled={submitting || !message.trim()} class="uneem-primary-action mt-3 w-full">{submitting ? 'Sending…' : 'Send reply'}</button>
        </form>
      </section>
    {:else}
      <form on:submit|preventDefault={submitNewThread} class="uneem-panel p-5 sm:p-6">
        {#if !signedIn}
          <label class="text-sm font-semibold text-text" for="email">Contact email <span class="font-normal text-text-muted">(optional)</span></label>
          <input id="email" bind:value={contactEmail} type="email" autocomplete="email" class="uneem-field mt-2" placeholder="you@example.com" />
          <p class="mt-2 text-xs leading-5 text-text-muted">Useful if you lose this browser. It is not used to grant platform access.</p>
        {/if}

        <label class="mt-5 block text-sm font-semibold text-text" for="subject">What is this about?</label>
        <input id="subject" bind:value={subject} maxlength="120" class="uneem-field mt-2" placeholder={restriction ? 'Account restriction review' : 'Booking, verification, account…'} />

        <label class="mt-5 block text-sm font-semibold text-text" for="message">Message</label>
        <textarea id="message" bind:value={message} rows="5" maxlength="4000" class="uneem-field mt-2 resize-none" placeholder="Explain what you need help with…"></textarea>

        {#if error}<div class="mt-4 rounded-2xl bg-danger-light px-4 py-3 text-sm leading-6 text-danger" role="alert">{error}</div>{/if}
        {#if success}<div class="mt-4 rounded-2xl bg-success-light px-4 py-3 text-sm leading-6 text-success" role="status">{success}</div>{/if}

        <button disabled={submitting || !message.trim()} class="uneem-primary-action mt-5 w-full">
          {submitting ? 'Sending…' : restriction ? 'Send appeal' : 'Start conversation'}
        </button>
      </form>
    {/if}

    <p class="mx-auto mt-5 max-w-md text-center text-xs leading-5 text-text-muted">
      Do not send passwords or payment information. Student-card evidence should only be uploaded through the verification flow.
    </p>
  </main>
</div>

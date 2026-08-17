<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { getMyAccountState, signOut } from '$lib/auth'
  import type { AccountState } from '$lib/types'
  import Icon from '$lib/components/Icon.svelte'

  let state: AccountState | null = null
  let loading = true
  let error = ''

  onMount(async () => {
    try {
      state = await getMyAccountState()
      if (!state) {
        await goto('/login')
        return
      }

      if (state.can_use_sports && state.access_status === 'approved') {
        await goto('/home')
      }
    } catch (e: any) {
      error = e.message || 'Unable to load your account status.'
    } finally {
      loading = false
    }
  })

  async function logout() {
    await signOut()
    await goto('/login')
  }
</script>

<svelte:head>
  <title>Account status - UNEEM</title>
</svelte:head>

<div class="min-h-screen bg-surface px-4 py-8 sm:px-6">
  <main class="mx-auto flex min-h-[75vh] w-full max-w-lg items-center">
    <div class="w-full">
      {#if loading}
        <div class="space-y-3" aria-busy="true">
          <div class="h-40 animate-pulse rounded-3xl bg-surface-level-1"></div>
          <div class="h-14 animate-pulse rounded-2xl bg-surface-level-1"></div>
        </div>
      {:else if error}
        <div class="rounded-3xl bg-surface-level-1 p-6 text-center">
          <div class="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-danger-light text-danger"><Icon name="alert-triangle" size={22} /></div>
          <h1 class="text-xl font-semibold text-text">We could not load your account</h1>
          <p class="mt-2 text-sm leading-6 text-text-secondary">{error}</p>
          <button on:click={() => location.reload()} class="mt-5 w-full rounded-xl bg-primary px-4 py-3.5 font-semibold text-white">Try again</button>
        </div>
      {:else if state}
        <section class="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-7">
          {#if state.access_status === 'suspended'}
            <div class="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-danger-light text-danger"><Icon name="shield" size={25} /></div>
            <div class="text-center">
              <p class="text-sm font-semibold text-danger">Account restricted</p>
              <h1 class="mt-1 text-2xl font-semibold tracking-tight text-text">Your sports access is temporarily unavailable</h1>
              <p class="mt-3 text-sm leading-6 text-text-secondary">Your account remains accessible for security and support. A restriction cannot be removed by creating another account.</p>
            </div>
            <div class="mt-6 rounded-2xl bg-surface-level-1 p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Reason</p>
              <p class="mt-1 text-sm font-medium text-text">{state.restriction_reason?.replaceAll('_', ' ') || 'Account review required'}</p>
            </div>
            <a href="/profile" class="mt-5 block w-full rounded-xl bg-primary px-4 py-3.5 text-center font-semibold text-white">Account & security</a>
          {:else if state.identity_status === 'conflict'}
            <div class="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-warning-light text-warning"><Icon name="shield" size={25} /></div>
            <div class="text-center">
              <p class="text-sm font-semibold text-warning">Identity review needed</p>
              <h1 class="mt-1 text-2xl font-semibold tracking-tight text-text">We need to confirm account ownership</h1>
              <p class="mt-3 text-sm leading-6 text-text-secondary">We found an identity conflict. For your security, changing the Student ID here cannot bypass this check.</p>
            </div>
            <a href="/verification" class="mt-6 block w-full rounded-xl bg-primary px-4 py-3.5 text-center font-semibold text-white">View verification status</a>
          {:else if state.identity_status === 'rejected'}
            <div class="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-warning-light text-warning"><Icon name="pencil" size={24} /></div>
            <div class="text-center">
              <p class="text-sm font-semibold text-warning">Action needed</p>
              <h1 class="mt-1 text-2xl font-semibold tracking-tight text-text">Your verification needs a correction</h1>
              <p class="mt-3 text-sm leading-6 text-text-secondary">You do not need another account. Fix only the item that was rejected and submit it again.</p>
            </div>
            <a href="/verification" class="mt-6 block w-full rounded-xl bg-primary px-4 py-3.5 text-center font-semibold text-white">Fix verification</a>
          {:else if state.identity_status === 'required'}
            <div class="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-primary-light text-primary"><Icon name="shield" size={24} /></div>
            <div class="text-center">
              <p class="text-sm font-semibold text-primary">One step left</p>
              <h1 class="mt-1 text-2xl font-semibold tracking-tight text-text">Verify your student identity</h1>
              <p class="mt-3 text-sm leading-6 text-text-secondary">Because this account uses a personal email, student-card approval is required before booking or joining matches.</p>
            </div>
            <a href="/verification" class="mt-6 block w-full rounded-xl bg-primary px-4 py-3.5 text-center font-semibold text-white">Start verification</a>
          {:else}
            <div class="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-warning-light text-warning"><Icon name="clock" size={24} /></div>
            <div class="text-center">
              <p class="text-sm font-semibold text-warning">Under review</p>
              <h1 class="mt-1 text-2xl font-semibold tracking-tight text-text">Your student card is being reviewed</h1>
              <p class="mt-3 text-sm leading-6 text-text-secondary">No action is needed right now. Your existing account is the one that will be approved.</p>
            </div>
            <a href="/verification" class="mt-6 block w-full rounded-xl bg-surface-level-1 px-4 py-3.5 text-center font-semibold text-text">View submission</a>
          {/if}
        </section>

        <button on:click={logout} class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-text-secondary hover:text-danger">
          <Icon name="log-out" size={17} /> Sign out
        </button>
      {/if}
    </div>
  </main>
</div>

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
      if (state.can_use_sports && state.access_status === 'approved') await goto('/home')
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

<svelte:head><title>Account status - UNEEM</title></svelte:head>

<div class="account-state-shell px-4 py-8 sm:px-6">
  <main class="mx-auto flex min-h-[75vh] w-full max-w-lg items-center">
    <div class="w-full">
      {#if loading}
        <div class="space-y-3" aria-busy="true">
          <div class="h-48 animate-pulse rounded-3xl bg-surface-level-1"></div>
          <div class="h-12 animate-pulse rounded-2xl bg-surface-level-1"></div>
        </div>
      {:else if error}
        <section class="uneem-panel p-6 text-center sm:p-7">
          <div class="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-danger-light text-danger"><Icon name="alert-triangle" size={22} /></div>
          <h1 class="text-xl font-semibold text-text">We could not load your account</h1>
          <p class="mt-2 text-sm leading-6 text-text-secondary">{error}</p>
          <button on:click={() => location.reload()} class="uneem-primary-action mt-5 w-full">Try again</button>
          <a href="/help" class="uneem-secondary-action mt-3 w-full">Get help</a>
        </section>
      {:else if state}
        <section class="uneem-panel p-6 sm:p-7">
          {#if state.access_status === 'suspended'}
            <div class="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-danger-light text-danger"><Icon name="shield" size={25} /></div>
            <div class="text-center">
              <p class="text-sm font-semibold text-danger">Account restricted</p>
              <h1 class="mt-1 text-2xl font-semibold tracking-[-0.03em] text-text">Your sports access is temporarily unavailable</h1>
              <p class="mt-3 text-sm leading-6 text-text-secondary">You can still secure your account and contact support. Creating another account will not remove this restriction.</p>
            </div>
            <div class="mt-6 rounded-2xl bg-surface-level-1 p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Reason</p>
              <p class="mt-1 text-sm font-medium text-text">{state.restriction_reason?.replaceAll('_', ' ') || 'Account review required'}</p>
            </div>
            <a href="/help" class="uneem-primary-action mt-5 w-full">Request review</a>
            <a href="/profile" class="uneem-secondary-action mt-3 w-full">Account & security</a>
          {:else if state.identity_status === 'conflict'}
            <div class="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-warning-light text-warning"><Icon name="shield" size={25} /></div>
            <div class="text-center">
              <p class="text-sm font-semibold text-warning">Identity review needed</p>
              <h1 class="mt-1 text-2xl font-semibold tracking-[-0.03em] text-text">We need to confirm account ownership</h1>
              <p class="mt-3 text-sm leading-6 text-text-secondary">For security, changing Student ID cannot bypass an identity conflict. Support can help resolve ownership safely.</p>
            </div>
            <a href="/help" class="uneem-primary-action mt-6 w-full">Contact support</a>
            <a href="/verification" class="uneem-secondary-action mt-3 w-full">View verification status</a>
          {:else if state.identity_status === 'rejected'}
            <div class="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-warning-light text-warning"><Icon name="pencil" size={24} /></div>
            <div class="text-center">
              <p class="text-sm font-semibold text-warning">Action needed</p>
              <h1 class="mt-1 text-2xl font-semibold tracking-[-0.03em] text-text">Your verification needs a correction</h1>
              <p class="mt-3 text-sm leading-6 text-text-secondary">Keep this account. Fix only the rejected information or card and submit it again.</p>
            </div>
            <a href="/verification" class="uneem-primary-action mt-6 w-full">Fix verification</a>
            <a href="/help" class="uneem-secondary-action mt-3 w-full">Need help?</a>
          {:else if state.identity_status === 'required'}
            <div class="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-primary-light text-primary"><Icon name="shield" size={24} /></div>
            <div class="text-center">
              <p class="text-sm font-semibold text-primary">One step left</p>
              <h1 class="mt-1 text-2xl font-semibold tracking-[-0.03em] text-text">Verify your student identity</h1>
              <p class="mt-3 text-sm leading-6 text-text-secondary">Personal-email accounts need student-card approval before booking or joining matches.</p>
            </div>
            <a href="/verification" class="uneem-primary-action mt-6 w-full">Start verification</a>
            <a href="/help" class="uneem-secondary-action mt-3 w-full">Get help</a>
          {:else}
            <div class="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-warning-light text-warning"><Icon name="clock" size={24} /></div>
            <div class="text-center">
              <p class="text-sm font-semibold text-warning">Under review</p>
              <h1 class="mt-1 text-2xl font-semibold tracking-[-0.03em] text-text">Your student card is being reviewed</h1>
              <p class="mt-3 text-sm leading-6 text-text-secondary">No action is needed right now. This same account will receive access after approval.</p>
            </div>
            <a href="/verification" class="uneem-secondary-action mt-6 w-full">View submission</a>
            <a href="/help" class="mt-3 block min-h-11 py-3 text-center text-sm font-semibold text-text-secondary">Contact support</a>
          {/if}
        </section>

        <button on:click={logout} class="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-text-secondary hover:text-danger">
          <Icon name="log-out" size={17} /> Sign out
        </button>
      {/if}
    </div>
  </main>
</div>

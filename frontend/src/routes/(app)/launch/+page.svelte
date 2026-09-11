<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import { authState } from '$lib/stores/auth'
  import { resolveAccountRoute, buildResolverContext } from '$lib/accountResolver'
  import { passwordRecoveryActive } from '$lib/authFlow'
  import { canBrowse } from '$lib/access'

  const WELCOME_SEEN_KEY = 'uneem:welcome-seen'

  function hasSeenWelcome(): boolean {
    if (!browser) return false
    return localStorage.getItem(WELCOME_SEEN_KEY) === 'true'
  }

  function markWelcomeSeen(): void {
    if (!browser) return
    localStorage.setItem(WELCOME_SEEN_KEY, 'true')
  }

  let loading = true
  let disposed = false

  onMount(async () => {
    if (!browser) return

    // Check for recovery flow first
    const recoveryActive = $passwordRecoveryActive
    const pathname = $page.url.pathname

    // Wait for auth state to resolve
    while ($authState.loading && !disposed) {
      await new Promise(r => setTimeout(r, 50))
    }
    if (disposed) return

    const hasSession = $authState.user !== null
    const account = $authState.account
    const identity = $authState.identity

    if (recoveryActive && hasSession) {
      await goto('/reset-password')
      return
    }

    if (!hasSession) {
      // No session - check welcome marker
      if (hasSeenWelcome()) {
        await goto('/login')
      } else {
        await goto('/')
      }
      return
    }

    // Has session - use centralized resolver
    const ctx = buildResolverContext(hasSession, account, identity, pathname, recoveryActive)
    const targetPath = resolveAccountRoute(ctx)

    if (targetPath && targetPath !== pathname) {
      await goto(targetPath)
    } else if (!targetPath && canBrowse(account)) {
      // Already at correct destination, ensure welcome is marked
      markWelcomeSeen()
    }
  })

  function cleanup() {
    disposed = true
  }

  // Cleanup on unmount
  import { onDestroy } from 'svelte'
  onDestroy(cleanup)
</script>

<svelte:head><title>UNEEM</title></svelte:head>

<div class="min-h-screen flex items-center justify-center" aria-busy="true" aria-label="Loading UNEEM">
  <div class="space-y-4 animate-pulse">
    <div class="h-8 w-44 rounded-xl bg-surface-level-1"></div>
    <div class="h-24 rounded-3xl bg-surface-level-1"></div>
  </div>
</div>
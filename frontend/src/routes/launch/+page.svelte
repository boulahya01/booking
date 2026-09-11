<script lang="ts">
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { authState } from '$lib/stores/auth'
  import { resolveAccountRoute } from '$lib/accountResolver'

  const welcomeKey = 'unem:welcome-seen'
  let routed = false

  $: if (browser && !$authState.loading && !routed) {
    routed = true

    if ($authState.user) {
      const target = resolveAccountRoute({
        hasSession: true,
        account: $authState.account,
        pathname: '/launch',
        recoveryActive: false,
        bootstrapError: $authState.bootstrapError,
        requestedPath: $page.url.searchParams.get('next')
      })

      void goto(target || '/home', { replaceState: true })
    } else {
      let seen = false
      try { seen = localStorage.getItem(welcomeKey) === '1' } catch { /* Storage is optional. */ }
      void goto(seen ? '/login' : '/', { replaceState: true })
    }
  }
</script>

<svelte:head><title>Opening UNEM Sports…</title></svelte:head>

<div class="launch-shell" aria-busy="true" aria-live="polite">
  <div class="launch-mark" aria-hidden="true"></div>
  <p>Opening UNEM Sports…</p>
</div>

<style>
  .launch-shell {
    min-height: 100dvh;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 14px;
    background: var(--bg);
    color: var(--text-secondary);
    font-size: 14px;
  }
  .launch-mark {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    background: var(--primary);
  }
</style>

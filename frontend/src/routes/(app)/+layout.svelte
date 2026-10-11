<script lang="ts">
  import { onMount } from 'svelte'
  import { authState } from '$lib/stores/auth'
  import { startNotifications } from '$lib/stores/notifications'
  import TopBar from '$lib/components/TopBar.svelte'
  import VerificationNotice from '$lib/components/VerificationNotice.svelte'
  import BottomNav from '$lib/components/BottomNav.svelte'
  import { language } from '$lib/stores/ui'
  import LoadingShape from '$lib/components/LoadingShape.svelte'

  onMount(startNotifications)
</script>

{#if $authState.loading}
  <div class="account-loading" role="status" aria-busy="true">
    <img src="/assets/brand/app-icon.svg" alt="" width="48" height="48" />
    <p>{$language === 'ar' ? 'نجهّز حسابك' : 'Getting your account ready'}</p>
    <LoadingShape className="h-1 w-32" />
  </div>
{:else if $authState.user}
  <div class="app-header">
    <TopBar />
    <VerificationNotice />
  </div>
  <slot />
  <BottomNav />
{/if}

<style>
  .app-header { position: sticky; top: 0; z-index: 40; }
  .account-loading { display: flex; min-height: 55dvh; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 32px; }
  .account-loading img { border-radius: 14px; }
  .account-loading p { color: var(--text-secondary); font-size: 14px; }
</style>

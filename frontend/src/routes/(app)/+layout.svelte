<script lang="ts">
  import { onMount } from 'svelte'
  import { authState } from '$lib/stores/auth'
  import { startNotifications } from '$lib/stores/notifications'
  import TopBar from '$lib/components/TopBar.svelte'
  import VerificationNotice from '$lib/components/VerificationNotice.svelte'
  import BottomNav from '$lib/components/BottomNav.svelte'
  import { language } from '$lib/stores/ui'
  import LoadingShape from '$lib/components/LoadingShape.svelte'
  import SectionNavigation from '$lib/components/SectionNavigation.svelte'
  import { retryAuthBootstrap } from '$lib/authBootstrap'
  import Button from '$lib/components/Button.svelte'
  let retrying = false
  async function retryAccount() {
    if (retrying) return
    retrying = true
    try { await retryAuthBootstrap() } finally { retrying = false }
  }

  onMount(startNotifications)
</script>

<div class="app-header"><TopBar /></div>
{#if $authState.loading}
  <div class="uneem-page startup-placeholder" role="status" aria-busy="true">
    <span class="sr-only">{$language === 'ar' ? 'جارٍ تحميل حسابك' : 'Loading your account'}</span>
    <div class="startup-heading" aria-hidden="true"><LoadingShape className="h-8 w-40" /><LoadingShape className="h-4 w-56" /></div>
    <div class="startup-sections" aria-hidden="true"><LoadingShape className="h-36 w-full rounded-2xl" /><LoadingShape className="h-36 w-full rounded-2xl" /></div>
  </div>
{:else if $authState.user}
  {#key $authState.user.id}
    {#if $authState.refreshError}
      <div class="account-refresh-notice" role="status">
        <p>{$language === 'ar' ? 'تعذر تحديث حسابك. تحقق من اتصالك.' : 'Couldn’t refresh your account. Check your connection.'}</p>
        <Button variant="ghost" size="sm" loading={retrying} on:click={retryAccount}>{$language === 'ar' ? 'إعادة المحاولة' : 'Retry'}</Button>
      </div>
    {/if}
    <VerificationNotice />
    <SectionNavigation />
    <slot />
    <BottomNav />
  {/key}
{/if}

<style>
  .app-header { position: sticky; top: 0; z-index: 40; }
  .account-refresh-notice { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px var(--page-gutter); background: var(--surface-level-1); font-size: 14px; color: var(--text-secondary); }
  .startup-placeholder { max-width: 64rem; }
  .startup-heading { display: grid; gap: 14px; margin-block: 20px 32px; }
  .startup-sections { display: grid; gap: 16px; }
  @media (min-width: 640px) { .startup-sections { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; } }
</style>

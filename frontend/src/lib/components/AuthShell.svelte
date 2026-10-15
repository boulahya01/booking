<script lang="ts">
  import { language } from '$lib/stores/ui'
  import HeaderControls from './HeaderControls.svelte'
  import Icon from './Icon.svelte'
  import PwaInstallCard from './PwaInstallCard.svelte'
  export let backHref = ''
  export let backLabel = 'Back'
  export let brandHref = '/login'
  export let maxWidth = 'max-w-[400px]'
</script>

<div class="auth-shell">
  <div class={`auth-shell-frame ${maxWidth}`}>
    <header class="auth-shell-header">
      <div>
        {#if backHref}
          <a href={backHref} class="uneem-icon-button" aria-label={backLabel}>
            <Icon name={$language === 'ar' ? 'arrow-right' : 'arrow-left'} size={21} />
          </a>
        {:else}
          <a href={brandHref} class="auth-brand" aria-label="UNEM Sports">
            <img src="/assets/brand/app-icon.svg" width="36" height="36" alt="" />
            <span>UNEM Sports</span>
          </a>
        {/if}
      </div>
      <HeaderControls showMenu={false} id="auth" />
    </header>
    <div class="auth-shell-main"><div class="w-full"><slot /></div></div>
    <footer class="auth-shell-footer"><slot name="footer" /><div class="auth-install"><PwaInstallCard compact /></div></footer>
  </div>
</div>

<style>
  .auth-shell {
    display: flex;
    min-height: calc(100dvh - var(--pwa-notice-height, 0px));
    width: 100%;
    padding: max(16px, var(--app-safe-top)) max(var(--page-gutter), var(--app-safe-right)) max(16px, var(--app-safe-bottom)) max(var(--page-gutter), var(--app-safe-left));
    background: var(--bg);
    color: var(--text);
  }
  .auth-shell-frame { display: flex; flex: 1; flex-direction: column; width: 100%; min-width: 0; margin-inline: auto; }
  .auth-shell-header { display: flex; min-height: 44px; align-items: center; justify-content: space-between; gap: 12px; }
  .auth-brand { display: inline-flex; min-height: 44px; align-items: center; gap: 9px; font-size: 15px; font-weight: 500; letter-spacing: var(--tracking-tight); }
  .auth-brand img { border-radius: 11px; }
  .auth-shell-main { display: flex; flex: 1; align-items: flex-start; padding-block: clamp(24px, 4dvh, 40px) 20px; }
  .auth-shell-footer { padding-top: 8px; text-align: center; }
  .auth-install:has(:global(.install-card)) { margin-top: 16px; }
  @media (min-width: 768px) { .auth-shell { padding-block: 24px; } .auth-shell-main { align-items: center; padding-block: 40px; } }
  @media (max-height: 650px) { .auth-shell-main { align-items: flex-start; padding-block: 20px; } }
  :global(html[data-keyboard-open]) .auth-shell-main { align-items: flex-start; padding-block: 24px; }
</style>

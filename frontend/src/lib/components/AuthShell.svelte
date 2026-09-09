<script lang="ts">
  import { language, uiState } from '$lib/stores/ui'
  import Icon from './Icon.svelte'
  export let backHref = ''
  export let backLabel = 'Back'
  export let brandHref = '/login'
  export let maxWidth = 'max-w-[420px]'
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
          <a href={brandHref} class="auth-brand" aria-label="UNEEM">
            <img src="/assets/brand/app-icon.svg" width="36" height="36" alt="" />
            <span>UNEEM</span>
          </a>
        {/if}
      </div>
      <button type="button" class="auth-language" on:click={() => uiState.setLanguage($language === 'en' ? 'ar' : 'en')} aria-label={$language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>
        {$language === 'ar' ? 'English' : 'العربية'}
      </button>
    </header>
    <div class="auth-shell-main"><div class="w-full"><slot /></div></div>
    <footer class="auth-shell-footer"><slot name="footer" /></footer>
  </div>
</div>

<style>
  .auth-shell {
    display: flex;
    min-height: 100dvh;
    width: 100%;
    padding: max(16px, var(--app-safe-top)) max(var(--page-gutter), var(--app-safe-right)) max(16px, var(--app-safe-bottom)) max(var(--page-gutter), var(--app-safe-left));
    background: var(--bg);
    color: var(--text);
  }
  .auth-shell-frame { display: flex; flex: 1; flex-direction: column; width: 100%; min-width: 0; margin-inline: auto; }
  .auth-shell-header { display: flex; min-height: 48px; align-items: center; justify-content: space-between; gap: 16px; }
  .auth-brand { display: inline-flex; min-height: 44px; align-items: center; gap: 10px; font-size: 16px; font-weight: 800; letter-spacing: .1em; }
  .auth-brand img { border-radius: 11px; }
  .auth-language { min-height: 44px; padding-inline: 12px; border-radius: 999px; background: var(--surface); font-family: system-ui, sans-serif; font-size: 14px; font-weight: 600; }
  .auth-shell-main { display: flex; flex: 1; align-items: flex-start; padding-block: clamp(32px, 6dvh, 56px) 32px; }
  .auth-shell-footer { padding-top: 16px; text-align: center; }
  @media (min-width: 768px) { .auth-shell { padding-block: 32px; } .auth-shell-main { align-items: center; padding-block: 56px; } }
  @media (max-height: 650px) { .auth-shell-main { align-items: flex-start; padding-block: 28px; } }
  :global(html[data-keyboard-open]) .auth-shell-main { align-items: flex-start; padding-block: 24px; }
</style>

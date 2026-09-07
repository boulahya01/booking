<script lang="ts">
  import { language, uiState } from '$lib/stores/ui'
  import Icon from './Icon.svelte'

  export let backHref = ''
  export let backLabel = 'Back'
  export let brandHref = '/login'
  export let maxWidth = 'max-w-[420px]'

  function toggleLanguage() {
    uiState.setLanguage($language === 'en' ? 'ar' : 'en')
  }
</script>

<svelte:head>
  <meta name="theme-color" content="#0d0f11" />
</svelte:head>

<div class="auth-shell">
  <div class={`auth-shell-frame mx-auto flex w-full ${maxWidth} flex-col`}>
    <header class="grid min-h-12 grid-cols-[44px_1fr_44px] items-center gap-2">
      <div class="flex justify-start">
        {#if backHref}
          <a href={backHref} class="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" aria-label={backLabel}>
            <Icon name={$language === 'ar' ? 'arrow-right' : 'arrow-left'} size={19} />
          </a>
        {/if}
      </div>

      <a href={brandHref} class="justify-self-center text-[19px] font-bold tracking-[0.18em] text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" aria-label="UNEEM">UNEEM</a>

      <button type="button" on:click={toggleLanguage} class="flex h-11 min-w-11 items-center justify-center justify-self-end rounded-full px-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" aria-label="Toggle language">
        {$language === 'ar' ? 'EN' : 'AR'}
      </button>
    </header>

    <main class="auth-shell-main">
      <div class="w-full"><slot /></div>
    </main>

    <footer class="auth-shell-footer">
      <slot name="footer" />
    </footer>
  </div>
</div>

<style>
  .auth-shell {
    --primary: #ff6a00;
    --primary-hover: #ff7a1a;
    --primary-light: rgba(255, 106, 0, 0.10);
    --primary-dark: #db5b00;
    --text: #f7f8fa;
    --text-secondary: #b4b8bf;
    --text-muted: #7f858d;
    --text-inverse: #0d0f11;
    --bg: #0d0f11;
    --surface: #15181b;
    --surface-raised: #181c20;
    --surface-level-1: #1b1f23;
    --surface-level-2: #23282e;
    --border: #2b3036;
    --border-light: #20252a;

    display: flex;
    min-height: 100vh;
    min-height: 100dvh;
    width: 100%;
    overflow-x: hidden;
    padding-top: max(0.875rem, env(safe-area-inset-top));
    padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
    padding-inline-start: max(1.25rem, calc(env(safe-area-inset-left) + 1rem));
    padding-inline-end: max(1.25rem, calc(env(safe-area-inset-right) + 1rem));
    background: #0d0f11;
    color: var(--text);
  }

  .auth-shell-frame {
    flex: 1;
    min-height: 0;
  }

  .auth-shell-main {
    display: flex;
    flex: 1;
    align-items: center;
    padding-block: clamp(1.75rem, 6dvh, 3.75rem);
  }

  .auth-shell-footer {
    padding-top: 0.75rem;
  }

  @media (max-height: 700px) {
    .auth-shell-main {
      align-items: flex-start;
      padding-block: 1.5rem;
    }
  }

  @media (min-width: 640px) {
    .auth-shell {
      padding-top: max(2rem, env(safe-area-inset-top));
      padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
      padding-inline: max(1.5rem, env(safe-area-inset-left)) max(1.5rem, env(safe-area-inset-right));
    }
  }

  :global(.auth-shell a:hover) { text-decoration: none; }
</style>

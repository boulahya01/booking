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
  <meta name="theme-color" content="#101214" />
</svelte:head>

<div class="auth-shell min-h-screen px-5 py-4 sm:px-6 sm:py-8">
  <div class={`mx-auto flex min-h-[calc(100vh-2rem)] w-full ${maxWidth} flex-col`}>
    <header class="grid min-h-12 grid-cols-[44px_1fr_44px] items-center gap-2">
      <div class="flex justify-start">
        {#if backHref}
          <a href={backHref} class="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" aria-label={backLabel}>
            <Icon name={$language === 'ar' ? 'arrow-right' : 'arrow-left'} size={19} />
          </a>
        {/if}
      </div>

      <a href={brandHref} class="justify-self-center text-[21px] font-bold tracking-[0.18em] text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" aria-label="UNEEM">UNEEM</a>

      <button type="button" on:click={toggleLanguage} class="flex h-11 min-w-11 items-center justify-center justify-self-end rounded-full px-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" aria-label="Toggle language">
        {$language === 'ar' ? 'EN' : 'AR'}
      </button>
    </header>

    <main class="flex flex-1 items-start pt-9 sm:pt-14">
      <div class="w-full"><slot /></div>
    </main>

    <footer class="pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-7">
      <slot name="footer" />
    </footer>
  </div>
</div>

<style>
  .auth-shell {
    --primary: #ff6a00;
    --primary-hover: #ff7a1a;
    --primary-light: rgba(255, 106, 0, 0.12);
    --primary-dark: #db5b00;
    --text: #f7f8fa;
    --text-secondary: #b4b8bf;
    --text-muted: #7f858d;
    --text-inverse: #101214;
    --bg: #101214;
    --surface: #171a1e;
    --surface-raised: #1b1f24;
    --surface-level-1: #1e2227;
    --surface-level-2: #282d34;
    --border: #2b3037;
    --border-light: #23282e;
    background: radial-gradient(circle at 50% 36%, rgba(255, 106, 0, 0.065), transparent 32rem), #101214;
    color: var(--text);
  }

  :global(.auth-shell a:hover) { text-decoration: none; }
</style>

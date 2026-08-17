<script lang="ts">
  import { language, uiState } from '$lib/stores/ui'
  import Icon from './Icon.svelte'

  export let backHref = ''
  export let backLabel = 'Back'
  export let brandHref = '/login'
  export let maxWidth = 'max-w-md'

  function toggleLanguage() {
    uiState.setLanguage($language === 'en' ? 'ar' : 'en')
  }
</script>

<div class="min-h-screen bg-background px-4 py-6 sm:py-10">
  <div class={`mx-auto flex min-h-[calc(100vh-3rem)] w-full ${maxWidth} flex-col`}>
    <header class="flex min-h-11 items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        {#if backHref}
          <a
            href={backHref}
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
            aria-label={backLabel}
          >
            <Icon name={$language === 'ar' ? 'arrow-right' : 'arrow-left'} size={18} />
          </a>
        {/if}
        <a href={brandHref} class="truncate text-lg font-bold tracking-tight text-text">UNEEM</a>
      </div>

      <button
        type="button"
        on:click={toggleLanguage}
        class="min-h-10 min-w-10 rounded-full px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
        aria-label="Toggle language"
      >
        {$language === 'ar' ? 'EN' : 'ع'}
      </button>
    </header>

    <main class="flex flex-1 items-start pt-12 sm:pt-20">
      <div class="w-full">
        <slot />
      </div>
    </main>

    <div class="pb-[max(0.25rem,env(safe-area-inset-bottom))]">
      <slot name="footer" />
    </div>
  </div>
</div>

<script lang="ts">
  import { page } from '$app/stores'
  import { _ } from 'svelte-i18n'

  $: status = $page.status
  $: message = $page.error?.message ?? 'Something went wrong'
</script>

<div class="min-h-screen flex items-center justify-center px-4 py-8" style="background: var(--bg);">
  <div class="max-w-md w-full text-center space-y-6">
    <div class="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
         style="background: var(--danger-light/50);">
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none"
           stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </div>

    <div>
      <h1 class="text-2xl font-serif font-medium" style="color: var(--text);">
        {status >= 500 ? 'Server Error' : status >= 400 ? 'Page Not Found' : 'Error'}
      </h1>
      <p class="text-text-secondary mt-2">
        {status === 404
          ? 'The page you\'re looking for doesn\'t exist.'
          : 'An unexpected error occurred. Please try refreshing the page.'}
      </p>
    </div>

    {#if message && status !== 404}
      <div class="rounded-xl p-4 text-sm text-start"
           style="background: var(--surface-level-1); border: 1px solid var(--border);">
        <p class="font-medium mb-1" style="color: var(--text-muted);">Details:</p>
        <p style="color: var(--text-secondary);">{message}</p>
      </div>
    {/if}

    <div class="flex gap-3">
      <a href="/home"
         class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
         style="background: var(--primary-gradient); box-shadow: 0 0 0 1px var(--primary);">
        Go Home
      </a>
      <button
        on:click={() => window.location.reload()}
        class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5"
        style="background: var(--surface-level-1); color: var(--text); border: 1px solid var(--border);">
        Refresh Page
      </button>
    </div>
  </div>
</div>

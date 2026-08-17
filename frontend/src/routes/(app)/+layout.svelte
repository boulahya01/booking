<script lang="ts">
  import { authState } from '$lib/stores/auth'
</script>

{#if $authState.loading}
  <div class="max-w-5xl mx-auto px-4 py-6" aria-busy="true" aria-label="Loading account">
    <div class="space-y-4 animate-pulse">
      <div class="h-7 w-44 rounded-lg bg-surface-level-1"></div>
      <div class="h-24 rounded-xl bg-surface-level-1"></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each Array(3) as _}
          <div class="h-32 rounded-xl bg-surface-level-1"></div>
        {/each}
      </div>
    </div>
  </div>
{:else if $authState.user}
  <slot />
{/if}

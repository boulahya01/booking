<script lang="ts">
  import { authState } from '$lib/stores/auth'
  import BottomNav from '$lib/components/BottomNav.svelte'
</script>

{#if $authState.loading}
  <div class="uneem-page-narrow" aria-busy="true" aria-label="Loading account">
    <div class="space-y-4 animate-pulse">
      <div class="h-8 w-44 rounded-xl bg-surface-level-1"></div>
      <div class="h-24 rounded-3xl bg-surface-level-1"></div>
      <div class="space-y-3">
        {#each Array(3) as _}<div class="h-28 rounded-3xl bg-surface-level-1"></div>{/each}
      </div>
    </div>
  </div>
{:else if $authState.user}
  <slot />
  <BottomNav />
{/if}

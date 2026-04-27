<script lang="ts">
  import { cn } from '$lib/utils/cn'

  export let type: 'card' | 'text' | 'circle' | 'button' | 'slot' = 'card'
  export let count = 1
  export let className = ''

  const types = {
    card: 'h-32 rounded-xl',
    text: 'h-4 rounded w-full',
    circle: 'h-12 w-12 rounded-full',
    button: 'h-10 rounded-lg w-24',
    slot: 'slot-skeleton'
  }
</script>

{#if type === 'slot'}
  <div class={cn('space-y-3', className)}>
    {#each Array(count) as _}
      <div class="rounded-xl p-5 flex flex-col justify-between gap-4 min-h-[180px]"
           style="background: var(--surface); border: 1px solid var(--border); box-shadow: 0 0 0 1px var(--border);">
        <!-- Large time skeleton -->
        <div class="text-center">
          <div class="mx-auto h-10 w-32 rounded-lg animate-pulse" style="background: var(--surface-level-1);"></div>
          <div class="mx-auto mt-2 h-4 w-16 rounded animate-pulse" style="background: var(--surface-level-1);"></div>
        </div>
        <!-- Booker info skeleton -->
        <div class="mx-auto h-9 w-40 rounded-lg animate-pulse" style="background: var(--surface-level-1);"></div>
        <!-- Button skeleton -->
        <div class="h-11 w-full rounded-lg animate-pulse" style="background: var(--surface-level-1);"></div>
      </div>
    {/each}
  </div>
{:else}
  <div class={cn('space-y-3', className)}>
    {#each Array(count) as _}
      <div
        class={cn(
          'bg-surface-level-1 animate-pulse',
          types[type]
        )}
      ></div>
    {/each}
  </div>
{/if}

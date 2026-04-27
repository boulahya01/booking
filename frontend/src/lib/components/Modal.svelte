<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { cn } from '$lib/utils/cn'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'

  export let open = false
  export let title = ''
  export let size: 'sm' | 'md' | 'lg' = 'md'
  export let showClose = true

  const dispatch = createEventDispatcher()

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg'
  }

  function handleClose() {
    open = false
    dispatch('close')
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 transition-opacity"
    on:click={handleBackdropClick}
    role="presentation"
  ></div>

  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
  >
    <div
      class={cn(
        'bg-surface rounded-2xl shadow-xl pointer-events-auto',
        'max-h-[90vh] overflow-y-auto',
        sizes[size],
        'w-full'
      )}
    >
      <div class="flex items-center justify-between p-5 border-b border-border dark:border-white/6">
        <h2 class="text-lg font-medium font-serif text-text">
          {title}
        </h2>
        {#if showClose}
          <button
            on:click={handleClose}
            class="text-text-muted hover:text-text transition"
            aria-label="Close"
          >
            <Icon name="x" size={20} />
          </button>
        {/if}
      </div>

      <div class="p-5">
        <slot />
      </div>

      {#if $$slots.footer}
        <div class="p-5 border-t border-border dark:border-white/6 flex gap-3 justify-end">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}

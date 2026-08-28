<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { cn } from '$lib/utils/cn'
  import Icon from './Icon.svelte'

  export let open = false
  export let title = ''
  export let size: 'sm' | 'md' | 'lg' = 'md'
  export let showClose = true

  const dispatch = createEventDispatcher()
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

  function handleClose() {
    open = false
    dispatch('close')
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) handleClose()
  }
</script>

{#if open}
  <div class="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" on:click={handleBackdropClick} role="presentation"></div>
  <div class="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
    <section class={cn('pointer-events-auto max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] border border-border-light bg-surface-raised shadow-xl sm:rounded-[26px]', sizes[size])} role="dialog" aria-modal="true" tabindex="-1">
      <div class="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden"></div>
      <header class="flex min-h-16 items-center justify-between gap-4 border-b border-border-light px-5">
        <div class="min-w-0 flex-1">
          {#if title}<h2 class="truncate text-lg font-bold tracking-[-0.02em] text-text">{title}</h2>{/if}
          <slot name="header" />
        </div>
        {#if showClose}
          <button on:click={handleClose} class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface-level-1 hover:text-text" aria-label="Close">
            <Icon name="x" size={19} />
          </button>
        {/if}
      </header>
      <div class="p-5"><slot /></div>
      {#if $$slots.body}<div class="p-5"><slot name="body" /></div>{/if}
      {#if $$slots.footer}<footer class="flex flex-wrap justify-end gap-3 border-t border-border-light p-5"><slot name="footer" /></footer>{/if}
    </section>
  </div>
{/if}

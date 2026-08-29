<script lang="ts">
  import { browser } from '$app/environment'
  import { createEventDispatcher, tick } from 'svelte'
  import { cn } from '$lib/utils/cn'
  import Icon from './Icon.svelte'

  export let open = false
  export let title = ''
  export let size: 'sm' | 'md' | 'lg' = 'md'
  export let showClose = true

  const dispatch = createEventDispatcher()
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }
  let dialogElement: HTMLElement | null = null
  let previousFocus: HTMLElement | null = null
  let wasOpen = false

  $: if (browser) {
    if (open && !wasOpen) {
      wasOpen = true
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      void tick().then(() => dialogElement?.focus())
    } else if (!open && wasOpen) {
      wasOpen = false
      const trigger = previousFocus
      previousFocus = null
      void tick().then(() => {
        if (trigger?.isConnected) trigger.focus()
      })
    }
  }

  function handleClose() {
    open = false
    dispatch('close')
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) handleClose()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      handleClose()
      return
    }

    if (event.key !== 'Tab' || !dialogElement) return

    const focusable = Array.from(
      dialogElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')

    if (focusable.length === 0) {
      event.preventDefault()
      dialogElement.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (event.shiftKey && (active === first || active === dialogElement)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" on:click={handleBackdropClick} role="presentation"></div>
  <div class="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
    <section
      bind:this={dialogElement}
      class={cn('pointer-events-auto max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] border border-border-light bg-surface-raised shadow-xl sm:rounded-[26px]', sizes[size])}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
      tabindex="-1"
      on:keydown={handleKeydown}
    >
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

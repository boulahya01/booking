<script lang="ts">
  import { cn } from '$lib/utils/cn'

  type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
  type Size = 'sm' | 'md' | 'lg'

  export let variant: Variant = 'primary'
  export let size: Size = 'md'
  export let disabled = false
  export let loading = false
  export let type: 'button' | 'submit' | 'reset' = 'button'
  export let className = ''

  const baseClass = [
    'inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold',
    'transition-[background-color,color,border-color,transform] duration-150 active:translate-y-px',
    'disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
  ].join(' ')

  const variants = {
    primary: 'bg-[var(--primary-action)] text-white hover:bg-[var(--primary-action-hover)]',
    secondary: 'border border-border bg-transparent text-text hover:bg-surface-level-1',
    danger: 'bg-danger text-white hover:bg-danger/90',
    ghost: 'bg-transparent text-text-secondary hover:bg-surface-level-1 hover:text-text'
  }

  const sizes = {
    sm: 'min-h-[40px] px-3.5 text-sm',
    md: 'min-h-[46px] px-4 text-sm',
    lg: 'min-h-[50px] px-5 text-[15px]'
  }

  $: isDisabled = disabled || loading
  $: buttonClass = cn(baseClass, variants[variant], sizes[size], 'touch-target-min', className)
</script>

<button
  {type}
  disabled={isDisabled}
  aria-busy={loading}
  class={buttonClass}
  on:click
  {...$$restProps}
>
  {#if loading}
    <span class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" aria-hidden="true"></span>
  {/if}
  <slot />
</button>

<style>
  :global(.touch-target-min) { min-width: 44px; }
</style>

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
    'inline-flex items-center justify-center gap-2 rounded-[18px] font-semibold',
    'transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.995]',
    'disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
  ].join(' ')

  const variants = {
    primary: 'bg-primary text-text-inverse hover:bg-primary-hover',
    secondary: 'border border-border bg-surface text-text hover:bg-surface-level-1',
    danger: 'bg-danger text-white hover:bg-danger/90',
    ghost: 'bg-transparent text-text-secondary hover:bg-surface-level-1 hover:text-text'
  }

  const sizes = {
    sm: 'min-h-[42px] px-3.5 text-sm',
    md: 'min-h-[48px] px-4 text-sm',
    lg: 'min-h-[56px] px-5 text-base'
  }

  $: buttonClass = cn(baseClass, variants[variant], sizes[size], 'touch-target-min', className)
</script>

<button {type} {disabled} class={buttonClass} on:click {...$$restProps}>
  {#if loading}
    <span class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" aria-hidden="true"></span>
  {/if}
  <slot />
</button>

<style>
  :global(.touch-target-min) { min-width: 44px; }
</style>

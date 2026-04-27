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

  const baseClass = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-info'

  const variants = {
    primary:
      'bg-primary hover:bg-primary-hover text-white shadow-sm hover:shadow-primary',
    secondary:
      'bg-primary-light text-primary hover:bg-primary-light/80 border border-primary/20',
    danger:
      'bg-danger hover:bg-danger/90 text-white shadow-sm',
    ghost:
      'text-primary hover:bg-primary-light'
  }

  const sizes = {
    sm: 'px-3 py-2 text-sm gap-2 min-h-[36px]',
    md: 'px-4 py-2.5 text-base gap-2 min-h-[44px]',
    lg: 'px-5 py-3 text-lg gap-3 min-h-[48px]'
  }

  $: buttonClass = cn(
    baseClass,
    variants[variant],
    sizes[size],
    'touch-target-min',
    className
  )
</script>

<button
  {type}
  {disabled}
  class={buttonClass}
  on:click
  {...$$restProps}
>
  {#if loading}
    <span class="inline-block animate-spin">⟳</span>
  {/if}
  <slot />
</button>

<style>
  :global(.touch-target-min) {
    @apply min-w-[44px];
  }
</style>

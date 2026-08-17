<script lang="ts">
  import { cn } from '$lib/utils/cn'
  import Icon from './Icon.svelte'

  type Variant = 'primary' | 'secondary' | 'ghost'
  type Size = 'sm' | 'md' | 'lg'

  export let href = '#'
  export let variant: Variant = 'secondary'
  export let size: Size = 'md'
  export let icon = ''
  export let className = ''

  const baseClass = [
    'inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold text-center',
    'transition-colors duration-150',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
  ].join(' ')

  const variants = {
    primary: 'bg-primary text-text-inverse hover:bg-primary-hover',
    secondary: 'border border-border bg-surface text-text hover:bg-surface-level-1',
    ghost: 'bg-transparent text-text-secondary hover:bg-surface-level-1 hover:text-text'
  }

  const sizes = {
    sm: 'min-h-[40px] px-3.5 text-sm',
    md: 'min-h-[46px] px-4 text-sm',
    lg: 'min-h-[52px] px-5 text-base'
  }

  $: linkClass = cn(baseClass, variants[variant], sizes[size], className)
</script>

<a {href} class={linkClass} {...$$restProps}>
  {#if icon}<Icon name={icon} size={17} />{/if}
  <slot />
</a>

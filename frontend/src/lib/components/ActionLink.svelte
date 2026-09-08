<script lang="ts">
  import { cn } from '$lib/utils/cn'
  import Icon from './Icon.svelte'
  export let href: string
  export let variant: 'primary' | 'secondary' | 'ghost' = 'secondary'
  export let size: 'sm' | 'md' | 'lg' = 'md'
  export let icon = ''
  export let fullWidth = false
  export let className = ''
</script>

<a {...$$restProps} {href} class={cn('ui-button', `ui-button--${variant}`, `ui-button--${size}`, fullWidth && 'w-full', className)}>
  {#if icon}<Icon name={icon} size={20} />{/if}
  <slot />
</a>

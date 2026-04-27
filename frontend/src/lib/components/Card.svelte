<script lang="ts">
  import { cn } from '$lib/utils/cn'

  type Variant = 'elevated' | 'outlined' | 'filled'

  export let variant: Variant = 'elevated'
  export let className = ''

  const variants = {
    elevated:
      'bg-surface shadow-sm hover:shadow-md transition-shadow',
    outlined:
      'bg-surface border',
    filled:
      'bg-surface-level-1 border'
  }

  $: cardClass = cn(
    'rounded-xl p-4 transition-all duration-200',
    variants[variant],
    className
  )
</script>

<div class={cardClass}>
  <slot />
</div>

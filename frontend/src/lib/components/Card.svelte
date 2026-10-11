<script lang="ts">
  import { cn } from '$lib/utils/cn'

  type Variant = 'elevated' | 'outlined' | 'filled'
  export let variant: Variant = 'elevated'
  export let className = ''

  const variants = {
    elevated: 'bg-surface',
    outlined: 'border border-border bg-surface',
    filled: 'bg-surface-level-1'
  }

  $: cardClass = cn('rounded-[22px] p-5', variants[variant], className)
</script>

<div class={cardClass}><slot /></div>

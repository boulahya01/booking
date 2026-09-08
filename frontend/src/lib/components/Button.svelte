<script lang="ts">
  import { cn } from '$lib/utils/cn'
  import { interfaceReady } from '$lib/stores/ui'
  export let variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'primary'
  export let size: 'sm' | 'md' | 'lg' = 'md'
  export let disabled = false
  export let loading = false
  export let fullWidth = false
  export let type: 'button' | 'submit' | 'reset' = 'button'
  export let className = ''
</script>

<button {...$$restProps} {type} disabled={disabled || loading || !$interfaceReady} aria-busy={loading}
  class={cn('ui-button', `ui-button--${variant}`, `ui-button--${size}`, fullWidth && 'w-full', className)} on:click>
  <span class="ui-button-label" class:opacity-0={loading}><slot /></span>
  {#if loading}<span class="ui-button-spinner" aria-hidden="true"></span>{/if}
</button>

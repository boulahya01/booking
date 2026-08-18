<script lang="ts">
  import { cn } from '$lib/utils/cn'

  export let checked: boolean = false
  export let onToggle: () => void = () => {}
  export let label: string = ''
  export let disabled: boolean = false
</script>

<label class="flex items-center gap-3 cursor-pointer" class:cursor-not-allowed={disabled}>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label || 'Toggle'}
    class={cn(
      'relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200',
      'focus:outline-none focus:ring-2 focus:ring-info-light focus:ring-offset-2 focus:ring-offset-surface',
      checked ? 'bg-primary' : 'bg-surface-level-2',
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    )}
    disabled={disabled}
    on:click={onToggle}
  >
    <span
      class={cn(
        'inline-block w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200',
        checked ? 'translate-x-6' : 'translate-x-1'
      )}
    ></span>
  </button>
  {#if label}
    <span class="text-sm text-text-secondary">{label}</span>
  {/if}
</label>

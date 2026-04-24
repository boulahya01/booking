<script lang="ts">
  export let type: 'button' | 'submit' | 'reset' = 'button'
  export let disabled = false
  export let className = ''
</script>

<button class={`neon-button ${className}`} {type} disabled={disabled}>
  <slot />
</button>

<style>
  /* additional local styles could go here */
</style>

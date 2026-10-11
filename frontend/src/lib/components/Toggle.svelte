<script lang="ts">
  export let checked = false
  export let onToggle: () => void = () => {}
  export let label = ''
  export let disabled = false
</script>

<button type="button" role="switch" aria-checked={checked} aria-label={label || 'Toggle'} {disabled} class="ui-toggle" on:click={onToggle}>
  {#if label}<span class="ui-toggle-label">{label}</span>{/if}
  <span class="ui-toggle-track" class:is-checked={checked}><span class="ui-toggle-thumb"></span></span>
</button>

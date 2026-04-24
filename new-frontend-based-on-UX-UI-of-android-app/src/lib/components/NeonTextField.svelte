<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  export let value: string = ''
  export let label: string = ''
  export let placeholder: string = ''
  export let type: string = 'text'
  export let required: boolean = false
  export let name: string = ''
  const dispatch = createEventDispatcher()

  function onInput(e: Event) {
    const target = e.target as HTMLInputElement
    value = target.value
    dispatch('input', { value })
  }
</script>

<label class="neon-textfield">
  {#if label}
    <span class="label" style="margin-bottom:.4rem;font-weight:600">{label}</span>
  {/if}
  <input {type} bind:value on:input={onInput} placeholder={placeholder} name={name} required={required} />
</label>

<style>
  /* small local tweaks can be added here */
</style>

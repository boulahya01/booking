<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { cn } from '$lib/utils/cn'
  import Icon from './Icon.svelte'

  export let label = ''
  export let placeholder = ''
  export let type = 'text'
  export let value: string | number = ''
  export let error = ''
  export let disabled = false
  export let required = false
  export let icon = ''
  export let className = ''

  const dispatch = createEventDispatcher()

  let focused = false
  let showPassword = false

  $: isPassword = type === 'password'
  $: inputType = isPassword && showPassword ? 'text' : type

  function handleFocus() {
    focused = true
    dispatch('focus')
  }

  function handleBlur() {
    focused = false
    dispatch('blur')
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword
  }
</script>

<div class="w-full">
  {#if label}
    <label for={label} class="mb-1.5 block text-sm font-semibold text-text">
      {label}
      {#if required}<span class="text-danger"> *</span>{/if}
    </label>
  {/if}

  <div class={cn('relative', className)}>
    {#if icon}
      <span class="absolute start-3 top-1/2 -translate-y-1/2 text-text-muted">
        {icon}
      </span>
    {/if}

    <input
      id={label}
      type={inputType}
      {placeholder}
      bind:value
      {disabled}
      {required}
      aria-invalid={error ? 'true' : undefined}
      on:focus={handleFocus}
      on:blur={handleBlur}
      class={cn(
        'min-h-[50px] w-full rounded-[14px] border bg-surface px-4 py-3 text-[15px] text-text outline-none',
        'placeholder:text-text-muted/90 transition-colors duration-150',
        icon && 'ps-10',
        isPassword && 'pe-12',
        error
          ? 'border-danger focus:ring-2 focus:ring-danger/15'
          : focused
            ? 'border-primary ring-2 ring-primary/15'
            : 'border-border',
        disabled && 'cursor-not-allowed bg-surface-level-1 text-text-muted opacity-70'
      )}
    />

    {#if isPassword}
      <button
        type="button"
        on:click={togglePasswordVisibility}
        class="absolute end-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-level-1 hover:text-text"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
      </button>
    {/if}
  </div>

  {#if error}
    <p class="mt-1.5 px-1 text-xs font-medium leading-5 text-danger">{error}</p>
  {/if}
</div>

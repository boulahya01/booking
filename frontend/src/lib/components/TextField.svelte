<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { cn } from '$lib/utils/cn'
  import Icon from './Icon.svelte'

  type ValidationState = 'idle' | 'valid' | 'invalid'

  export let label = ''
  export let placeholder = ''
  export let type = 'text'
  export let value: string | number = ''
  export let error = ''
  export let hint = ''
  export let validHint = ''
  export let validation: ValidationState = 'idle'
  export let disabled = false
  export let required = false
  export let icon = ''
  export let autocomplete = ''
  export let className = ''

  const dispatch = createEventDispatcher()

  let focused = false
  let showPassword = false

  $: isPassword = type === 'password'
  $: inputType = isPassword && showPassword ? 'text' : type
  $: state = error ? 'invalid' : validation
  $: message = error || (state === 'valid' ? (validHint || hint) : hint)
  $: messageTone = state === 'valid'
    ? 'text-success'
    : state === 'invalid'
      ? 'text-danger'
      : 'text-text-muted'

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
      <span class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-muted">
        <Icon name={icon} size={18} />
      </span>
    {/if}

    <input
      id={label}
      type={inputType}
      {placeholder}
      bind:value
      {disabled}
      {required}
      autocomplete={autocomplete || undefined}
      aria-invalid={state === 'invalid' ? 'true' : undefined}
      on:focus={handleFocus}
      on:blur={handleBlur}
      class={cn(
        'min-h-[50px] w-full rounded-[14px] border bg-surface px-4 py-3 text-[15px] text-text outline-none',
        'placeholder:text-text-muted/80 transition-colors duration-150',
        icon && 'ps-10',
        isPassword && state !== 'idle' ? 'pe-20' : isPassword ? 'pe-12' : state !== 'idle' ? 'pe-11' : '',
        state === 'invalid'
          ? 'border-danger focus:ring-2 focus:ring-danger/15'
          : state === 'valid'
            ? 'border-success/70 focus:ring-2 focus:ring-success/15'
            : focused
              ? 'border-primary ring-2 ring-primary/15'
              : 'border-border',
        disabled && 'cursor-not-allowed bg-surface-level-1 text-text-muted opacity-70'
      )}
    />

    {#if state !== 'idle'}
      <span
        class={cn(
          'pointer-events-none absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full',
          isPassword ? 'end-11' : 'end-2.5',
          state === 'valid' ? 'text-success' : 'text-danger'
        )}
        aria-hidden="true"
      >
        <Icon name={state === 'valid' ? 'check' : 'x'} size={16} strokeWidth={2.4} />
      </span>
    {/if}

    {#if isPassword}
      <button
        type="button"
        on:click={togglePasswordVisibility}
        class="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-level-1 hover:text-text"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
      </button>
    {/if}
  </div>

  {#if message}
    <div class={cn('mt-1.5 flex min-h-5 items-start gap-1.5 px-1 text-xs font-medium leading-5', messageTone)}>
      {#if state !== 'idle'}
        <Icon name={state === 'valid' ? 'check' : 'x'} size={13} className="mt-[3px] shrink-0" strokeWidth={2.4} />
      {/if}
      <span>{message}</span>
    </div>
  {/if}
</div>

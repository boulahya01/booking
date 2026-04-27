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
  $: isPassword = type === 'password'
  $: showPassword = false
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
    <label for={label} class="block text-sm font-medium text-text-secondary mb-1.5">
      {label}
      {#if required}
        <span class="text-danger">*</span>
      {/if}
    </label>
  {/if}

  <div class={cn('relative', className)}>
    {#if icon}
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
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
      on:focus={handleFocus}
      on:blur={handleBlur}
      class={cn(
        'w-full px-4 py-2.5 rounded-lg border transition-all duration-200',
        'bg-surface text-text',
        'placeholder:text-text-muted',
        'min-h-[44px]',
        icon && 'pl-10',
        isPassword && 'pr-12',
        error
          ? 'border-danger focus:ring-2 focus:ring-danger-light'
          : focused
            ? 'border-info focus:ring-2 focus:ring-info-light'
            : 'border-border dark:border-white/8',
        disabled && 'opacity-50 cursor-not-allowed bg-surface-level-1'
      )}
    />

    {#if isPassword}
      <button
        type="button"
        on:click={togglePasswordVisibility}
        class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors p-1"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
      </button>
    {/if}
  </div>

  {#if error}
    <div class="flex items-center gap-2 text-xs px-1 mt-1.5">
      <Icon name="x" size={14} className="text-danger" />
      <span class="text-danger">{error}</span>
    </div>
  {/if}
</div>

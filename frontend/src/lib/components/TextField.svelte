<script lang="ts">
  import { createEventDispatcher, type Snippet } from 'svelte'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import { language, interfaceReady } from '$lib/stores/ui'
  import Icon from './Icon.svelte'

  type Props = {
    label?: string; ariaLabel?: string; placeholder?: string; type?: string;
    value?: string | number; error?: string; hint?: string; validHint?: string;
    validation?: 'idle' | 'valid' | 'invalid'; disabled?: boolean; required?: boolean;
    icon?: string; className?: string; id?: string; labelAction?: Snippet;
    autocomplete?: HTMLInputAttributes['autocomplete']; inputmode?: HTMLInputAttributes['inputmode'];
    autocapitalize?: HTMLInputAttributes['autocapitalize']; spellcheck?: HTMLInputAttributes['spellcheck'];
    maxlength?: number; name?: string; enterkeyhint?: HTMLInputAttributes['enterkeyhint'];
  }
  const fieldId = $props.id()
  let { label = '', ariaLabel = '', placeholder = '', type = 'text', value = $bindable<string | number>(''),
    error = '', hint = '', validHint = '', validation = 'idle', disabled = false, required = false,
    icon = '', className = '', id = fieldId, labelAction, autocomplete, inputmode, autocapitalize, spellcheck, maxlength, name, enterkeyhint }: Props = $props()
  const dispatch = createEventDispatcher()
  let showPassword = $state(false)
  const isPassword = $derived(type === 'password')
  const validationState = $derived(error ? 'invalid' : validation)
  const message = $derived(error || (validationState === 'valid' ? (validHint || hint) : hint))
</script>

<div class="ui-field" data-state={validationState}>
  {#if label || labelAction}
    <div class="ui-field-heading">
      {#if label}<label for={id} class="ui-field-label">{label}</label>{/if}
      {#if labelAction}{@render labelAction()}{/if}
    </div>
  {/if}
  <div class={`ui-field-control ${className}`}>
    {#if icon}<span class="ui-field-icon"><Icon name={icon} size={20} /></span>{/if}
    <input {id} {name} aria-label={ariaLabel || label || placeholder} type={isPassword && showPassword ? 'text' : type}
      {placeholder} bind:value disabled={disabled || !$interfaceReady} {required} {autocomplete} {inputmode} {autocapitalize} {spellcheck} {maxlength} {enterkeyhint}
      aria-invalid={validationState === 'invalid' ? 'true' : undefined} aria-describedby={message ? `${id}-message` : undefined}
      onfocus={() => dispatch('focus')} onblur={() => dispatch('blur')} oninput={(event) => dispatch('input', event)}
      class="uneem-field" class:has-icon={!!icon} class:has-action={isPassword} />
    {#if isPassword}
      <button type="button" class="ui-field-action" onmousedown={(event) => event.preventDefault()} onclick={() => showPassword = !showPassword}
        aria-label={$language === 'ar' ? (showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور') : (showPassword ? 'Hide password' : 'Show password')} aria-pressed={showPassword}>
        <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} />
      </button>
    {/if}
  </div>
  {#if message}<p id={`${id}-message`} class="ui-field-message" aria-live="polite">{message}</p>{/if}
</div>

<style>
  .ui-field { width: 100%; min-width: 0; }
  .ui-field-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; margin-bottom: 8px; }
  .ui-field-label { display: block; font-size: 14px; font-weight: 550; color: var(--text-secondary); }
  .ui-field-control { position: relative; }
  .uneem-field { min-height: 56px; padding: 15px 16px; font-size: 16px; }
  .has-icon { padding-inline-start: 48px; }
  .has-action { padding-inline-end: 52px; }
  .ui-field-icon { position: absolute; inset-inline-start: 16px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
  .ui-field-action { position: absolute; inset-inline-end: 4px; top: 50%; display: grid; width: 44px; height: 44px; transform: translateY(-50%); place-items: center; border-radius: 14px; color: var(--text-secondary); }
  .ui-field-message { margin: 8px 4px 0; font-size: 13px; line-height: 1.5; color: var(--text-secondary); }
  [data-state='invalid'] .uneem-field { border-color: var(--danger); }
  [data-state='invalid'] .ui-field-message { color: var(--danger); }
</style>

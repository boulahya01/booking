<script lang="ts">
  import { browser } from '$app/environment'
  import { createEventDispatcher, onDestroy } from 'svelte'
  import { language } from '$lib/stores/ui'
  import Icon from './Icon.svelte'

  export let open = false
  export let title = ''
  export let size: 'sm' | 'md' | 'lg' = 'md'
  export let showClose = true
  export let closeDisabled = false
  const dispatch = createEventDispatcher()
  let dialog: HTMLDialogElement
  let previousOverflow: string | null = null

  function unlockScroll() {
    if (previousOverflow !== null) {
      document.body.style.overflow = previousOverflow
      previousOverflow = null
    }
  }

  $: if (browser && dialog) {
    if (open && !dialog.open) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      dialog.showModal()
      dialog.focus()
    } else if (!open && dialog.open) {
      dialog.close()
      unlockScroll()
    }
  }

  function close() {
    open = false
    unlockScroll()
    dispatch('close')
  }

  function requestClose() { if (!closeDisabled) open = false }

  onDestroy(() => { if (browser) unlockScroll() })
</script>

<dialog bind:this={dialog} class="ui-dialog" aria-label={title || ($language === 'ar' ? 'نافذة' : 'Dialog')} tabindex="-1"
  on:close={close} on:cancel={(event) => { event.preventDefault(); requestClose() }} on:click={(event) => { if (event.target === dialog) requestClose() }}>
  <section class="ui-dialog-panel" data-size={size}>
    <div class="ui-dialog-handle" aria-hidden="true"></div>
    <header class="ui-dialog-header">
      <div class="min-w-0 flex-1">
        {#if title}<h2 class="text-xl font-bold tracking-tight text-text">{title}</h2>{/if}
        <slot name="header" />
      </div>
      {#if showClose}
        <button type="button" disabled={closeDisabled} on:click={requestClose} class="uneem-icon-button bg-surface-level-1" aria-label={$language === 'ar' ? 'إغلاق' : 'Close'}><Icon name="x" size={20} /></button>
      {/if}
    </header>
    <div class="ui-dialog-body"><slot />{#if $$slots.body}<slot name="body" />{/if}</div>
    {#if $$slots.footer}<footer class="ui-dialog-footer"><slot name="footer" /></footer>{/if}
  </section>
</dialog>

<style>
  .ui-dialog { position: fixed; inset: var(--visual-top, 0px) 0 auto; width: 100%; max-width: none; height: var(--visual-height, 100dvh); max-height: none; margin: 0; border: 0; padding: 16px 0 0; overflow: hidden; background: transparent; color: var(--text); }
  .ui-dialog[open] { display: flex; align-items: flex-end; justify-content: center; }
  .ui-dialog::backdrop { background: rgb(10 12 16 / .4); }
  .ui-dialog-panel { display: flex; flex-direction: column; width: 100%; max-height: 100%; border-radius: 28px 28px 0 0; background: var(--surface-raised); box-shadow: var(--shadow-xl); overflow: hidden; }
  .ui-dialog-handle { flex-shrink: 0; width: 36px; height: 5px; border-radius: 99px; background: var(--border); margin: 10px auto 0; }
  .ui-dialog-header { display: flex; flex-shrink: 0; align-items: center; gap: 16px; padding: 16px 24px; }
  .ui-dialog-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 24px 24px; }
  .ui-dialog-footer { display: flex; flex-direction: column; flex-shrink: 0; gap: 12px; padding: 12px 24px max(24px, var(--app-safe-bottom)); background: var(--surface-raised); }
  .ui-dialog-panel:not(:has(.ui-dialog-footer)) .ui-dialog-body { padding-bottom: max(24px, var(--app-safe-bottom)); }
  @media (min-width: 640px) {
    .ui-dialog { padding: 24px; }
    .ui-dialog[open] { align-items: center; }
    .ui-dialog-panel { max-width: 460px; border-radius: 28px; }
    .ui-dialog-panel[data-size='sm'] { max-width: 400px; }
    .ui-dialog-panel[data-size='lg'] { max-width: 560px; }
    .ui-dialog-handle { display: none; }
    .ui-dialog-header { padding-top: 24px; }
    .ui-dialog-footer { flex-direction: row; justify-content: flex-end; }
  }
</style>

<script lang="ts">
  import { locale } from 'svelte-i18n'
  import { applyPwaUpdate, pwaUpdateState } from '$lib/pwaUpdate'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'
  import { toasts } from '$lib/stores/ui'
  let dismissed = false

  $: isArabic = ($locale || 'en').startsWith('ar')
  $: title = isArabic ? 'تحديث UNEEM جاهز' : 'UNEEM update ready'
  $: body = $pwaUpdateState.error
    ? (isArabic ? 'تعذر التحديث الآن. تحقق من الإنترنت وحاول مجدداً.' : 'Couldn’t update right now. Check your connection and try again.')
    : (isArabic ? 'احفظ تغييراتك قبل التحديث.' : 'Save your changes before updating.')
  $: action = $pwaUpdateState.error ? (isArabic ? 'إعادة المحاولة' : 'Retry') : (isArabic ? 'تحديث' : 'Update')
</script>

{#if $pwaUpdateState.available && !dismissed && !$toasts.length}
  <aside class="pwa-update fixed inset-x-5 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-sm rounded-[22px] bg-surface-raised p-5 shadow-xl lg:bottom-5" role="status" aria-live="polite">
    <div class="flex items-center gap-3">
      <div class={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ${$pwaUpdateState.error ? 'bg-warning-light text-warning' : 'bg-primary-light text-primary'}`}>
        <Icon name={$pwaUpdateState.error ? 'alert-triangle' : 'upload'} size={18} strokeWidth={2.3} />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-bold text-text">{title}</p>
        <p class="mt-0.5 text-xs leading-5 text-text-secondary">{body}</p>
      </div>
    </div>
    <div class="mt-4 grid grid-cols-2 gap-3">
      <Button variant="secondary" disabled={$pwaUpdateState.applying} on:click={() => dismissed = true}>{isArabic ? 'لاحقاً' : 'Later'}</Button>
      <Button loading={$pwaUpdateState.applying} on:click={() => void applyPwaUpdate()}>{action}</Button>
    </div>
  </aside>
{/if}

<style>
  :global(html[data-keyboard-open]) .pwa-update, :global(body:has(dialog[open])) .pwa-update { display: none; }
</style>

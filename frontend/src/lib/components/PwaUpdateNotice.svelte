<script lang="ts">
  import { locale } from 'svelte-i18n'
  import { applyPwaUpdate, pwaUpdateState } from '$lib/pwaUpdate'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'

  $: isArabic = ($locale || 'en').startsWith('ar')
  $: title = isArabic ? 'تحديث UNEEM جاهز' : 'UNEEM update ready'
  $: body = $pwaUpdateState.error
    ? (isArabic ? 'تعذر التحديث الآن. تحقق من الإنترنت وحاول مجدداً.' : 'Couldn’t update right now. Check your connection and try again.')
    : (isArabic ? 'حدّث الآن للحصول على آخر الإصلاحات بدون فقدان حسابك.' : 'Refresh now to get the latest fixes without affecting your account.')
  $: action = $pwaUpdateState.error ? (isArabic ? 'إعادة المحاولة' : 'Retry') : (isArabic ? 'تحديث' : 'Update')
</script>

{#if $pwaUpdateState.available}
  <aside class="fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-md rounded-[20px] border border-border-light bg-surface p-3.5 shadow-xl md:bottom-5" role="status" aria-live="polite">
    <div class="flex items-center gap-3">
      <div class={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ${$pwaUpdateState.error ? 'bg-warning-light text-warning' : 'bg-primary-light text-primary'}`}>
        <Icon name={$pwaUpdateState.error ? 'alert-triangle' : 'upload'} size={18} strokeWidth={2.3} />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-bold text-text">{title}</p>
        <p class="mt-0.5 text-xs leading-5 text-text-secondary">{body}</p>
      </div>
      <Button variant="primary" size="sm" loading={$pwaUpdateState.applying} disabled={$pwaUpdateState.applying} on:click={() => void applyPwaUpdate()}>{action}</Button>
    </div>
  </aside>
{/if}

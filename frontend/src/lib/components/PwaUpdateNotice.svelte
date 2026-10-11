<script lang="ts">
  import { locale } from 'svelte-i18n'
  import { page } from '$app/stores'
  import { applyPwaUpdate, pwaUpdateState } from '$lib/pwaUpdate'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'
  let dismissed = false

  $: isArabic = ($locale || 'en').startsWith('ar')
  $: title = isArabic ? 'تحديث UNEEM جاهز' : 'UNEEM update ready'
  $: body = $pwaUpdateState.error
    ? (isArabic ? 'تعذر التحديث الآن. تحقق من الإنترنت وحاول مجدداً.' : 'Couldn’t update right now. Check your connection and try again.')
    : (isArabic ? 'تحديث التطبيق سيعيد تحميل الصفحة.' : 'Updating will refresh this page.')
  $: action = $pwaUpdateState.error ? (isArabic ? 'إعادة المحاولة' : 'Retry') : (isArabic ? 'تحديث' : 'Update')

  function measureNotice(node: HTMLElement) {
    const measure = () => {
      const height = node.getBoundingClientRect().height + 16
      document.documentElement.style.setProperty('--pwa-notice-height', `${height}px`)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return { destroy() { observer.disconnect(); document.documentElement.style.removeProperty('--pwa-notice-height') } }
  }
</script>

{#if $pwaUpdateState.available && !dismissed && $page.url.pathname !== '/menu'}
  <aside class="pwa-update" role="status" aria-live="polite" aria-label={title} use:measureNotice>
    <div class="update-copy">
      <p class="update-title">{title}</p>
      <p class="update-description">{body}</p>
    </div>
    <div class="update-actions">
      <Button size="sm" loading={$pwaUpdateState.applying} on:click={() => void applyPwaUpdate()}>{action}</Button>
      <button class="update-dismiss" type="button" disabled={$pwaUpdateState.applying} aria-label={isArabic ? 'لاحقاً' : 'Later'} title={isArabic ? 'لاحقاً' : 'Later'} on:click={() => dismissed = true}><Icon name="x" size={18} /></button>
    </div>
  </aside>
{/if}

<style>
  .pwa-update { display: flex; align-items: center; gap: 12px; width: min(calc(100% - 32px), 660px); margin: 8px auto; padding: 10px 12px 10px 16px; border: 1px solid var(--border-light); border-radius: 14px; background: var(--surface); }
  .update-copy { flex: 1; min-width: 0; }
  .update-title { font-size: 13px; line-height: 1.5; font-weight: 600; color: var(--text); }
  .update-description { margin-top: 2px; font-size: 12px; line-height: 1.5; color: var(--text-secondary); }
  .update-actions { display: flex; align-items: center; flex-shrink: 0; gap: 4px; }
  .update-dismiss { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 10px; color: var(--text-secondary); }
  .update-dismiss:hover { background: var(--surface-level-1); }
  @media (max-width: 359px) { .pwa-update { flex-wrap: wrap; gap: 4px; } .update-copy { flex-basis: 100%; } .update-actions { margin-inline-start: auto; } }
</style>

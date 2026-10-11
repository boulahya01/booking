<script lang="ts">
  import { authState } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'
  import Icon from './Icon.svelte'

  $: account = $authState.account
  $: ar = $language === 'ar'
  $: pending = account?.identity_status === 'pending'
  $: title = pending ? (ar ? 'هويتك قيد المراجعة' : 'ID under review') : (ar ? 'أكد هويتك للحجز' : 'Verify your ID to play')

  function measure(node: HTMLElement) {
    const observer = new ResizeObserver(() => document.documentElement.style.setProperty('--verification-notice-height', `${node.offsetHeight}px`))
    observer.observe(node)
    return { destroy() { observer.disconnect(); document.documentElement.style.removeProperty('--verification-notice-height') } }
  }
</script>

{#if $authState.user && account && account.identity_status !== 'verified'}
  <aside use:measure class="verification-notice" aria-label={ar ? 'التحقق من الطالب' : 'Student verification'}>
    <div class="verification-notice-inner">
      <Icon name={pending ? 'clock' : 'shield'} size={20} className="shrink-0" />
      <p class="min-w-0 flex-1 text-sm font-semibold leading-5">{title}</p>
      <a href="/verification" class="verification-notice-action">{pending ? (ar ? 'عرض الطلب' : 'View') : (ar ? 'تحقق الآن' : 'Verify')}</a>
    </div>
  </aside>
{/if}

<style>
  .verification-notice { background: var(--warning-light); color: var(--text); }
  .verification-notice-inner { display: flex; align-items: center; gap: 12px; min-height: 56px; max-width: 1280px; margin-inline: auto; padding: 6px max(var(--page-gutter), var(--app-safe-right)) 6px max(var(--page-gutter), var(--app-safe-left)); }
  .verification-notice-action { display: inline-flex; align-items: center; justify-content: center; min-width: 72px; min-height: 44px; padding-inline: 16px; border-radius: 14px; background: var(--surface); color: var(--text); font-size: 14px; font-weight: 650; }
  .verification-notice-action:active { transform: scale(.97); }
</style>

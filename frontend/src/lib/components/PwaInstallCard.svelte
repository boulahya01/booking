<script lang="ts">
  import { locale } from 'svelte-i18n'
  import { pwaInstallState, promptPwaInstall } from '$lib/pwaInstall'
  import Button from './Button.svelte'

  export let alwaysVisible = false
  export let compact = false

  let showingIosHelp = false
  let showingManualHelp = false
  let installing = false

  $: isArabic = ($locale || 'en').startsWith('ar')
  $: visible = !$pwaInstallState.standalone && (alwaysVisible || $pwaInstallState.available || $pwaInstallState.ios || showingManualHelp)
  $: title = isArabic ? 'UNEEM على شاشتك الرئيسية' : 'UNEEM on your home screen'
  $: body = isArabic ? 'افتح التطبيق مباشرةً، بدون البحث عنه في المتصفح.' : 'Open the app directly, without finding it in your browser.'
  $: cta = isArabic ? 'تثبيت التطبيق' : 'Install app'

  async function install() {
    installing = true
    showingManualHelp = false
    try {
      const outcome = await promptPwaInstall()
      if (outcome === 'ios') showingIosHelp = true
      if (outcome === 'unavailable') showingManualHelp = true
    } finally {
      installing = false
    }
  }
</script>

{#if visible}
  <section class="install-card" class:compact aria-label={title}>
    <div class="install-heading">
      <img src="/assets/brand/app-icon.svg" width="40" height="40" alt="" />
      <div class="install-copy"><h2>{title}</h2>{#if !compact}<p>{body}</p>{/if}</div>
      <Button variant="secondary" size="sm" loading={installing} disabled={installing} on:click={install}>{cta}</Button>
    </div>
    {#if showingIosHelp || showingManualHelp}
      <div class="install-help" role="status">
        <p>{isArabic ? 'أضف التطبيق في خطوتين:' : 'Add the app in two steps:'}</p>
        <ol>
          <li>{showingIosHelp ? (isArabic ? 'افتح الموقع في Safari واضغط مشاركة.' : 'Open this site in Safari and tap Share.') : (isArabic ? 'افتح قائمة المتصفح.' : 'Open your browser menu.')}</li>
          <li>{showingIosHelp ? (isArabic ? 'اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».' : 'Choose “Add to Home Screen”, then Add.') : (isArabic ? 'اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».' : 'Choose “Add to Home Screen” or “Install app”.')}</li>
        </ol>
      </div>
    {/if}
  </section>
{/if}

<style>
  .install-card { padding: 16px; border: 1px solid var(--border-light); border-radius: 16px; background: var(--surface); text-align: start; }
  .install-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
  .install-heading img { flex-shrink: 0; border-radius: 11px; }
  .install-copy { flex: 1; min-width: 130px; }
  .install-copy h2 { font-size: 14px; font-weight: 500; line-height: 1.5; color: var(--text); }
  .install-copy p { margin-top: 3px; font-size: 12px; line-height: 1.6; color: var(--text-secondary); }
  .install-heading :global(.ui-button) { flex-shrink: 0; margin-inline-start: auto; }
  .install-help { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-light); font-size: 13px; line-height: 1.7; color: var(--text-secondary); }
  .install-help p { font-weight: 500; color: var(--text); }
  .install-help ol { list-style: decimal; padding-inline-start: 20px; margin-top: 6px; }
  .install-help li + li { margin-top: 6px; }
  .compact { padding: 12px; }
  .compact .install-copy { min-width: 110px; }
  .compact .install-heading img { width: 32px; height: 32px; border-radius: 9px; }
  @media (max-width: 379px) { .install-heading :global(.ui-button) { width: 100%; } }
</style>

<script lang="ts">
  import { locale } from 'svelte-i18n'
  import { pwaInstallState, promptPwaInstall } from '$lib/pwaInstall'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'

  export let alwaysVisible = false

  let showingIosHelp = false
  let showingManualHelp = false
  let installing = false

  $: isArabic = ($locale || 'en').startsWith('ar')
  $: visible = !$pwaInstallState.standalone && (alwaysVisible || $pwaInstallState.available || $pwaInstallState.ios || showingManualHelp)
  $: title = isArabic ? 'ثبّت UNEEM' : 'Install UNEEM'
  $: body = isArabic ? 'افتح الحجوزات والمباريات بسرعة من شاشتك الرئيسية.' : 'Open bookings and matches faster from your home screen.'
  $: cta = isArabic ? 'تثبيت التطبيق' : 'Install app'
  $: iosHelp = isArabic ? 'افتح UNEEM في Safari، واضغط مشاركة، ثم «إضافة إلى الشاشة الرئيسية».' : 'Open UNEEM in Safari, tap Share, then “Add to Home Screen”.'
  $: manualHelp = isArabic ? 'افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». على iPhone استخدم Safari.' : 'Open your browser menu and choose “Install app” or “Add to Home Screen”. On iPhone, use Safari.'

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
  <section class="overflow-hidden rounded-[22px] border border-border-light bg-surface" aria-label={title}>
    <div class="flex items-center gap-3.5 p-4 sm:p-5">
      <div class="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-primary text-white shadow-sm dark:text-[#101214]">
        <Icon name="upload" size={21} strokeWidth={2.2} />
      </div>

      <div class="min-w-0 flex-1">
        <h2 class="text-[15px] font-bold tracking-[-0.015em] text-text">{title}</h2>
        <p class="mt-1 max-w-md text-xs leading-5 text-text-secondary">{body}</p>
      </div>

      {#if !showingManualHelp}
        <div class="hidden shrink-0 sm:block">
          <Button variant="primary" size="sm" loading={installing} disabled={installing} on:click={install}>{cta}</Button>
        </div>
      {/if}
    </div>

    {#if !showingManualHelp}
      <div class="border-t border-border-light px-4 py-3 sm:hidden">
        <Button variant="primary" size="md" className="w-full" loading={installing} disabled={installing} on:click={install}>{cta}</Button>
      </div>
    {/if}

    {#if showingIosHelp || showingManualHelp}
      <div class="border-t border-border-light bg-surface-level-1 px-4 py-3 text-xs font-medium leading-5 text-text-secondary" role="status">
        {showingManualHelp ? manualHelp : iosHelp}
      </div>
    {/if}
  </section>
{/if}

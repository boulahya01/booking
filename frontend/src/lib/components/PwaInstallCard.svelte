<script lang="ts">
  import { locale } from 'svelte-i18n'
  import { pwaInstallState, promptPwaInstall } from '$lib/pwaInstall'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'

  let showingIosHelp = false
  let installing = false

  $: isArabic = ($locale || 'en').startsWith('ar')
  $: visible = !$pwaInstallState.standalone && ($pwaInstallState.available || $pwaInstallState.ios)
  $: title = isArabic ? 'ثبّت UNEEM' : 'Install UNEEM'
  $: body = isArabic ? 'افتح الحجوزات والمباريات بسرعة من شاشتك الرئيسية.' : 'Open bookings and matches faster from your home screen.'
  $: cta = isArabic ? 'تثبيت التطبيق' : 'Install app'
  $: iosHelp = isArabic ? 'في Safari: اضغط مشاركة، ثم «إضافة إلى الشاشة الرئيسية».' : 'In Safari: tap Share, then “Add to Home Screen”.'

  async function install() {
    installing = true
    try {
      const outcome = await promptPwaInstall()
      if (outcome === 'ios') showingIosHelp = true
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

      <div class="hidden shrink-0 sm:block">
        <Button variant="primary" size="sm" loading={installing} disabled={installing} on:click={install}>{cta}</Button>
      </div>
    </div>

    <div class="border-t border-border-light px-4 py-3 sm:hidden">
      <Button variant="primary" size="md" className="w-full" loading={installing} disabled={installing} on:click={install}>{cta}</Button>
    </div>

    {#if showingIosHelp}
      <div class="border-t border-border-light bg-surface-level-1 px-4 py-3 text-xs font-medium leading-5 text-text-secondary" role="status">
        {iosHelp}
      </div>
    {/if}
  </section>
{/if}

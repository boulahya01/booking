<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount, tick } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import '$lib/styles/global.css'
  import '$lib/styles/fonts.css'
  import '$lib/styles/system.css'
  import '$lib/styles/mobile.css'
  import { canBrowse } from '$lib/access'
  import {
    isAuthPath,
    isEntryPath,
    isPublicPath,
    resolveAccountRoute
  } from '$lib/accountResolver'
  import { entryState, initializeEntryState } from '$lib/entryState'
  import { rememberInvite, clearArrivedInvite } from '$lib/inviteNavigation'
  import Toast from '$lib/components/Toast.svelte'
  import PwaRuntime from '$lib/components/PwaRuntime.svelte'
  import PwaUpdateNotice from '$lib/components/PwaUpdateNotice.svelte'
  import { theme, toasts, uiState, interfaceReady } from '$lib/stores/ui'
  import { beginLoading, globalLoading } from '$lib/stores/loading'
  import { initializeI18n } from '$lib/i18n'
  import { authState } from '$lib/stores/auth'
  import { initAuthRuntime } from '$lib/authRuntime'
  import geistFont from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url'
  import { observeViewport } from '$lib/viewport'
  import {
    passwordRecoveryActive,
    restorePasswordRecovery
  } from '$lib/authRecovery'
  import { locale } from 'svelte-i18n'

  let toastRegion: HTMLDivElement
  $: if (browser && toastRegion && typeof toastRegion.showPopover === 'function') {
    if ($toasts.length) {
      toastRegion.hidePopover()
      toastRegion.showPopover()
    } else toastRegion.hidePopover()
  }

  let routeGuardProcessing = false

  initializeI18n('en')

  $: isAuthPage = isAuthPath($page.url.pathname)
  $: isPublicSupportPage = isPublicPath($page.url.pathname)
  $: chromeFreePage = isAuthPage || isPublicSupportPage

  $: if (
    browser &&
    !$authState.loading &&
    !routeGuardProcessing &&
    (!isEntryPath($page.url.pathname) || $entryState.ready)
  ) {
    const pathname = $page.url.pathname
    const hasSession = $authState.user !== null
    const account = $authState.account
    const recoveryActive = $passwordRecoveryActive
    const requestedPath = $page.url.searchParams.get('next')

    let targetPath = resolveAccountRoute({
      hasSession,
      account,
      pathname,
      recoveryActive,
      bootstrapError: $authState.bootstrapError,
      requestedPath,
      welcomeSeen: $entryState.welcomeSeen
    })

    if (!hasSession && targetPath === '/login' && rememberInvite(pathname)) {
      targetPath = `/login?next=${encodeURIComponent(pathname)}`
    }

    if (hasSession && canBrowse(account) && !targetPath) clearArrivedInvite(pathname)

    if (targetPath && targetPath !== pathname) {
      routeGuardProcessing = true
      const stopNavigationLoading = beginLoading('navigating')
      goto(targetPath, { replaceState: true }).finally(() => {
        stopNavigationLoading()
        routeGuardProcessing = false
      })
    }
  }

  onMount(() => {
    initializeEntryState()
    void tick().then(() => interfaceReady.set(true))
    const stopViewport = observeViewport()
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'auto' | null
    const storedLang = localStorage.getItem('language') as 'en' | 'ar' | null

    if (storedTheme) uiState.setTheme(storedTheme)
    else uiState.setTheme('light')

    if (storedLang) uiState.setLanguage(storedLang)

    restorePasswordRecovery()
    const stopAuthRuntime = initAuthRuntime()

    applyTheme($theme)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if ($theme === 'auto') applyTheme('auto')
    }
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      stopViewport()
      mediaQuery.removeEventListener('change', handleChange)
      stopAuthRuntime()
    }
  })

  function applyTheme(t: 'light' | 'dark' | 'auto') {
    if (!browser) return
    const isDark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#101113' : '#f5f5f7')
  }

  $: if (browser) applyTheme($theme)

  $: if (browser && $uiState.language) {
    document.documentElement.lang = $uiState.language
    document.documentElement.dir = $uiState.language === 'ar' ? 'rtl' : 'ltr'
    locale.set($uiState.language)
  }
</script>

<svelte:head>
  <link rel="preload" href={geistFont} as="font" type="font/woff2" crossorigin="anonymous" />
  <title>UNEM Sports</title>
</svelte:head>

<PwaRuntime />

{#if $globalLoading.visible}
  <div class="global-loading-bar" role="status" aria-live="polite" aria-label="Loading"></div>
{/if}

<div class="app-shell" inert={!$interfaceReady}>
  <a href="#main-content" class="skip-link">{$uiState.language === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
  <PwaUpdateNotice />
  <main id="main-content" tabindex="-1" class:app-content={!chromeFreePage} class:app-content-plain={chromeFreePage}>
    <slot />
  </main>

  <div bind:this={toastRegion} popover="manual" role="region" class="ui-toast-region" aria-label={$uiState.language === 'ar' ? 'تحديثات' : 'Updates'}>
    {#each $toasts as toast (toast.id)}
      <div class="pointer-events-auto">
        <Toast
          message={toast.message}
          type={toast.type}
          id={toast.id}
          on:close={() => uiState.removeToast(toast.id)}
        />
      </div>
    {/each}
  </div>
</div>

<style>
  .global-loading-bar {
    position: fixed;
    inset-block-start: 0;
    inset-inline: 0;
    z-index: 100;
    height: 2px;
    background: var(--primary);
    transform-origin: center;
    animation: global-loading 1.1s ease-in-out infinite;
  }

  @keyframes global-loading {
    0% { transform: scaleX(0.08); opacity: 0.45; }
    50% { transform: scaleX(0.7); opacity: 1; }
    100% { transform: scaleX(0.08); opacity: 0.45; }
  }

  @media (prefers-reduced-motion: reduce) {
    .global-loading-bar { animation: none; }
  }

  :global(.app-content-plain) {
    flex: 1;
    width: 100%;
  }
</style>

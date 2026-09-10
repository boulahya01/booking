<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount, tick } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import '$lib/styles/global.css'
  import '$lib/styles/fonts.css'
  import '$lib/styles/system.css'
  import '$lib/styles/mobile.css'
  import { canBrowse, accountHome } from '$lib/access'
  import { afterSignIn, rememberInvite, clearArrivedInvite } from '$lib/inviteNavigation'
  import VerificationNotice from '$lib/components/VerificationNotice.svelte'
  import TopBar from '$lib/components/TopBar.svelte'
  import Toast from '$lib/components/Toast.svelte'
  import PwaRuntime from '$lib/components/PwaRuntime.svelte'
  import { theme, toasts, uiState, interfaceReady } from '$lib/stores/ui'
  import { initializeI18n } from '$lib/i18n'
  import { supabase } from '$lib/supabaseClient'
  import { authState } from '$lib/stores/auth'
  import { getMyAccountState, getUserProfile } from '$lib/auth'
  import { getMySessionContext } from '$lib/sessionApi'
  import { clearRequestCache } from '$lib/requestCache'
  import { observeViewport } from '$lib/viewport'
  import {
    clearPasswordRecovery,
    markPasswordRecovery,
    passwordRecoveryActive,
    restorePasswordRecovery
  } from '$lib/authFlow'
  import { locale } from 'svelte-i18n'
  import { USE_MOCK } from '$lib/mock'

  let toastRegion: HTMLDivElement
  $: if (browser && toastRegion && typeof toastRegion.showPopover === 'function') {
    if ($toasts.length) {
      // Toast feedback must also be visible above a native dialog.
      toastRegion.hidePopover()
      toastRegion.showPopover()
    } else toastRegion.hidePopover()
  }
  let routeGuardProcessing = false
  let unsubAuth: (() => void) | null = null
  let unsubEarlyRecovery: (() => void) | null = null
  let cacheUserId: string | null = null

  function setCacheIdentity(nextUserId: string | null) {
    if (cacheUserId === nextUserId) return
    clearRequestCache()
    cacheUserId = nextUserId
  }

  // Supabase may resolve an implicit recovery URL before child route onMount
  // callbacks run. Register this minimal listener during client component setup so
  // the only trusted recovery grant comes from PASSWORD_RECOVERY itself, never
  // from a user-editable `?type=recovery` URL marker.
  if (browser && !USE_MOCK) {
    const { data: earlyRecoveryListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        markPasswordRecovery(session)
      } else if (event === 'SIGNED_OUT') {
        clearPasswordRecovery()
        setCacheIdentity(null)
      }
    })
    unsubEarlyRecovery = () => earlyRecoveryListener.subscription.unsubscribe()
  }

  initializeI18n('en')

  const authPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/logout']
  const publicSupportPaths = ['/help', '/', '/privacy', '/terms', '/data-deletion']
  $: isAuthPage = authPaths.includes($page.url.pathname)
  $: isPublicSupportPage = publicSupportPaths.includes($page.url.pathname)
  $: chromeFreePage = isAuthPage || isPublicSupportPage

  // Routing is driven by the authoritative account-state payload. Recovery is a
  // temporary authenticated capability and is intentionally trapped on the
  // reset flow until the password is changed or the user signs out.
  $: if (
    browser &&
    !$authState.loading &&
    !routeGuardProcessing
  ) {
    const pathname = $page.url.pathname
    const hasSession = $authState.user !== null
    const account = $authState.account
    const isAuthPath = authPaths.includes(pathname)
    const isSupportPath = publicSupportPaths.includes(pathname)
    const isPendingPath = pathname === '/pending-approval'
    const isProfilePath = pathname === '/profile' || pathname === '/menu'
    const isVerificationPath = pathname === '/verification'
    const isVerifyEmailPath = pathname === '/verify-email'
    const isRecoveryPath = pathname === '/reset-password'
    const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
    const isSportsPath = pathname.startsWith('/home') ||
                         pathname.startsWith('/bookings') ||
                         pathname.startsWith('/pitch/') ||
                         pathname.startsWith('/matches') ||
                         pathname.startsWith('/notifications')
    const canBrowseApp = canBrowse(account)
    const isAdminAccount = account?.role === 'admin'
    const recoveryActive = $passwordRecoveryActive

    let targetPath: string | null = null

    if (recoveryActive && hasSession && !isRecoveryPath && !isSupportPath && pathname !== '/logout') {
      targetPath = '/reset-password'
    } else if (!hasSession && !isAuthPath && !isSupportPath) {
      targetPath = rememberInvite(pathname) ? `/login?next=${encodeURIComponent(pathname)}` : '/login'
    } else if (hasSession && isAuthPath && pathname !== '/logout' && !isVerifyEmailPath && !(isRecoveryPath && recoveryActive)) {
      targetPath = afterSignIn(account)
    } else if (hasSession && !account && !isSupportPath && !isVerifyEmailPath && !isRecoveryPath) {
      targetPath = '/pending-approval'
    } else if (hasSession && isAdminPath && !isAdminAccount) {
      targetPath = accountHome(account)
    } else if (hasSession && !canBrowseApp && (isSportsPath || isAdminPath)) {
      targetPath = '/pending-approval'
    } else if (hasSession && canBrowseApp && account?.can_use_sports && isPendingPath) {
      targetPath = '/home'
    } else if (
      hasSession &&
      !canBrowseApp &&
      !isPendingPath &&
      !isProfilePath &&
      !isVerificationPath &&
      !isSupportPath &&
      !isAuthPath
    ) {
      targetPath = '/pending-approval'
    }

    if (hasSession && canBrowseApp && !targetPath) clearArrivedInvite(pathname)
    if (targetPath && targetPath !== pathname) {
      routeGuardProcessing = true
      goto(targetPath).finally(() => {
        routeGuardProcessing = false
      })
    }
  }

  onMount(() => {
    void tick().then(() => interfaceReady.set(true))
    const stopViewport = observeViewport()
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'auto' | null
    const storedLang = localStorage.getItem('language') as 'en' | 'ar' | null

    if (storedTheme) {
      uiState.setTheme(storedTheme)
    } else {
      uiState.setTheme('auto')
    }

    if (storedLang) {
      uiState.setLanguage(storedLang)
      locale.set(storedLang)
    }

    restorePasswordRecovery()
    let processingAuth = false

    async function applySession(session: any) {
      if (!session?.user) {
        setCacheIdentity(null)
        clearPasswordRecovery()
        authState.clear()
        return
      }

      setCacheIdentity(session.user.id)

      try {
        restorePasswordRecovery(session.user.id)

        const context = await getMySessionContext()
        if (cacheUserId !== session.user.id) return
        if (!context) {
          authState.clear()
          return
        }

        const { profile, account } = context
        authState.setSessionContext({
          id: profile.id,
          email: session.user.email ?? undefined,
          username: profile.username,
          student_id: profile.student_id,
          full_name: profile.full_name,
          role: profile.role === 'admin' ? 'admin' : 'user',
          status: profile.status
        }, account)
      } catch {
        if (cacheUserId === session.user.id) authState.clear()
      }
    }

    async function syncSession() {
      if (processingAuth) return
      processingAuth = true
      authState.setLoading(true)

      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!data?.session) clearPasswordRecovery()
        await applySession(data?.session)
      } catch {
        setCacheIdentity(null)
        clearPasswordRecovery()
        authState.clear()
      } finally {
        processingAuth = false
        authState.setLoading(false)
      }
    }

    if (USE_MOCK) {
      clearPasswordRecovery()
      const stored = localStorage.getItem('mock_auth_user')
      if (stored) {
        try {
          const user = JSON.parse(stored)
          setCacheIdentity(user.id || null)
          void Promise.all([
            getUserProfile(user.id),
            getMyAccountState()
          ]).then(([profile, account]) => {
            if (!profile || !account) {
              authState.clear()
              return
            }
            authState.setSessionContext({
              id: profile.id,
              email: user.email,
              username: profile.username,
              student_id: profile.student_id,
              full_name: profile.full_name,
              role: profile.role === 'admin' ? 'admin' : 'user',
              status: profile.status
            }, account)
          }).catch(() => authState.clear())
        } catch {
          setCacheIdentity(null)
          authState.clear()
        }
      } else {
        setCacheIdentity(null)
        authState.clear()
      }
    } else {
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          setCacheIdentity(null)
          clearPasswordRecovery()
          authState.clear()
          return
        }

        if (event === 'PASSWORD_RECOVERY' && session?.user) {
          markPasswordRecovery(session)
          if (!processingAuth) {
            processingAuth = true
            authState.setLoading(true)
            void applySession(session).finally(() => {
              processingAuth = false
              authState.setLoading(false)
            })
          }
          return
        }

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          restorePasswordRecovery(session.user.id)

          // Interactive email/password login owns its own authoritative session
          // bootstrap so the submit handler can route without waiting for this
          // listener. Skip the duplicate RPC while that login form is loading.
          if (event === 'SIGNED_IN' && $page.url.pathname === '/login' && $authState.loading) {
            return
          }

          if (!processingAuth) {
            processingAuth = true
            authState.setLoading($authState.user?.id !== session.user.id)
            void applySession(session).finally(() => {
              processingAuth = false
              authState.setLoading(false)
            })
          }
        }
      })

      unsubAuth = () => authListener?.subscription?.unsubscribe()
      void syncSession()
    }

    applyTheme($theme)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if ($theme === 'auto') applyTheme('auto')
    }
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      stopViewport()
      mediaQuery.removeEventListener('change', handleChange)
      unsubAuth?.()
      unsubEarlyRecovery?.()
    }
  })

  function applyTheme(t: 'light' | 'dark' | 'auto') {
    if (!browser) return
    const isDark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)
  }

  $: if (browser) applyTheme($theme)

  $: if (browser && $uiState.language) {
    document.documentElement.lang = $uiState.language
    document.documentElement.dir = $uiState.language === 'ar' ? 'rtl' : 'ltr'
    locale.set($uiState.language)
  }
</script>

<svelte:head>
  <title>UNEM Sports</title>
</svelte:head>

<PwaRuntime />

<div class="app-shell" inert={!$interfaceReady}>
  <a href="#main-content" class="skip-link">{$uiState.language === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
  <div class="app-header">
    {#if !chromeFreePage}<TopBar />{/if}
    {#if !isAuthPage && !isPublicSupportPage}<VerificationNotice />{/if}
  </div>
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
  .app-header { position: sticky; top: 0; z-index: 40; }
  :global(.app-content-plain) {
    flex: 1;
    width: 100%;
  }
</style>

<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import '$lib/styles/global.css'
  import '$lib/styles/system.css'
  import TopBar from '$lib/components/TopBar.svelte'
  import SideNav from '$lib/components/SideNav.svelte'
  import Toast from '$lib/components/Toast.svelte'
  import { theme, toasts, uiState } from '$lib/stores/ui'
  import { initializeI18n } from '$lib/i18n'
  import { supabase } from '$lib/supabaseClient'
  import { authState } from '$lib/stores/auth'
  import { getMyAccountState, getUserProfile } from '$lib/auth'
  import { getMySessionContext } from '$lib/sessionApi'
  import {
    clearPasswordRecovery,
    markPasswordRecovery,
    passwordRecoveryActive,
    restorePasswordRecovery
  } from '$lib/authFlow'
  import { locale } from 'svelte-i18n'
  import { USE_MOCK } from '$lib/mock'

  let sideNavOpen = false
  let routeGuardProcessing = false
  let unsubAuth: (() => void) | null = null
  let unsubEarlyRecovery: (() => void) | null = null

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
      }
    })
    unsubEarlyRecovery = () => earlyRecoveryListener.subscription.unsubscribe()
  }

  function toggleSideNav() {
    sideNavOpen = !sideNavOpen
  }

  initializeI18n('en')

  const authPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/logout']
  const publicSupportPaths = ['/help']
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
    const isProfilePath = pathname === '/profile'
    const isVerificationPath = pathname === '/verification'
    const isVerifyEmailPath = pathname === '/verify-email'
    const isRecoveryPath = pathname === '/reset-password'
    const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
    const isSportsPath = pathname.startsWith('/home') ||
                         pathname.startsWith('/bookings') ||
                         pathname.startsWith('/pitch/') ||
                         pathname.startsWith('/matches') ||
                         pathname.startsWith('/notifications')
    const canUseSports = account?.can_use_sports === true
    const isAdminAccount = account?.role === 'admin'
    const recoveryActive = $passwordRecoveryActive

    let targetPath: string | null = null

    if (recoveryActive && hasSession && !isRecoveryPath && !isSupportPath && pathname !== '/logout') {
      targetPath = '/reset-password'
    } else if (!hasSession && !isAuthPath && !isSupportPath) {
      targetPath = '/login'
    } else if (hasSession && isAuthPath && !isVerifyEmailPath && !(isRecoveryPath && recoveryActive)) {
      targetPath = canUseSports ? '/home' : '/pending-approval'
    } else if (hasSession && !account && !isSupportPath && !isVerifyEmailPath && !isRecoveryPath) {
      targetPath = '/pending-approval'
    } else if (hasSession && isAdminPath && !isAdminAccount) {
      targetPath = canUseSports ? '/home' : '/pending-approval'
    } else if (hasSession && !canUseSports && (isSportsPath || isAdminPath)) {
      targetPath = '/pending-approval'
    } else if (hasSession && canUseSports && isPendingPath) {
      targetPath = '/home'
    } else if (
      hasSession &&
      !canUseSports &&
      !isPendingPath &&
      !isProfilePath &&
      !isVerificationPath &&
      !isSupportPath &&
      !isAuthPath
    ) {
      targetPath = '/pending-approval'
    }

    if (targetPath && targetPath !== pathname) {
      routeGuardProcessing = true
      goto(targetPath).finally(() => {
        routeGuardProcessing = false
      })
    }
  }

  onMount(() => {
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
        clearPasswordRecovery()
        authState.clear()
        return
      }

      try {
        restorePasswordRecovery(session.user.id)

        const context = await getMySessionContext()
        if (!context) {
          authState.clear()
          return
        }

        const { profile, account } = context
        authState.setSessionContext({
          id: profile.id,
          email: session.user.email ?? undefined,
          student_id: profile.student_id,
          full_name: profile.full_name,
          role: profile.role === 'admin' ? 'admin' : 'user',
          status: profile.status
        }, account)
      } catch {
        authState.clear()
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
              student_id: profile.student_id,
              full_name: profile.full_name,
              role: profile.role === 'admin' ? 'admin' : 'user',
              status: profile.status
            }, account)
          }).catch(() => authState.clear())
        } catch {
          authState.clear()
        }
      } else {
        authState.clear()
      }
    } else {
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
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
            authState.setLoading(true)
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
  <title>UNEEM</title>
</svelte:head>

<div class="app-shell">
  {#if !chromeFreePage}
    <TopBar onMenuToggle={toggleSideNav} />
  {/if}
  <main class:app-content={!chromeFreePage} class:app-content-plain={chromeFreePage}>
    <slot />
  </main>
  {#if !chromeFreePage}
    <SideNav bind:isOpen={sideNavOpen} on:close={() => sideNavOpen = false} />
  {/if}

  <div class="fixed bottom-20 md:bottom-4 right-4 space-y-2 z-50 pointer-events-none">
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
  :global(html) {
    scroll-behavior: smooth;
    --safe-area-inset-top: 0;
    --safe-area-inset-bottom: 0;
    --safe-area-inset-left: 0;
    --safe-area-inset-right: 0;
  }

  :global(.app-content-plain) {
    flex: 1;
    width: 100%;
  }

  @supports (padding: max(0px)) {
    :global(html) {
      --safe-area-inset-top: max(0px, env(safe-area-inset-top));
      --safe-area-inset-bottom: max(0px, env(safe-area-inset-bottom));
      --safe-area-inset-left: max(0px, env(safe-area-inset-left));
      --safe-area-inset-right: max(0px, env(safe-area-inset-right));
    }
  }
</style>

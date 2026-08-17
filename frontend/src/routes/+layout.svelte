<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import '$lib/styles/global.css'
  import TopBar from '$lib/components/TopBar.svelte'
  import SideNav from '$lib/components/SideNav.svelte'
  import Toast from '$lib/components/Toast.svelte'
  import { theme, toasts, uiState } from '$lib/stores/ui'
  import { initializeI18n } from '$lib/i18n'
  import { supabase } from '$lib/supabaseClient'
  import { authState } from '$lib/stores/auth'
  import { getUserProfile } from '$lib/auth'
  import { locale } from 'svelte-i18n'
  import { USE_MOCK } from '$lib/mock'

  let sideNavOpen = false
  let routeGuardProcessing = false

  function toggleSideNav() {
    sideNavOpen = !sideNavOpen
  }

  initializeI18n('en')

  let unsubAuth: (() => void) | null = null

  const authPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/logout']
  $: isAuthPage = authPaths.includes($page.url.pathname)

  // Never make a routing decision while the persisted session is still being
  // restored. V1 previously treated this short window as "signed out", which
  // caused returning users to bounce through /login and made the app feel slow.
  $: if (
    browser &&
    !$authState.loading &&
    !routeGuardProcessing &&
    !$page.url.pathname.startsWith('/verify-email')
  ) {
    const pathname = $page.url.pathname
    const hasSession = $authState.user !== null
    const userStatus = $authState.user?.status
    const isAuthPath = authPaths.includes(pathname)
    const isPendingPath = pathname === '/pending-approval'
    const isProfilePath = pathname === '/profile'
    const isRestrictedStatus = userStatus === 'pending' || userStatus === 'rejected' || userStatus === 'suspended'
    const isAppPath = pathname.startsWith('/home') ||
                      pathname.startsWith('/bookings') ||
                      pathname.startsWith('/pitch/') ||
                      pathname.startsWith('/notifications') ||
                      pathname.startsWith('/admin/')

    let targetPath: string | null = null

    if (!hasSession && !isAuthPath) {
      targetPath = '/login'
    } else if (hasSession && isAuthPath) {
      targetPath = isRestrictedStatus ? '/pending-approval' : '/home'
    } else if (hasSession && userStatus === 'approved' && isPendingPath) {
      targetPath = '/home'
    } else if (hasSession && isRestrictedStatus && isAppPath) {
      targetPath = '/pending-approval'
    } else if (hasSession && isRestrictedStatus && !isPendingPath && !isProfilePath && !isAuthPath) {
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

    let processingAuth = false

    async function applySession(session: any) {
      if (!session?.user) {
        authState.clear()
        return
      }

      try {
        const profile = await getUserProfile(session.user.id)
        if (!profile) {
          authState.clear()
          return
        }

        authState.setUser({
          id: profile.id,
          email: session.user.email ?? undefined,
          student_id: profile.student_id,
          full_name: profile.full_name,
          role: profile.role === 'admin' ? 'admin' : 'user',
          status: profile.status as import('$lib/stores/auth').UserStatus
        })
      } catch {
        // A failed profile request should not leave the whole application in an
        // unresolved loading state. RLS remains the authorization boundary.
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
        await applySession(data?.session)
      } catch {
        authState.clear()
      } finally {
        processingAuth = false
        authState.setLoading(false)
      }
    }

    if (USE_MOCK) {
      const stored = localStorage.getItem('mock_auth_user')
      if (stored) {
        try {
          const user = JSON.parse(stored)
          authState.setUser({
            id: user.id,
            email: user.email,
            student_id: user.student_id,
            full_name: user.full_name,
            role: user.role === 'admin' ? 'admin' : 'user',
            status: user.status
          })
        } catch {
          authState.clear()
        }
      } else {
        authState.clear()
      }
    } else {
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          authState.clear()
          return
        }

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
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
  <title>Booking App</title>
</svelte:head>

<div class="app-shell">
  {#if !isAuthPage}
    <TopBar onMenuToggle={toggleSideNav} />
  {/if}
  <main class="app-content">
    <slot />
  </main>
  {#if !isAuthPage}
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

  @supports (padding: max(0px)) {
    :global(html) {
      --safe-area-inset-top: max(0px, env(safe-area-inset-top));
      --safe-area-inset-bottom: max(0px, env(safe-area-inset-bottom));
      --safe-area-inset-left: max(0px, env(safe-area-inset-left));
      --safe-area-inset-right: max(0px, env(safe-area-inset-right));
    }
  }
</style>

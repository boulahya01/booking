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
  import { authState, isAuthenticated } from '$lib/stores/auth'
  import { getUserProfile } from '$lib/auth'
  import { locale } from 'svelte-i18n'
  import { USE_MOCK, mockProfile } from '$lib/mock'

  let sideNavOpen = false
  let routeGuardProcessing = false

  function toggleSideNav() {
    sideNavOpen = !sideNavOpen
  }

  initializeI18n('en')

  let unsubAuth: (() => void) | null = null

  const authPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/logout']
  $: isAuthPage = authPaths.includes($page.url.pathname)

  // Route guard: redirect based on auth state and profile status
  // Uses a guard flag to prevent navigation loops from goto() re-triggering the block
  $: if (browser && !routeGuardProcessing && !$page.url.pathname.startsWith('/verify-email')) {
    const pathname = $page.url.pathname
    const hasSession = $authState.user !== null
    const userStatus = $authState.user?.status
    const isAuthPath = authPaths.includes(pathname)
    const isPendingPath = pathname === '/pending-approval'
    const isProfilePath = pathname === '/profile'
    const isAppPath = pathname.startsWith('/home') ||
                      pathname.startsWith('/bookings') ||
                      pathname.startsWith('/pitch/') ||
                      pathname.startsWith('/notifications') ||
                      pathname.startsWith('/admin/')

    let targetPath: string | null = null

    if (!hasSession && !isAuthPath) {
      // No session, redirect to login
      targetPath = '/login'
    } else if (hasSession && isAuthPath) {
      // Has session but on auth page, redirect based on status
      if (userStatus === 'pending' || userStatus === 'rejected') {
        targetPath = '/pending-approval'
      } else {
        targetPath = '/home'
      }
    } else if (hasSession && userStatus === 'approved' && isPendingPath) {
      // Approved users shouldn't access pending page
      targetPath = '/home'
    } else if (hasSession && (userStatus === 'pending' || userStatus === 'rejected') && isAppPath) {
      // Pending/rejected users shouldn't access app pages
      targetPath = '/pending-approval'
    } else if (hasSession && (userStatus === 'pending' || userStatus === 'rejected') && !isPendingPath && !isProfilePath && !isAuthPath) {
      // Pending/rejected users can only access pending-approval and profile
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

    // Apply stored theme or default to 'auto' (system preference)
    if (storedTheme) {
      uiState.setTheme(storedTheme)
    } else {
      // Default to auto which respects system preference
      uiState.setTheme('auto')
    }
    
    if (storedLang) {
      uiState.setLanguage(storedLang)
      locale.set(storedLang)
    }

    if (USE_MOCK && typeof localStorage !== 'undefined') {
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
        } catch (e) {
          // silent - mock auth parse error
        }
      }
    }

    // Track if we're currently processing auth to prevent concurrent operations
    let processingAuth = false

    async function syncSession() {
      if (processingAuth) return
      processingAuth = true
      
      try {
        const { data } = await supabase.auth.getSession()
        const session = data?.session

        if (session?.user) {
          try {
            const profile = await getUserProfile(session.user.id)
            if (profile) {
              authState.setUser({
                id: profile.id,
                email: session.user.email ?? undefined,
                student_id: profile.student_id,
                full_name: profile.full_name,
                role: profile.role === 'admin' ? 'admin' : 'user',
                status: profile.status as import('$lib/stores/auth').UserStatus
              })
            }
          } catch (e) {
            // silent - profile load error
          }
        }
      } catch (e) {
        // silent - session sync error
      } finally {
        processingAuth = false
      }
    }

    syncSession()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip processing if we're already handling auth or if this is just a token refresh
      if (processingAuth || event === 'TOKEN_REFRESHED') return
      
      if (event === 'SIGNED_IN' && session?.user) {
        processingAuth = true
        try {
          const profile = await getUserProfile(session.user.id)
          if (profile) {
            authState.setUser({
              id: profile.id,
              email: session.user.email ?? undefined,
              student_id: profile.student_id,
              full_name: profile.full_name,
              role: profile.role === 'admin' ? 'admin' : 'user',
              status: profile.status as import('$lib/stores/auth').UserStatus
            })
          }
        } catch (e) {
            // silent - auth state change error
          } finally {
            processingAuth = false
          }
      } else if (event === 'SIGNED_OUT') {
        authState.clear()
      }
    })

    unsubAuth = () => authListener?.subscription?.unsubscribe()

    applyTheme($theme)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
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

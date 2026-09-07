<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { createEventDispatcher } from 'svelte'
  import { isAdmin, isAuthenticated, needsIdentityAction } from '$lib/stores/auth'
  import { theme, language, uiState } from '$lib/stores/ui'
  import { signOut } from '$lib/auth'
  import Icon from './Icon.svelte'

  export let isOpen = false
  const dispatch = createEventDispatcher()

  const regularItems = [
    { en: 'Home', ar: 'الرئيسية', href: '/home', icon: 'home' },
    { en: 'Matches', ar: 'المباريات', href: '/matches', icon: 'users' },
    { en: 'My Sports', ar: 'رياضتي', href: '/bookings', icon: 'calendar-days' },
    { en: 'Profile', ar: 'حسابي', href: '/profile', icon: 'user' },
    { en: 'Help', ar: 'المساعدة', href: '/help', icon: 'mail' }
  ]

  const adminItems = [
    { en: 'Bookings', ar: 'الحجوزات', href: '/admin/bookings', icon: 'calendar-check' },
    { en: 'Facilities', ar: 'المرافق', href: '/admin/pitches', icon: 'map-pin' },
    { en: 'Users', ar: 'المستخدمون', href: '/admin/users', icon: 'users' },
    { en: 'Verification', ar: 'التحقق', href: '/admin/verification', icon: 'shield' },
    { en: 'Help & reports', ar: 'الدعم والتقارير', href: '/admin/support', icon: 'mail' },
    { en: 'Announcements', ar: 'الإعلانات', href: '/admin/notifications', icon: 'bell-dot' }
  ]

  function isActive(href: string): boolean {
    return $page.url.pathname === href || $page.url.pathname.startsWith(`${href}/`)
  }

  async function handleLogout() {
    await signOut()
    dispatch('close')
    goto('/login')
  }

  function navigate(href: string) {
    dispatch('close')
    goto(href)
  }

  function toggleTheme() { uiState.toggleTheme() }
  function toggleLanguage() { uiState.setLanguage($language === 'en' ? 'ar' : 'en') }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" on:click={() => dispatch('close')} role="presentation"></div>
{/if}

<nav
  class="fixed inset-y-0 z-50 w-[18rem] max-w-[86vw] border-e border-border-light bg-surface-raised shadow-xl transition-transform duration-200 ease-out"
  class:left-0={$language !== 'ar'}
  class:right-0={$language === 'ar'}
  class:translate-x-0={isOpen}
  class:-translate-x-full={!isOpen && $language !== 'ar'}
  class:translate-x-full={!isOpen && $language === 'ar'}
  aria-label={$language === 'ar' ? 'القائمة' : 'Navigation menu'}
>
  <div class="flex h-full flex-col">
    <div class="flex min-h-[60px] items-center justify-between border-b border-border-light px-4">
      <button on:click={() => navigate('/home')} class="min-h-10 text-[17px] font-extrabold tracking-[0.14em] text-text">UNEEM</button>
      <button on:click={() => dispatch('close')} class="grid h-10 w-10 place-items-center rounded-full text-text-secondary hover:bg-surface-level-1 hover:text-text" aria-label={$language === 'ar' ? 'إغلاق' : 'Close menu'}>
        <Icon name="x" size={19} />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3">
      <div class="space-y-1">
        {#each regularItems as item}
          <button
            on:click={() => navigate(item.href)}
            class="flex min-h-11 w-full items-center gap-3 rounded-[14px] px-3 text-start text-sm font-semibold transition-colors"
            class:bg-primary-light={isActive(item.href)}
            class:text-primary={isActive(item.href)}
            class:text-text-secondary={!isActive(item.href)}
          >
            <Icon name={item.icon} size={18} strokeWidth={isActive(item.href) ? 2.5 : 2} />
            <span>{$language === 'ar' ? item.ar : item.en}</span>
          </button>
        {/each}
      </div>

      {#if $needsIdentityAction}
        <button on:click={() => navigate('/verification')} class="mt-4 flex w-full items-center gap-3 rounded-[14px] bg-warning-light p-3 text-start text-warning">
          <Icon name="shield" size={18} />
          <span class="text-sm font-bold">{$language === 'ar' ? 'أكمل التحقق' : 'Finish verification'}</span>
        </button>
      {/if}

      {#if $isAdmin}
        <div class="my-5 h-px bg-border-light"></div>
        <p class="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-text-muted">Admin</p>
        <div class="space-y-1">
          {#each adminItems as item}
            <button
              on:click={() => navigate(item.href)}
              class="flex min-h-11 w-full items-center gap-3 rounded-[14px] px-3 text-start text-sm font-semibold transition-colors"
              class:bg-primary-light={isActive(item.href)}
              class:text-primary={isActive(item.href)}
              class:text-text-secondary={!isActive(item.href)}
            >
              <Icon name={item.icon} size={18} strokeWidth={isActive(item.href) ? 2.5 : 2} />
              <span>{$language === 'ar' ? item.ar : item.en}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="space-y-1 border-t border-border-light p-3">
      <button on:click={toggleLanguage} class="flex min-h-11 w-full items-center gap-3 rounded-[14px] px-3 text-sm font-semibold text-text-secondary hover:bg-surface-level-1 hover:text-text">
        <span class="text-xs font-bold">Aa</span>
        <span>{$language === 'en' ? 'العربية' : 'English'}</span>
      </button>
      <button on:click={toggleTheme} class="flex min-h-11 w-full items-center gap-3 rounded-[14px] px-3 text-sm font-semibold text-text-secondary hover:bg-surface-level-1 hover:text-text">
        <Icon name={$theme === 'dark' ? 'sun' : 'moon'} size={17} />
        <span>{$theme === 'dark' ? ($language === 'ar' ? 'الوضع الفاتح' : 'Light mode') : ($language === 'ar' ? 'الوضع الداكن' : 'Dark mode')}</span>
      </button>
      {#if $isAuthenticated}
        <button on:click={handleLogout} class="flex min-h-11 w-full items-center gap-3 rounded-[14px] px-3 text-sm font-semibold text-danger hover:bg-danger-light">
          <Icon name="log-out" size={17} />
          <span>{$language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</span>
        </button>
      {/if}
    </div>
  </div>
</nav>

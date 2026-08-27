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
    { en: 'Notifications', ar: 'الإشعارات', href: '/notifications', icon: 'bell' },
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

  function toggleTheme() {
    uiState.toggleTheme()
  }

  function toggleLanguage() {
    uiState.setLanguage($language === 'en' ? 'ar' : 'en')
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" on:click={() => dispatch('close')} role="presentation"></div>
{/if}

<nav
  class="fixed inset-y-0 z-50 w-[19rem] max-w-[86vw] border-e border-border-light bg-surface-raised shadow-xl transition-transform duration-200 ease-out"
  class:left-0={$language !== 'ar'}
  class:right-0={$language === 'ar'}
  class:translate-x-0={isOpen}
  class:-translate-x-full={!isOpen && $language !== 'ar'}
  class:translate-x-full={!isOpen && $language === 'ar'}
  aria-label={$language === 'ar' ? 'القائمة' : 'Navigation menu'}
>
  <div class="flex h-full flex-col">
    <div class="flex min-h-[68px] items-center justify-between border-b border-border-light px-5">
      <button on:click={() => navigate('/home')} class="min-h-11 text-[18px] font-extrabold tracking-[0.15em] text-text">UNEEM</button>
      <button on:click={() => dispatch('close')} class="grid h-11 w-11 place-items-center rounded-full text-text-secondary hover:bg-surface-level-1 hover:text-text" aria-label={$language === 'ar' ? 'إغلاق' : 'Close menu'}>
        <Icon name="x" size={20} />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3">
      <div class="space-y-1">
        {#each regularItems as item}
          <button
            on:click={() => navigate(item.href)}
            class="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-start text-sm font-semibold transition-colors"
            class:bg-primary-light={isActive(item.href)}
            class:text-primary={isActive(item.href)}
            class:text-text-secondary={!isActive(item.href)}
          >
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl" class:bg-surface-level-1={!isActive(item.href)}>
              <Icon name={item.icon} size={19} strokeWidth={isActive(item.href) ? 2.5 : 2} />
            </span>
            <span>{$language === 'ar' ? item.ar : item.en}</span>
          </button>
        {/each}
      </div>

      {#if $needsIdentityAction}
        <button on:click={() => navigate('/verification')} class="mt-4 flex w-full items-start gap-3 rounded-2xl bg-warning-light p-3 text-start text-warning">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface/60"><Icon name="shield" size={19} /></span>
          <span class="min-w-0">
            <span class="block text-sm font-bold">{$language === 'ar' ? 'أكمل التحقق' : 'Finish verification'}</span>
            <span class="mt-0.5 block text-xs leading-5 opacity-80">{$language === 'ar' ? 'راجع بيانات الطالب والبطاقة' : 'Review your Student ID and card'}</span>
          </span>
        </button>
      {/if}

      {#if $isAdmin}
        <div class="my-5 flex items-center gap-3 px-2">
          <div class="h-px flex-1 bg-border-light"></div>
          <span class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-text-muted">Admin</span>
          <div class="h-px flex-1 bg-border-light"></div>
        </div>
        <div class="space-y-1">
          {#each adminItems as item}
            <button
              on:click={() => navigate(item.href)}
              class="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-start text-sm font-semibold transition-colors"
              class:bg-primary-light={isActive(item.href)}
              class:text-primary={isActive(item.href)}
              class:text-text-secondary={!isActive(item.href)}
            >
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl" class:bg-surface-level-1={!isActive(item.href)}>
                <Icon name={item.icon} size={19} strokeWidth={isActive(item.href) ? 2.5 : 2} />
              </span>
              <span>{$language === 'ar' ? item.ar : item.en}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="space-y-1 border-t border-border-light p-3">
      <button on:click={toggleLanguage} class="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-text-secondary hover:bg-surface-level-1 hover:text-text">
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-surface-level-1 text-xs font-bold">Aa</span>
        <span>{$language === 'en' ? 'العربية' : 'English'}</span>
      </button>
      <button on:click={toggleTheme} class="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-text-secondary hover:bg-surface-level-1 hover:text-text">
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-surface-level-1"><Icon name={$theme === 'dark' ? 'sun' : 'moon'} size={17} /></span>
        <span>{$theme === 'dark' ? ($language === 'ar' ? 'الوضع الفاتح' : 'Light mode') : ($language === 'ar' ? 'الوضع الداكن' : 'Dark mode')}</span>
      </button>
      {#if $isAuthenticated}
        <button on:click={handleLogout} class="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger-light">
          <span class="grid h-8 w-8 place-items-center rounded-lg bg-danger-light"><Icon name="log-out" size={17} /></span>
          <span>{$language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</span>
        </button>
      {/if}
    </div>
  </div>
</nav>

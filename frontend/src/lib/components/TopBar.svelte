<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { authState, isAdmin, isAuthenticated } from '$lib/stores/auth'
  import { theme, language, unreadNotifications, uiState } from '$lib/stores/ui'
  import { signOut } from '$lib/auth'
  import Icon from './Icon.svelte'

  export let onMenuToggle = () => {}

  const desktopNav = [
    { href: '/home', en: 'Home', ar: 'الرئيسية' },
    { href: '/matches', en: 'Matches', ar: 'المباريات' },
    { href: '/bookings', en: 'My Sports', ar: 'رياضتي' }
  ]

  $: mobileDetailPage = $page.url.pathname.startsWith('/pitch/')
    || /^\/matches\/[^/]+/.test($page.url.pathname)
    || /^\/bookings\/[^/]+/.test($page.url.pathname)

  $: initials = ($authState.user?.full_name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'

  function active(href: string) {
    return $page.url.pathname === href || $page.url.pathname.startsWith(`${href}/`)
  }

  async function handleLogout() {
    await signOut()
    goto('/login')
  }

  function toggleTheme() {
    uiState.toggleTheme()
  }

  function toggleLanguage() {
    uiState.setLanguage($language === 'en' ? 'ar' : 'en')
  }
</script>

<header class={`uneem-topbar sticky top-0 z-30 bg-background ${mobileDetailPage ? 'hidden lg:block' : ''}`}>
  <div class="uneem-topbar-inner mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 sm:px-6">
    <div class="flex min-w-0 items-center gap-1.5">
      <button
        on:click={onMenuToggle}
        class="grid h-10 w-10 place-items-center rounded-xl text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text lg:hidden"
        aria-label={$language === 'ar' ? 'فتح القائمة' : 'Open menu'}
      >
        <Icon name="menu" size={20} />
      </button>

      <a href={$isAuthenticated ? '/home' : '/login'} class="flex min-h-10 items-center gap-2 rounded-lg px-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
        <img
          src="/assets/brand/app-icon.svg"
          alt=""
          width="28"
          height="28"
          decoding="async"
          class="h-9 w-9 shrink-0 rounded-xl object-contain"
        />
        <span class="text-[17px] font-extrabold tracking-[0.14em] text-text">UNEEM</span>
      </a>
    </div>

    {#if $isAuthenticated}
      <nav class="hidden flex-1 items-center justify-center gap-5 lg:flex" aria-label={$language === 'ar' ? 'التنقل الرئيسي' : 'Primary navigation'}>
        {#each desktopNav as item}
          <a
            href={item.href}
            class="relative flex min-h-10 items-center text-sm font-semibold transition-colors"
            class:text-primary={active(item.href)}
            class:text-text-secondary={!active(item.href)}
            aria-current={active(item.href) ? 'page' : undefined}
          >
            {$language === 'ar' ? item.ar : item.en}
            {#if active(item.href)}<span class="absolute inset-x-0 -bottom-[9px] mx-auto h-0.5 rounded-full bg-primary"></span>{/if}
          </a>
        {/each}
      </nav>
    {/if}

    <div class="flex items-center gap-0.5">
      {#if $isAuthenticated}
        <a href="/notifications" class="relative grid h-11 w-11 place-items-center rounded-xl text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text" aria-label={$language === 'ar' ? `الإشعارات${$unreadNotifications ? `، ${$unreadNotifications} جديدة` : ''}` : `Notifications${$unreadNotifications ? `, ${$unreadNotifications} new` : ''}`}>
          <Icon name="bell" size={19} />
          {#if $unreadNotifications > 0}
            <span class="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-background"></span>
          {/if}
        </a>
      {/if}

      <button
        on:click={toggleLanguage}
        class="hidden min-h-10 items-center rounded-xl px-3 text-sm font-bold text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text md:inline-flex"
        aria-label="Toggle language"
      >
        {$language === 'ar' ? 'EN' : 'AR'}
      </button>

      <button
        on:click={toggleTheme}
        class="hidden h-10 w-10 place-items-center rounded-xl text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text md:grid"
        aria-label={$language === 'ar' ? 'تغيير المظهر' : 'Change appearance'}
      >
        {#if $theme === 'dark'}<Icon name="sun" size={18} />{:else}<Icon name="moon" size={18} />{/if}
      </button>

      {#if $isAuthenticated}
        <div class="relative hidden lg:block group">
          <button class="ms-1 grid h-10 w-10 place-items-center rounded-xl bg-surface-level-1 text-xs font-extrabold text-text-secondary transition-colors hover:text-text" aria-label={$language === 'ar' ? 'قائمة الحساب' : 'Account menu'}>
            {initials}
          </button>
          <div class="absolute end-0 mt-2 hidden w-56 overflow-hidden rounded-xl border border-border-light bg-surface-raised p-1.5 shadow-lg group-hover:block group-focus-within:block">
            <a href="/profile" class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-text-secondary hover:bg-surface-level-1 hover:text-text">
              <Icon name="user" size={17} />{$language === 'ar' ? 'الحساب' : 'Profile'}
            </a>
            <a href="/help" class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-text-secondary hover:bg-surface-level-1 hover:text-text">
              <Icon name="message-circle" size={17} />{$language === 'ar' ? 'الدعم' : 'Support'}
            </a>
            {#if $isAdmin}
              <div class="my-1 h-px bg-border-light"></div>
              <a href="/admin" class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-text-secondary hover:bg-surface-level-1 hover:text-text">
                <Icon name="shield" size={17} />{$language === 'ar' ? 'الإدارة' : 'Admin'}
              </a>
            {/if}
            <div class="my-1 h-px bg-border-light"></div>
            <button on:click={handleLogout} class="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-start text-sm font-semibold text-danger hover:bg-danger-light">
              <Icon name="log-out" size={17} />{$language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</header>

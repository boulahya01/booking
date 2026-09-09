<script lang="ts">
  import { page } from '$app/stores'
  import { isAuthenticated } from '$lib/stores/auth'
  import { language, unreadNotifications } from '$lib/stores/ui'
  import Icon from './Icon.svelte'

  const desktopNav = [
    { href: '/home', en: 'Home', ar: 'الرئيسية' },
    { href: '/matches', en: 'Matches', ar: 'المباريات' },
    { href: '/bookings', en: 'My Sports', ar: 'رياضتي' },
    { href: '/menu', en: 'Menu', ar: 'القائمة' }
  ]
  $: mobileDetailPage = $page.url.pathname.startsWith('/pitch/')
    || /^\/matches\/[^/]+/.test($page.url.pathname)
    || /^\/bookings\/[^/]+/.test($page.url.pathname)

  function active(href: string) {
    if (href === '/menu') return ['/menu', '/profile', '/verification', '/pending-approval', '/notifications', '/report', '/admin'].some(path => $page.url.pathname === path || $page.url.pathname.startsWith(`${path}/`))
    return $page.url.pathname === href || $page.url.pathname.startsWith(`${href}/`)
  }
</script>

<header class={`uneem-topbar bg-background ${mobileDetailPage ? 'hidden lg:block' : ''}`}>
  <div class="uneem-topbar-inner mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
    <a href={$isAuthenticated ? '/home' : '/login'} class="flex min-h-11 items-center gap-2.5 rounded-xl">
      <img src="/assets/brand/app-icon.svg" alt="" width="36" height="36" decoding="async" class="h-9 w-9 shrink-0 rounded-xl" />
      <span class="text-[17px] font-bold tracking-[0.08em] text-text">UNEEM</span>
    </a>
    {#if $isAuthenticated}
      <nav class="hidden items-center gap-2 lg:flex" aria-label={$language === 'ar' ? 'التنقل الرئيسي' : 'Primary navigation'}>
        {#each desktopNav as item}
          <a href={item.href} class="flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold transition-colors hover:bg-surface-level-1"
            class:bg-surface={active(item.href)} class:text-primary={active(item.href)} class:text-text-secondary={!active(item.href)} aria-current={active(item.href) ? 'page' : undefined}>
            {$language === 'ar' ? item.ar : item.en}
          </a>
        {/each}
      </nav>
      <a href="/notifications" class="uneem-icon-button relative" aria-label={$language === 'ar' ? `الإشعارات${$unreadNotifications ? `، ${$unreadNotifications} جديدة` : ''}` : `Notifications${$unreadNotifications ? `, ${$unreadNotifications} new` : ''}`}>
        <Icon name="bell" size={21} />
        {#if $unreadNotifications > 0}<span class="absolute end-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-background"></span>{/if}
      </a>
    {/if}
  </div>
</header>

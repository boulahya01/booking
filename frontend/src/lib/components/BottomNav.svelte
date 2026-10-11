<script lang="ts">
  import { page } from '$app/stores'
  import { language } from '$lib/stores/ui'
  import Icon from './Icon.svelte'

  type NavItem = { label: [string, string]; href: string; icon: string }

  const items: NavItem[] = [
    { label: ['Home', 'الرئيسية'], href: '/home', icon: 'home' },
    { label: ['Matches', 'المباريات'], href: '/matches', icon: 'users' },
    { label: ['My Sports', 'رياضتي'], href: '/bookings', icon: 'calendar-days' },
    { label: ['Menu', 'القائمة'], href: '/menu', icon: 'menu' }
  ]

  function isActive(href: string): boolean {
    if (href === '/menu') return ['/menu', '/profile', '/verification', '/pending-approval', '/notifications', '/report', '/admin'].some(path => $page.url.pathname === path || $page.url.pathname.startsWith(`${path}/`))
    return $page.url.pathname === href || $page.url.pathname.startsWith(`${href}/`)
  }
</script>

<nav class="uneem-bottom-nav fixed inset-x-0 bottom-0 z-40 lg:hidden" aria-label={$language === 'ar' ? 'التنقل الرئيسي' : 'Primary navigation'}>
  <div class="uneem-bottom-nav-inner mx-auto flex max-w-lg items-stretch px-2">
    {#each items as item}
      <a
        href={item.href}
        class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-text-muted transition-colors"
        class:text-primary={isActive(item.href)}
        aria-current={isActive(item.href) ? 'page' : undefined}
      >
        <Icon name={item.icon} size={23} strokeWidth={isActive(item.href) ? 2.5 : 1.8} />
        <span class="max-w-full truncate text-[11px] font-semibold leading-tight">{item.label[$language === 'ar' ? 1 : 0]}</span>
      </a>
    {/each}
  </div>
</nav>

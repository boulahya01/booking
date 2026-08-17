<script lang="ts">
  import { page } from '$app/stores'
  import { isAdmin } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'
  import Icon from './Icon.svelte'

  type NavItem = { label: [string, string]; href: string; icon: string }

  const regularItems: NavItem[] = [
    { label: ['Home', 'الرئيسية'], href: '/home', icon: 'home' },
    { label: ['Matches', 'المباريات'], href: '/matches', icon: 'users' },
    { label: ['My Sports', 'رياضتي'], href: '/bookings', icon: 'calendar-days' },
    { label: ['Profile', 'حسابي'], href: '/profile', icon: 'user' }
  ]

  const adminItem: NavItem = { label: ['Admin', 'الإدارة'], href: '/admin/bookings', icon: 'shield' }

  function isActive(href: string): boolean {
    return $page.url.pathname === href || $page.url.pathname.startsWith(`${href}/`)
  }
</script>

<nav class="fixed inset-x-0 bottom-0 z-40 border-t border-border-light bg-surface/96 backdrop-blur-xl md:hidden" aria-label="Mobile navigation">
  <div class="mx-auto flex min-h-[64px] max-w-lg items-stretch px-1 pb-[env(safe-area-inset-bottom)]">
    {#each regularItems as item}
      <a
        href={item.href}
        class="group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-text-muted transition-colors"
        class:text-primary={isActive(item.href)}
        aria-current={isActive(item.href) ? 'page' : undefined}
      >
        <span class="grid h-8 min-w-12 place-items-center rounded-full transition-colors group-hover:bg-surface-level-1" class:bg-primary-light={isActive(item.href)}>
          <Icon name={item.icon} size={20} strokeWidth={isActive(item.href) ? 2.5 : 2} />
        </span>
        <span class="max-w-full truncate text-[10px] font-semibold">{item.label[$language === 'ar' ? 1 : 0]}</span>
      </a>
    {/each}

    {#if $isAdmin}
      <a
        href={adminItem.href}
        class="group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-text-muted transition-colors"
        class:text-primary={isActive('/admin')}
        aria-current={isActive('/admin') ? 'page' : undefined}
      >
        <span class="grid h-8 min-w-12 place-items-center rounded-full transition-colors group-hover:bg-surface-level-1" class:bg-primary-light={isActive('/admin')}>
          <Icon name={adminItem.icon} size={20} strokeWidth={isActive('/admin') ? 2.5 : 2} />
        </span>
        <span class="max-w-full truncate text-[10px] font-semibold">{adminItem.label[$language === 'ar' ? 1 : 0]}</span>
      </a>
    {/if}
  </div>
</nav>

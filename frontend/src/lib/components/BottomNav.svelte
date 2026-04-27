<script lang="ts">
  import { page } from '$app/stores'
  import { isAdmin } from '$lib/stores/auth'
  import { cn } from '$lib/utils/cn'
  import Icon from './Icon.svelte'
  import { _ } from 'svelte-i18n'

  type NavItem = {
    labelKey: string
    href: string
    icon: string
    adminOnly?: boolean
  }

  const navItems: NavItem[] = [
    { labelKey: 'nav.home', href: '/home', icon: 'home' },
    { labelKey: 'nav.bookings', href: '/bookings', icon: 'calendar-days' },
    { labelKey: 'nav.notifications', href: '/notifications', icon: 'bell' },
    { labelKey: 'nav.profile', href: '/profile', icon: 'user' },
    { labelKey: 'admin.bookings_title', href: '/admin/bookings', icon: 'calendar-days', adminOnly: true },
    { labelKey: 'nav.admin', href: '/admin/users', icon: 'settings', adminOnly: true }
  ]

  function isActive(href: string): boolean {
    return $page.url.pathname.startsWith(href)
  }
</script>

<!-- Mobile Bottom Navigation -->
<nav
  class={cn(
    'fixed bottom-0 left-0 right-0 z-40 md:hidden',
    'bg-surface border-t border-border dark:border-white/6',
    'safe-bottom'
  )}
  aria-label="Mobile navigation"
>
  <div class="flex justify-around items-stretch">
    {#each navItems as item}
      {#if !item.adminOnly || $isAdmin}
        <a
          href={item.href}
          class={cn(
            'flex-1 flex flex-col items-center justify-center py-2.5 px-2 text-xs font-medium',
            'transition-colors duration-200 touch-target-min',
            isActive(item.href)
              ? 'text-primary bg-primary-light border-t-2 border-primary'
              : 'text-text-muted hover:text-text'
          )}
        >
          <Icon name={item.icon} size={22} strokeWidth={isActive(item.href) ? 2.5 : 2} />
          <span class="text-[11px] mt-1">{$_(item.labelKey)}</span>
        </a>
      {/if}
    {/each}
  </div>
</nav>

<style>
  :global(.safe-bottom) {
    padding-bottom: var(--safe-area-inset-bottom, 0);
  }
</style>

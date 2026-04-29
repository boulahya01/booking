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

  const regularItems: NavItem[] = [
    { labelKey: 'nav.home', href: '/home', icon: 'home' },
    { labelKey: 'nav.bookings', href: '/bookings', icon: 'calendar-days' },
    { labelKey: 'nav.notifications', href: '/notifications', icon: 'bell' },
    { labelKey: 'nav.profile', href: '/profile', icon: 'user' }
  ]

  const adminItems: NavItem[] = [
    { labelKey: 'admin.bookings_title', href: '/admin/bookings', icon: 'calendar-check' },
    { labelKey: 'nav.manage_pitches', href: '/admin/pitches', icon: 'map-pin' },
    { labelKey: 'nav.manage_users', href: '/admin/manage-users', icon: 'users' },
    { labelKey: 'nav.notifications_admin', href: '/admin/notifications', icon: 'bell-dot' }
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
  <div class="flex items-stretch">
    <!-- Regular items -->
    {#each regularItems as item}
      <a
        href={item.href}
        class={cn(
          'flex-1 flex flex-col items-center justify-center py-2.5 px-1 text-xs font-medium',
          'transition-colors duration-200',
          isActive(item.href)
            ? 'text-primary bg-primary-light/60 border-t-2 border-primary'
            : 'text-text-muted hover:text-text'
        )}
      >
        <Icon name={item.icon} size={20} strokeWidth={isActive(item.href) ? 2.5 : 2} />
        <span class="text-[10px] mt-0.5 truncate w-full text-center">{$_(item.labelKey)}</span>
      </a>
    {/each}

    <!-- Admin separator -->
    {#if $isAdmin}
      <div class="flex items-center px-0.5" style="min-width: 0; flex: 0 0 auto;">
        <div class="w-[1px] h-6 self-center bg-border/60"></div>
      </div>

      <!-- Admin items -->
      {#each adminItems as item}
        <a
          href={item.href}
          class={cn(
            'flex-1 flex flex-col items-center justify-center py-2.5 px-1 text-xs font-medium',
            'transition-colors duration-200',
            isActive(item.href)
              ? 'text-primary bg-primary-light/60 border-t-2 border-primary'
              : 'text-text-muted hover:text-text'
          )}
        >
          <Icon name={item.icon} size={20} strokeWidth={isActive(item.href) ? 2.5 : 2} />
          <span class="text-[10px] mt-0.5 truncate w-full text-center">{$_(item.labelKey)}</span>
        </a>
      {/each}
    {/if}
  </div>
</nav>

<style>
  :global(.safe-bottom) {
    padding-bottom: var(--safe-area-inset-bottom, 0);
  }
</style>

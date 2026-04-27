<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { createEventDispatcher } from 'svelte'
  import { authState, isAdmin, isAuthenticated } from '$lib/stores/auth'
  import { theme, language, uiState } from '$lib/stores/ui'
  import { signOut } from '$lib/auth'
  import { cn } from '$lib/utils/cn'
  import Icon from './Icon.svelte'
  import { _ } from 'svelte-i18n'

  export let isOpen = false
  const dispatch = createEventDispatcher()

  type NavItem = {
    labelKey: string
    href: string
    icon: string
    adminOnly?: boolean
  }

  const navItems: NavItem[] = [
    { labelKey: 'nav.home', href: '/home', icon: 'home' },
    { labelKey: 'nav.bookings', href: '/bookings', icon: 'calendar-days' },
    { labelKey: 'nav.profile', href: '/profile', icon: 'user' },
    { labelKey: 'nav.notifications', href: '/notifications', icon: 'bell' },
    { labelKey: 'nav.all_bookings', href: '/admin/bookings', icon: 'calendar-days', adminOnly: true },
    { labelKey: 'nav.admin', href: '/admin/users', icon: 'shield', adminOnly: true }
  ]

  function isActive(href: string): boolean {
    return $page.url.pathname.startsWith(href)
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

<!-- Backdrop -->
{#if isOpen}
  <div
    class="fixed inset-0 bg-black/40 dark:bg-black/60 z-40"
    on:click={() => dispatch('close')}
    role="presentation"
  ></div>
{/if}

<!-- Side Navigation Panel -->
<nav
  class={cn(
    'fixed top-0 left-0 bottom-0 z-50 w-72 bg-surface border-r border-border dark:border-white/6',
    'transform transition-transform duration-300 ease-in-out',
    isOpen ? 'translate-x-0' : '-translate-x-full'
  )}
  aria-label="Side navigation"
>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-border dark:border-white/6">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 bg-gradient-to-br from-primary to-primary-dark rounded-lg flex items-center justify-center text-white font-bold text-sm">
          B
        </div>
        <span class="font-medium font-serif text-text">Booking</span>
      </div>
      <button
        on:click={() => dispatch('close')}
        class="p-2 hover:bg-surface-level-1 rounded-lg transition"
        aria-label="Close menu"
      >
        <Icon name="x" size={20} className="text-text-secondary" />
      </button>
    </div>

    <!-- Navigation Links -->
    <div class="flex-1 overflow-y-auto py-3">
      {#each navItems as item}
        {#if !item.adminOnly || $isAdmin}
          <button
            on:click={() => navigate(item.href)}
            class={cn(
              'w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors',
              isActive(item.href)
                ? 'text-primary bg-primary-light'
                : 'text-text-secondary hover:text-text hover:bg-surface-level-1'
            )}
            aria-label={$_(item.labelKey)}
          >
            <Icon name={item.icon} size={20} strokeWidth={isActive(item.href) ? 2.5 : 2} />
            <span>{$_(item.labelKey)}</span>
          </button>
        {/if}
      {/each}
    </div>

    <!-- Footer Actions -->
    <div class="border-t border-border dark:border-white/6 py-3 px-3 space-y-1">
      <!-- Theme Toggle -->
      <button
        on:click={toggleTheme}
        class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text hover:bg-surface-level-1 rounded-lg transition"
        aria-label={$theme === 'dark' ? $_('nav.light_mode') : $_('nav.dark_mode')}
      >
        {#if $theme === 'dark'}
          <Icon name="sun" size={18} />
          <span>{$_('nav.dark_mode')}</span>
        {:else}
          <Icon name="moon" size={18} />
          <span>{$_('nav.light_mode')}</span>
        {/if}
      </button>

      <!-- Language Toggle -->
      <button
        on:click={toggleLanguage}
        class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text hover:bg-surface-level-1 rounded-lg transition"
        aria-label={$_('nav.toggle_language')}
      >
        <span class="w-[18px] h-[18px] flex items-center justify-center text-text-muted font-semibold text-xs">Aa</span>
        <span>{$language === 'en' ? 'العربية' : 'English'}</span>
      </button>

      <!-- Logout -->
      {#if $isAuthenticated}
        <button
          on:click={handleLogout}
          class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-danger hover:bg-danger-light rounded-lg transition"
          aria-label={$_('nav.logout')}
        >
          <Icon name="log-out" size={18} />
          <span>{$_('nav.logout')}</span>
        </button>
      {/if}
    </div>
  </div>
</nav>

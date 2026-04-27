<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { authState, isAdmin, isAuthenticated } from '$lib/stores/auth'
  import { theme, language, unreadNotifications, uiState } from '$lib/stores/ui'
  import { signOut } from '$lib/auth'
  import { cn } from '$lib/utils/cn'
  import Icon from './Icon.svelte'
  import { _ } from 'svelte-i18n'

  export let onMenuToggle = () => {}

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

<header class="topbar">
  <div class="max-w-7xl mx-auto w-full h-full px-4 flex items-center justify-between">
    <!-- Left: Hamburger + Logo -->
    <div class="flex items-center gap-3">
      <!-- Hamburger (mobile only) -->
      <button
        on:click={onMenuToggle}
        class="lg:hidden p-2 -ml-2 hover:bg-surface-level-1 rounded-lg transition"
        aria-label="Open menu"
      >
        <Icon name="menu" size={20} className="text-text-secondary" />
      </button>

      <a href={$isAuthenticated ? '/home' : '/login'} class="flex items-center gap-2">
        <div class="w-8 h-8 bg-gradient-to-br from-primary to-primary-dark rounded-lg flex items-center justify-center text-white font-bold text-sm">
          B
        </div>
        <span class="font-medium font-serif text-text hidden sm:inline">
          UnemBook
        </span>
      </a>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-1">
      {#if $isAuthenticated}
        <!-- Notifications (desktop only) -->
        <a
          href="/notifications"
          class="hidden md:flex relative p-2.5 hover:bg-surface-level-1 rounded-lg transition"
          aria-label={$_('nav.notifications')}
        >
          <Icon name="bell" size={20} className="text-text-secondary" />
          {#if $unreadNotifications > 0}
            <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full"></span>
          {/if}
        </a>
      {/if}

      <!-- Theme Toggle -->
      <button
        on:click={toggleTheme}
        class="p-2.5 hover:bg-surface-level-1 rounded-lg transition"
        aria-label={$_('nav.dark_mode')}
        title="Switch theme"
      >
        {#if $theme === 'dark' || ($theme === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)}
          <Icon name="sun" size={20} className="text-text-secondary" />
        {:else}
          <Icon name="moon" size={20} className="text-text-secondary" />
        {/if}
      </button>

      <!-- Language Toggle (desktop only) -->
      <button
        on:click={toggleLanguage}
        class="hidden md:flex px-3 py-2 hover:bg-surface-level-1 rounded-lg transition font-medium text-sm text-text-secondary"
        aria-label="Toggle language"
      >
        {$language.toUpperCase()}
      </button>

      {#if $isAuthenticated}
        <!-- User Menu (desktop only) -->
        <div class="relative group hidden lg:block">
          <button
            class="p-2.5 hover:bg-surface-level-1 rounded-lg transition"
            aria-label="User menu"
          >
            <Icon name="user" size={20} className="text-text-secondary" />
          </button>
          <div
            class="hidden group-hover:block absolute right-0 mt-2 w-48 bg-surface-raised rounded-xl shadow-lg border border-border dark:border-white/6 overflow-hidden"
          >
            <a
              href="/profile"
              class="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-level-1 text-sm text-text"
            >
              <Icon name="user" size={16} />
              {$_('profile.title')}
            </a>
            {#if $isAdmin}
              <a
                href="/admin/notifications"
                class="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-level-1 text-sm text-text"
              >
                <Icon name="bell" size={16} />
                {$_('notifications.title')}
              </a>
              <a
                href="/admin/bookings"
                class="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-level-1 text-sm text-text"
              >
                <Icon name="calendar-days" size={16} />
                {$_('admin.bookings_title')}
              </a>
              <a
                href="/admin/users"
                class="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-level-1 text-sm text-text"
              >
                <Icon name="shield" size={16} />
                {$_('nav.admin')}
              </a>
            {/if}
            <button
              on:click={handleLogout}
              class="w-full flex items-center gap-2 text-left px-4 py-2.5 hover:bg-danger-light text-sm text-danger border-t border-border dark:border-white/6"
            >
              <Icon name="log-out" size={16} />
              {$_('nav.logout')}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</header>

<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { createEventDispatcher } from 'svelte'
  import { isAdmin, isAuthenticated, needsIdentityAction } from '$lib/stores/auth'
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
  }

  const regularItems: NavItem[] = [
    { labelKey: 'nav.home', href: '/home', icon: 'home' },
    { labelKey: 'nav.bookings', href: '/bookings', icon: 'calendar-days' },
    { labelKey: 'nav.profile', href: '/profile', icon: 'user' },
    { labelKey: 'nav.notifications', href: '/notifications', icon: 'bell' }
  ]

  const adminItems: NavItem[] = [
    { labelKey: 'nav.all_bookings', href: '/admin/bookings', icon: 'calendar-check' },
    { labelKey: 'nav.manage_pitches', href: '/admin/pitches', icon: 'map-pin' },
    { labelKey: 'nav.manage_users', href: '/admin/manage-users', icon: 'users' },
    { labelKey: 'nav.notifications_admin', href: '/admin/notifications', icon: 'bell-dot' },
    { labelKey: 'nav.admin', href: '/admin/users', icon: 'shield' }
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

{#if isOpen}
  <div class="fixed inset-0 bg-black/40 dark:bg-black/60 z-40" on:click={() => dispatch('close')} role="presentation"></div>
{/if}

<nav
  class={cn(
    'fixed top-0 left-0 bottom-0 z-50 w-72 bg-surface border-r border-border',
    'transform transition-transform duration-300 ease-in-out',
    isOpen ? 'translate-x-0' : '-translate-x-full'
  )}
  aria-label="Side navigation"
>
  <div class="flex flex-col h-full">
    <div class="flex items-center justify-between px-5 py-4 border-b border-border-light">
      <div class="flex items-center gap-2.5">
        <div class="grid h-8 w-8 place-items-center rounded-xl bg-primary text-text-inverse text-sm font-bold">U</div>
        <span class="font-semibold tracking-tight text-text">UNEEM</span>
      </div>
      <button on:click={() => dispatch('close')} class="p-2 hover:bg-surface-level-1 rounded-xl transition" aria-label="Close menu">
        <Icon name="x" size={20} className="text-text-secondary" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto py-3">
      {#each regularItems as item}
        <button
          on:click={() => navigate(item.href)}
          class={cn(
            'w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors',
            isActive(item.href) ? 'text-primary bg-primary-light' : 'text-text-secondary hover:text-text hover:bg-surface-level-1'
          )}
          aria-label={$_(item.labelKey)}
        >
          <Icon name={item.icon} size={20} strokeWidth={isActive(item.href) ? 2.5 : 2} />
          <span>{$_(item.labelKey)}</span>
        </button>
      {/each}

      <button
        on:click={() => navigate('/help')}
        class={cn(
          'w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors',
          isActive('/help') ? 'text-primary bg-primary-light' : 'text-text-secondary hover:text-text hover:bg-surface-level-1'
        )}
        aria-label={$language === 'ar' ? 'المساعدة والدعم' : 'Help and support'}
      >
        <Icon name="message-circle" size={20} />
        <span>{$language === 'ar' ? 'المساعدة والدعم' : 'Help & support'}</span>
      </button>

      {#if $needsIdentityAction}
        <button
          on:click={() => navigate('/verification')}
          class={cn(
            'mx-3 mt-2 w-[calc(100%-1.5rem)] flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-colors',
            isActive('/verification') ? 'text-primary bg-primary-light' : 'text-text bg-surface-level-1 hover:bg-primary-light'
          )}
          aria-label={$language === 'ar' ? 'توثيق هوية الطالب' : 'Verify student identity'}
        >
          <Icon name="shield" size={20} />
          <div class="min-w-0 text-start">
            <div class="font-medium">{$language === 'ar' ? 'توثيق الطالب' : 'Student verification'}</div>
            <div class="text-xs text-text-muted mt-0.5">{$language === 'ar' ? 'أكمل توثيق بطاقتك' : 'Complete your student identity'}</div>
          </div>
        </button>
      {/if}

      {#if $isAdmin}
        <div class="flex items-center gap-3 px-5 py-3 mt-1">
          <div class="flex-1 h-[1px] bg-border/60"></div>
          <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted/70">Admin</span>
          <div class="flex-1 h-[1px] bg-border/60"></div>
        </div>

        <button
          on:click={() => navigate('/admin/support')}
          class={cn(
            'w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors',
            isActive('/admin/support') ? 'text-primary bg-primary-light' : 'text-text-secondary hover:text-text hover:bg-surface-level-1'
          )}
          aria-label={$language === 'ar' ? 'الدعم والتقارير' : 'Help and reports inbox'}
        >
          <Icon name="message-circle" size={20} strokeWidth={isActive('/admin/support') ? 2.5 : 2} />
          <span>{$language === 'ar' ? 'الدعم والتقارير' : 'Help & reports'}</span>
        </button>

        <button
          on:click={() => navigate('/admin/verification')}
          class={cn(
            'w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors',
            isActive('/admin/verification') ? 'text-primary bg-primary-light' : 'text-text-secondary hover:text-text hover:bg-surface-level-1'
          )}
          aria-label={$language === 'ar' ? 'طلبات توثيق الطلبة' : 'Student verification queue'}
        >
          <Icon name="shield" size={20} strokeWidth={isActive('/admin/verification') ? 2.5 : 2} />
          <span>{$language === 'ar' ? 'توثيق الطلبة' : 'Verification queue'}</span>
        </button>

        {#each adminItems as item}
          <button
            on:click={() => navigate(item.href)}
            class={cn(
              'w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors',
              isActive(item.href) ? 'text-primary bg-primary-light' : 'text-text-secondary hover:text-text hover:bg-surface-level-1'
            )}
            aria-label={$_(item.labelKey)}
          >
            <Icon name={item.icon} size={20} strokeWidth={isActive(item.href) ? 2.5 : 2} />
            <span>{$_(item.labelKey)}</span>
          </button>
        {/each}
      {/if}
    </div>

    <div class="border-t border-border-light py-3 px-3 space-y-1">
      <button on:click={toggleTheme} class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text hover:bg-surface-level-1 rounded-xl transition" aria-label={$theme === 'dark' ? $_('nav.light_mode') : $_('nav.dark_mode')}>
        {#if $theme === 'dark'}
          <Icon name="sun" size={18} /><span>{$_('nav.dark_mode')}</span>
        {:else}
          <Icon name="moon" size={18} /><span>{$_('nav.light_mode')}</span>
        {/if}
      </button>

      <button on:click={toggleLanguage} class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text hover:bg-surface-level-1 rounded-xl transition" aria-label={$_('nav.toggle_language')}>
        <span class="w-[18px] h-[18px] flex items-center justify-center text-text-muted font-semibold text-xs">Aa</span>
        <span>{$language === 'en' ? 'العربية' : 'English'}</span>
      </button>

      {#if $isAuthenticated}
        <button on:click={handleLogout} class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-danger hover:bg-danger-light rounded-xl transition" aria-label={$_('nav.logout')}>
          <Icon name="log-out" size={18} /><span>{$_('nav.logout')}</span>
        </button>
      {/if}
    </div>
  </div>
</nav>
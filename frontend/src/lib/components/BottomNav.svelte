<script lang="ts">
  import { page } from '$app/stores'
  import { isAdmin } from '$lib/stores/auth'
  import { cn } from '$lib/utils/cn'
  import Icon from './Icon.svelte'
  import { language } from '$lib/stores/ui'

  type NavItem = { label: [string, string]; href: string; icon: string }

  const regularItems: NavItem[] = [
    { label: ['Home', 'الرئيسية'], href: '/home', icon: 'home' },
    { label: ['Matches', 'المباريات'], href: '/matches', icon: 'users' },
    { label: ['My Sports', 'رياضتي'], href: '/bookings', icon: 'calendar-days' },
    { label: ['Profile', 'حسابي'], href: '/profile', icon: 'user' }
  ]

  const adminItems: NavItem[] = [
    { label: ['Admin', 'الإدارة'], href: '/admin/bookings', icon: 'shield' }
  ]

  function isActive(href: string): boolean {
    return $page.url.pathname.startsWith(href)
  }
</script>

<nav class={cn('fixed bottom-0 left-0 right-0 z-40 md:hidden','bg-surface/95 backdrop-blur border-t border-border dark:border-white/6','safe-bottom')} aria-label="Mobile navigation">
  <div class="mx-auto flex max-w-lg items-stretch px-1">
    {#each regularItems as item}
      <a href={item.href} class={cn('flex-1 min-h-[58px] flex flex-col items-center justify-center px-1 text-xs font-medium transition-colors',isActive(item.href) ? 'text-primary' : 'text-text-muted hover:text-text')} aria-current={isActive(item.href) ? 'page' : undefined}>
        <div class={cn('grid h-8 min-w-12 place-items-center rounded-full transition-colors', isActive(item.href) ? 'bg-primary-light' : '')}>
          <Icon name={item.icon} size={20} strokeWidth={isActive(item.href) ? 2.5 : 2} />
        </div>
        <span class="mt-0.5 max-w-full truncate text-[10px]">{item.label[$language === 'ar' ? 1 : 0]}</span>
      </a>
    {/each}
    {#if $isAdmin}
      {#each adminItems as item}
        <a href={item.href} class={cn('flex-1 min-h-[58px] flex flex-col items-center justify-center px-1 text-xs font-medium transition-colors',isActive(item.href) ? 'text-primary' : 'text-text-muted hover:text-text')}>
          <div class={cn('grid h-8 min-w-12 place-items-center rounded-full', isActive(item.href) ? 'bg-primary-light' : '')}><Icon name={item.icon} size={20} /></div>
          <span class="mt-0.5 text-[10px]">{item.label[$language === 'ar' ? 1 : 0]}</span>
        </a>
      {/each}
    {/if}
  </div>
</nav>

<style>:global(.safe-bottom){padding-bottom:var(--safe-area-inset-bottom,0)}</style>

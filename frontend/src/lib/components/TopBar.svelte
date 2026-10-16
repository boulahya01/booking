<script lang="ts">
  import { page } from '$app/stores'
  import { isAuthenticated } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'
  import { primaryNavigation, navigationActive } from '$lib/navigation'
  import HeaderControls from './HeaderControls.svelte'
  import { communityUnread } from '$lib/stores/community'
</script>
<header class="uneem-topbar">
  <div class="uneem-topbar-inner">
    <a href={$isAuthenticated ? '/home' : '/login'} class="header-brand" aria-label="UNEM Sports">
      <img src="/assets/brand/app-icon.svg" alt="" width="30" height="30" decoding="async" /><span>UNEM Sports</span>
    </a>
    {#if $isAuthenticated}
      <nav class="desktop-navigation" aria-label={$language === 'ar' ? 'التنقل الرئيسي' : 'Primary navigation'}>
        {#each primaryNavigation as item}
          <a href={item.href} aria-current={navigationActive($page.url.pathname, item.paths) ? 'page' : undefined}>{$language === 'ar' ? item.ar : item.en}{#if item.href === '/community' && $communityUnread > 0}<span class="nav-unread">{$communityUnread > 99 ? '99+' : $communityUnread}</span>{/if}</a>
        {/each}
      </nav>
    {/if}
    <HeaderControls />
  </div>
</header>
<style>
  .uneem-topbar { border-bottom: 1px solid var(--border-light); }
  .uneem-topbar-inner { display: flex; width: 100%; max-width: 80rem; margin-inline: auto; align-items: center; justify-content: space-between; gap: 8px; padding-inline: var(--page-gutter); }
  .header-brand { display: inline-flex; align-items: center; gap: 8px; min-width: 0; min-height: 44px; font-size: 16px; font-weight: 500; letter-spacing: var(--tracking-tight); white-space: nowrap; }
  .header-brand img { width: 30px; height: 30px; border-radius: 8px; }
  .desktop-navigation { display: none; align-items: center; gap: 8px; }
  .desktop-navigation a { padding: 10px 16px; border-radius: 9px; font-size: 15px; color: var(--text-secondary); }
  .desktop-navigation a[aria-current='page'] { background: var(--primary-light); color: var(--primary); }
  .nav-unread { margin-inline-start:6px; font-size:11px; color:var(--primary); }
  @media (min-width: 1024px) { .desktop-navigation { display: flex; } }
  @media (max-width: 359px) { .uneem-topbar-inner { padding-inline: 12px; } .header-brand { font-size: 14px; gap: 6px; } .header-brand img { width: 26px; height: 26px; } }
</style>

<script lang="ts">
  import { page } from '$app/stores'
  import { language } from '$lib/stores/ui'
  import { playNavigation, accountNavigation, communityNavigation } from '$lib/navigation'
  $: pathname = $page.url.pathname
  $: play = playNavigation.some(item => item.href === pathname)
  $: account = accountNavigation.some(item => item.href === pathname)
  $: community = pathname.startsWith('/community')
  $: links = community ? communityNavigation : play ? playNavigation : accountNavigation
  function selected(href: string, currentPath: string) { return currentPath === href || (currentPath.startsWith('/community') && href !== '/community' && currentPath.startsWith(href + '/')) }
</script>
{#if play || account || community}
  <nav class="section-navigation" class:account class:community aria-label={community ? ($language === 'ar' ? 'أقسام المجتمع' : 'Community sections') : play ? ($language === 'ar' ? 'أقسام اللعب' : 'Play sections') : ($language === 'ar' ? 'أقسام الحساب' : 'Account sections')}>
    {#each links as item}<a href={item.href} aria-current={selected(item.href, pathname) ? 'page' : undefined}>{$language === 'ar' ? item.ar : item.en}</a>{/each}
  </nav>
{/if}
<style>
  .section-navigation { display: flex; gap: 6px; width: calc(100% - 2 * var(--page-gutter)); max-width: calc(64rem - 2 * var(--page-gutter)); margin: 16px auto 0; padding-bottom: 12px; overflow-x: auto; border-bottom: 1px solid var(--border-light); scrollbar-width: thin; }
  .section-navigation.account { max-width: calc(660px - 2 * var(--page-gutter)); }
  .section-navigation.community { max-width: calc(760px - 2 * var(--page-gutter)); }
  a { display: inline-flex; flex-shrink: 0; min-height: 44px; align-items: center; padding: 10px 14px; border-radius: 10px; font-size: 14px; font-weight: 400; color: var(--text-secondary); }
  a[aria-current='page'] { background: var(--primary-light); color: var(--primary); font-weight: 500; }
  a:hover { background: var(--surface-level-1); }
</style>

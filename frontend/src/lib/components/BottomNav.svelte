<script lang="ts">
  import { page } from '$app/stores'
  import { language } from '$lib/stores/ui'
  import { primaryNavigation, navigationActive } from '$lib/navigation'
  import Icon from './Icon.svelte'
</script>
<nav class="uneem-bottom-nav fixed inset-x-0 bottom-0 z-40 lg:hidden" aria-label={$language === 'ar' ? 'التنقل الرئيسي' : 'Primary navigation'}>
  <div class="uneem-bottom-nav-inner">
    {#each primaryNavigation as item}
      <a href={item.href} aria-current={navigationActive($page.url.pathname, item.paths) ? 'page' : undefined}>
        <Icon name={item.icon} size={22} strokeWidth={1.8} /><span>{$language === 'ar' ? item.ar : item.en}</span>
      </a>
    {/each}
  </div>
</nav>
<style>
  .uneem-bottom-nav-inner { display: flex; max-width: 560px; margin-inline: auto; align-items: stretch; gap: 6px; padding-inline: 10px; }
  a { display: flex; min-width: 0; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 4px; margin-block: 6px; padding: 6px; color: var(--text-secondary); border-radius: 12px; transition: color 140ms, background 140ms; }
  a[aria-current='page'] { color: var(--primary); background: var(--primary-light); }
  span { font-size: 12px; line-height: 1.3; font-weight: 400; }
  @media (prefers-reduced-motion: reduce) { a { transition: none; } }
</style>

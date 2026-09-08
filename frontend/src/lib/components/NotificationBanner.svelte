<script lang="ts">
  import { onMount } from 'svelte'
  import { language } from '$lib/stores/ui'
  import { notifications, refreshNotifications, dismissNotification } from '$lib/stores/notifications'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'
  $: ar = $language === 'ar'
  onMount(() => { void refreshNotifications() })
</script>

<section aria-busy={$notifications.refreshing}>
  {#if $notifications.loading}
    <div class="space-y-3 animate-pulse" aria-label={ar ? 'جارٍ تحميل التحديثات' : 'Loading updates'}>
      {#each Array(3) as _}<div class="h-28 rounded-2xl bg-surface"></div>{/each}
    </div>
  {:else}
    {#if $notifications.error}
      <div class="uneem-soft-card mb-5 flex items-center gap-3" role="status">
        <Icon name="alert-circle" className="text-warning" size={22} />
        <p class="min-w-0 flex-1 text-sm text-text-secondary">{ar ? 'تعذر تحميل آخر التحديثات.' : 'Couldn’t refresh updates.'}</p>
        <Button size="sm" variant="secondary" on:click={() => refreshNotifications(true)}>{ar ? 'حاول مجدداً' : 'Retry'}</Button>
      </div>
    {/if}
    {#if $notifications.items.length}
      <div class="notification-list">
        {#each $notifications.items as item (item.id)}
          <article class="notification-item">
            <span class="notification-dot" aria-hidden="true"></span>
            <div class="min-w-0 flex-1">
              <h2 class="text-[15px] font-semibold leading-6 text-text">{ar ? item.title_ar || item.title_en : item.title_en}</h2>
              <p class="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{ar ? item.body_ar || item.body_en : item.body_en}</p>
              <time datetime={item.published_at} class="mt-3 block text-xs text-text-muted">{new Date(item.published_at).toLocaleDateString(ar ? 'ar-MA' : 'en', { month: 'short', day: 'numeric' })}</time>
            </div>
            <button type="button" class="uneem-icon-button shrink-0" on:click={() => dismissNotification(item.id)}
              aria-label={`${ar ? 'إخفاء' : 'Dismiss'}: ${ar ? item.title_ar || item.title_en : item.title_en}`}><Icon name="x" size={18} /></button>
          </article>
        {/each}
      </div>
    {:else if !$notifications.error}
      <div class="uneem-empty py-16" role="status">
        <div class="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-[22px] bg-surface text-text-muted"><Icon name="bell" size={28} /></div>
        <h2 class="text-lg font-semibold text-text">{ar ? 'لا توجد تحديثات جديدة' : 'You’re all caught up'}</h2>
        <p class="mt-2 text-sm text-text-secondary">{ar ? 'ستظهر التحديثات الجديدة هنا.' : 'New updates will appear here.'}</p>
      </div>
    {/if}
  {/if}
</section>

<style>
  .notification-list { overflow: hidden; border-radius: var(--radius-xl); background: var(--surface); }
  .notification-item { display: flex; align-items: flex-start; gap: 12px; padding-block: 20px; padding-inline: 20px 12px; }
  .notification-item + .notification-item { border-top: 1px solid var(--border-light); }
  .notification-dot { flex-shrink: 0; width: 7px; height: 7px; margin-top: 9px; border-radius: 50%; background: var(--primary); }
</style>

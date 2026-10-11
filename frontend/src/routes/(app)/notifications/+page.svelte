<script lang="ts">
  import { language } from '$lib/stores/ui'
  import { notifications, refreshNotifications } from '$lib/stores/notifications'
  import NotificationBanner from '$lib/components/NotificationBanner.svelte'
  import Icon from '$lib/components/Icon.svelte'
  $: ar = $language === 'ar'
</script>

<svelte:head><title>{ar ? 'الإشعارات' : 'Notifications'} · UNEEM</title></svelte:head>

<div class="uneem-page-narrow">
  <header class="uneem-page-header items-center">
    <h1 class="uneem-title">{ar ? 'الإشعارات' : 'Notifications'}</h1>
    <button type="button" class="uneem-icon-button bg-surface" disabled={$notifications.refreshing}
      aria-label={ar ? 'تحديث الإشعارات' : 'Refresh notifications'} on:click={() => refreshNotifications(true)}>
      <Icon name="refresh-cw" size={20} className={$notifications.refreshing ? 'animate-spin' : ''} />
    </button>
  </header>
  <NotificationBanner />
</div>

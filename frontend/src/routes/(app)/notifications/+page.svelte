<script lang="ts">
  import { _ } from 'svelte-i18n'
  import NotificationBanner from '$lib/components/NotificationBanner.svelte'
  import Card from '$lib/components/Card.svelte'
  import Icon from '$lib/components/Icon.svelte'

  let dismissedCount = 0

  function handleDismissed() {
    dismissedCount++
  }
</script>

<div class="max-w-3xl mx-auto p-4 min-h-screen">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-2xl font-medium font-serif text-text mb-1">{$_('notifications.title')}</h1>
    <p class="text-text-secondary text-sm">{$_('notifications.subtitle')}</p>
  </div>

  <!-- Notifications -->
  <NotificationBanner on:dismissed={handleDismissed} />

  <!-- Empty State (shown after all dismissed) -->
  {#if dismissedCount > 0}
    <Card variant="outlined" className="text-center py-12 mt-6">
      <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-surface-level-2 flex items-center justify-center text-text-muted">
        <Icon name="bell-off" size={28} />
      </div>
      <p class="text-text-secondary font-medium">{$_('notifications.no_active')}</p>
      <p class="text-text-muted text-sm mt-2">{$_('notifications.check_back_later')}</p>
    </Card>
  {/if}
</div>

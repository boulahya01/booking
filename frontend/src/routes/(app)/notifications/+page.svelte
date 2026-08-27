<script lang="ts">
  import { language } from '$lib/stores/ui'
  import NotificationBanner from '$lib/components/NotificationBanner.svelte'
  import Icon from '$lib/components/Icon.svelte'

  let notificationCount: number | null = null
  $: ar = $language === 'ar'

  function handleCount(event: CustomEvent<{ count: number }>) {
    notificationCount = event.detail.count
  }
</script>

<svelte:head><title>{ar ? 'الإشعارات' : 'Notifications'} · UNEEM</title></svelte:head>

<main class="uneem-page-narrow">
  <header class="uneem-page-header">
    <div>
      <p class="uneem-kicker">UNEEM</p>
      <h1 class="uneem-title">{ar ? 'الإشعارات' : 'Notifications'}</h1>
      <p class="uneem-subtitle">{ar ? 'آخر التحديثات المهمة.' : 'Important updates.'}</p>
    </div>
  </header>

  <NotificationBanner on:count={handleCount} />

  {#if notificationCount === 0}
    <section class="uneem-empty mt-4">
      <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-text-muted"><Icon name="bell-off" size={22} /></div>
      <p class="mt-3 font-bold text-text">{ar ? 'ما كاين حتى جديد' : 'You’re all caught up'}</p>
      <p class="mt-1 text-sm text-text-muted">{ar ? 'التحديثات الجديدة غادي تبان هنا.' : 'New updates will appear here.'}</p>
    </section>
  {/if}
</main>

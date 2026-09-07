<script lang="ts">
  import { language } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'

  const sections = [
    { href: '/admin/bookings', icon: 'calendar-check', en: 'Bookings', ar: 'الحجوزات' },
    { href: '/admin/pitches', icon: 'map-pin', en: 'Facilities', ar: 'المرافق' },
    { href: '/admin/users', icon: 'users', en: 'Users', ar: 'المستخدمون' },
    { href: '/admin/verification', icon: 'shield', en: 'Verification', ar: 'التحقق' },
    { href: '/admin/support', icon: 'message-circle', en: 'Support', ar: 'الدعم' },
    { href: '/admin/notifications', icon: 'bell-dot', en: 'Announcements', ar: 'الإعلانات' }
  ]
</script>

<svelte:head><title>Admin · UNEEM</title></svelte:head>

<main class="uneem-page-narrow">
  <header class="mb-6">
    <p class="uneem-kicker">UNEEM</p>
    <h1 class="uneem-title">{$language === 'ar' ? 'الإدارة' : 'Admin'}</h1>
  </header>

  <section class="uneem-panel overflow-hidden" aria-label={$language === 'ar' ? 'أقسام الإدارة' : 'Admin sections'}>
    {#each sections as item}
      <a href={item.href} class="uneem-list-row min-h-[68px] px-4 sm:px-5">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-level-1 text-text-secondary">
          <Icon name={item.icon} size={18} />
        </span>
        <span class="min-w-0 flex-1 text-[15px] font-semibold text-text">{$language === 'ar' ? item.ar : item.en}</span>
        <Icon name={$language === 'ar' ? 'chevron-left' : 'chevron-right'} size={17} className="shrink-0 text-text-muted" />
      </a>
    {/each}
  </section>
</main>

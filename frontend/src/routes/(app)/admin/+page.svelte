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

<main class="uneem-page max-w-6xl">
  <header class="mb-8">
    <h1 class="uneem-title">{$language === 'ar' ? 'الإدارة' : 'Admin'}</h1>
  </header>

  <nav class="admin-sections" aria-label={$language === 'ar' ? 'أقسام الإدارة' : 'Admin sections'}>
    {#each sections as item}
      <a href={item.href} class="admin-section">
        <span class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-level-1 text-primary"><Icon name={item.icon} size={22} /></span>
        <span class="min-w-0 flex-1 text-base font-semibold text-text">{$language === 'ar' ? item.ar : item.en}</span>
        <Icon name={$language === 'ar' ? 'chevron-left' : 'chevron-right'} size={16} className="shrink-0 text-text-muted" />
      </a>
    {/each}
  </nav>
</main>

<style>
  .admin-sections { display: grid; gap: 12px; }
  .admin-section { display: flex; min-height: 88px; align-items: center; gap: 16px; padding: 20px; border-radius: var(--radius-xl); background: var(--surface); transition: background 140ms, transform 140ms; }
  .admin-section:hover { background: var(--surface-raised); }
  .admin-section:active { transform: scale(.985); }
  @media (min-width: 640px) { .admin-sections { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; } .admin-section { min-height: 112px; padding: 24px; } }
  @media (prefers-reduced-motion: reduce) { .admin-section { transition: none; } }
</style>

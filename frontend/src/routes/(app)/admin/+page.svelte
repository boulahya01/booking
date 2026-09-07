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

<main class="uneem-page-narrow max-w-2xl">
  <header class="mb-5">
    <h1 class="uneem-title">{$language === 'ar' ? 'الإدارة' : 'Admin'}</h1>
  </header>

  <nav class="border-y border-border-light" aria-label={$language === 'ar' ? 'أقسام الإدارة' : 'Admin sections'}>
    {#each sections as item}
      <a href={item.href} class="flex min-h-[62px] items-center gap-3 border-b border-border-light px-1 text-start transition-colors last:border-0 hover:bg-surface-level-1/70">
        <Icon name={item.icon} size={19} className="shrink-0 text-text-muted" />
        <span class="min-w-0 flex-1 text-[15px] font-semibold text-text">{$language === 'ar' ? item.ar : item.en}</span>
        <Icon name={$language === 'ar' ? 'chevron-left' : 'chevron-right'} size={16} className="shrink-0 text-text-muted" />
      </a>
    {/each}
  </nav>
</main>

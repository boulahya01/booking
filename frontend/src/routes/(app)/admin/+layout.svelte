<script lang="ts">
  import { page } from '$app/stores'
  import { language } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'

  const items = [
    { href:'/admin/bookings', icon:'calendar-check', en:'Bookings', ar:'الحجوزات' },
    { href:'/admin/pitches', icon:'map-pin', en:'Facilities', ar:'المرافق' },
    { href:'/admin/users', icon:'users', en:'Users', ar:'المستخدمون' },
    { href:'/admin/verification', icon:'shield', en:'Verification', ar:'التحقق' },
    { href:'/admin/support', icon:'mail', en:'Help & reports', ar:'الدعم' },
    { href:'/admin/notifications', icon:'bell-dot', en:'Announcements', ar:'الإعلانات' }
  ]

  function active(href: string) {
    return $page.url.pathname === href || $page.url.pathname.startsWith(`${href}/`)
  }
</script>

<div class="sticky top-[60px] z-20 border-b border-border-light bg-background/95 backdrop-blur-xl">
  <nav class="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6" aria-label={$language === 'ar' ? 'إدارة UNEEM' : 'UNEEM admin'}>
    {#each items as item}
      <a
        href={item.href}
        class="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors"
        class:bg-primary-light={active(item.href)}
        class:text-primary={active(item.href)}
        class:text-text-secondary={!active(item.href)}
        aria-current={active(item.href) ? 'page' : undefined}
      >
        <Icon name={item.icon} size={16} />
        <span>{$language === 'ar' ? item.ar : item.en}</span>
      </a>
    {/each}
  </nav>
</div>

<slot />

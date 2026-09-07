<script lang="ts">
  import { page } from '$app/stores'
  import { language } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'

  const labels = [
    { path: '/admin/bookings', en: 'Bookings', ar: 'الحجوزات' },
    { path: '/admin/pitches', en: 'Facilities', ar: 'المرافق' },
    { path: '/admin/users', en: 'Users', ar: 'المستخدمون' },
    { path: '/admin/verification', en: 'Verification', ar: 'التحقق' },
    { path: '/admin/support', en: 'Support', ar: 'الدعم' },
    { path: '/admin/notifications', en: 'Announcements', ar: 'الإعلانات' }
  ]

  $: current = labels.find((item) => $page.url.pathname === item.path || $page.url.pathname.startsWith(`${item.path}/`))
  $: isIndex = $page.url.pathname === '/admin' || $page.url.pathname === '/admin/'
</script>

{#if !isIndex && current}
  <div class="mx-auto flex min-h-10 w-full max-w-7xl items-center gap-1.5 px-4 pt-2 text-xs sm:px-6">
    <a href="/admin" class="inline-flex min-h-9 items-center gap-1.5 font-semibold text-text-muted transition-colors hover:text-text">
      <Icon name={$language === 'ar' ? 'arrow-right' : 'arrow-left'} size={14} />
      <span>{$language === 'ar' ? 'الإدارة' : 'Admin'}</span>
    </a>
    <span class="text-text-muted">/</span>
    <span class="font-semibold text-text-secondary">{$language === 'ar' ? current.ar : current.en}</span>
  </div>
{/if}

<slot />

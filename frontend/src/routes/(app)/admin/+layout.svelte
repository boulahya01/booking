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
  <nav aria-label={$language === 'ar' ? 'مسار الصفحة' : 'Breadcrumb'} class="mx-auto flex w-full max-w-6xl items-center gap-2 px-[var(--page-gutter)] pt-2 text-sm">
    <a href="/admin" class="inline-flex min-h-11 items-center gap-2 rounded-xl font-medium text-text-secondary transition-colors hover:text-text">
      <Icon name={$language === 'ar' ? 'arrow-right' : 'arrow-left'} size={18} />
      <span>{$language === 'ar' ? 'الإدارة' : 'Admin'}</span>
    </a>
    <span class="text-text-muted" aria-hidden="true">/</span>
    <span class="font-medium text-text-muted" aria-current="page">{$language === 'ar' ? current.ar : current.en}</span>
  </nav>
{/if}

<slot />

<script lang="ts">
  import { authState, isAdmin } from '$lib/stores/auth'
  import { language, unreadNotifications } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import PwaInstallCard from '$lib/components/PwaInstallCard.svelte'
  import { applyPwaUpdate, pwaUpdateState } from '$lib/pwaUpdate'
  import Button from '$lib/components/Button.svelte'

  $: ar = $language === 'ar'
  $: account = $authState.account
  $: name = $authState.user?.full_name || (ar ? 'حسابي' : 'Your account')
  $: initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  $: identityLabel = account?.identity_status === 'verified' ? (ar ? 'تم التحقق' : 'Verified') : account?.identity_status === 'pending' ? (ar ? 'قيد المراجعة' : 'Under review') : (ar ? 'مطلوب' : 'Required')
  $: accountLinks = [
    { href: '/verification', icon: 'id-card', title: ar ? 'الهوية الطلابية' : 'Student verification', detail: identityLabel },
    { href: '/notifications', icon: 'bell', title: ar ? 'الإشعارات' : 'Notifications', detail: $unreadNotifications ? String($unreadNotifications) : '' },
    { href: '/settings', icon: 'settings', title: ar ? 'الإعدادات' : 'Settings', detail: ar ? 'اللغة والمظهر' : 'Language & appearance' }
  ]
  $: supportLinks = [
    { href: '/help', icon: 'message-circle', title: ar ? 'المساعدة والدعم' : 'Help & support' }
  ]
</script>

<svelte:head><title>{ar ? 'حسابي' : 'Account'} · UNEEM</title></svelte:head>

<div class="uneem-page-narrow menu-page">
  <header><h1 class="uneem-title">{ar ? 'حسابي' : 'Account'}</h1><p class="uneem-subtitle">{ar ? 'ملفك الشخصي وتفضيلاتك والمساعدة في مكان واحد.' : 'Your profile, preferences, and help in one place.'}</p></header>
  <a href="/profile" class="account-card">
    <span class="account-avatar" aria-hidden="true">{initials}</span>
    <span class="account-copy"><strong>{name}</strong><span>{ar ? 'الملف الشخصي والأمان' : 'Profile & security'}</span></span>
    <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={19} />
  </a>
  <section aria-labelledby="menu-account">
    <h2 id="menu-account">{ar ? 'إدارة الحساب' : 'Manage account'}</h2>
    <div class="menu-group">
      {#each accountLinks as item}
        <a class="menu-row" href={item.href}><span class="menu-icon"><Icon name={item.icon} size={20}/></span><span class="menu-row-label">{item.title}</span>{#if item.detail}<span class="menu-detail">{item.detail}</span>{/if}<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={17}/></a>
      {/each}
    </div>
  </section>
  <section aria-labelledby="menu-support">
    <h2 id="menu-support">{ar ? 'الدعم' : 'Support'}</h2>
    <div class="menu-group">
      {#each supportLinks as item}<a class="menu-row" href={item.href}><span class="menu-icon"><Icon name={item.icon} size={20}/></span><span class="menu-row-label">{item.title}</span><Icon name={ar ? 'chevron-left' : 'chevron-right'} size={17}/></a>{/each}
    </div>
  </section>
  {#if $isAdmin}
    <section aria-labelledby="menu-admin"><h2 id="menu-admin">{ar ? 'الإدارة' : 'Administration'}</h2><div class="menu-group"><a href="/admin" class="menu-row"><span class="menu-icon"><Icon name="shield" size={20}/></span><span class="menu-row-label">{ar ? 'لوحة الإدارة' : 'Admin workspace'}</span><Icon name={ar ? 'chevron-left' : 'chevron-right'} size={17}/></a></div></section>
  {/if}
  <PwaInstallCard alwaysVisible />
  {#if $pwaUpdateState.available}
    <Button variant="secondary" fullWidth loading={$pwaUpdateState.applying} on:click={() => void applyPwaUpdate()}><Icon name="refresh-cw" size={18}/>{ar ? 'تحديث UNEEM' : 'Update UNEEM'}</Button>
    {#if $pwaUpdateState.error}<p role="alert" class="text-sm text-danger">{ar ? 'تعذر التحديث. تحقق من اتصالك وحاول مجدداً.' : 'Couldn’t update. Check your connection and try again.'}</p>{/if}
  {/if}
  <ActionLink href="/logout" variant="secondary" fullWidth><Icon name="log-out" size={18}/>{ar ? 'تسجيل الخروج' : 'Sign out'}</ActionLink>
</div>

<style>
  .menu-page { display: flex; flex-direction: column; gap: 24px; max-width: 660px; }
  .menu-page h2 { margin: 0 4px 10px; color: var(--text-secondary); font-size: 14px; font-weight: 500; }
  .account-card { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: var(--radius-xl); background: var(--surface); }
  .account-avatar { display: grid; place-items: center; flex-shrink: 0; width: 56px; height: 56px; border-radius: 20px; background: var(--primary-light); color: var(--primary); font-size: 19px; font-weight: 500; }
  .account-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5px; overflow-wrap: anywhere; }
  .account-copy strong { font-size: 18px; font-weight: 500; letter-spacing: var(--tracking-tight); }
  .account-copy > span { font-size: 14px; color: var(--text-secondary); }
  .menu-group { overflow: hidden; border-radius: var(--radius-xl); background: var(--surface); }
  .menu-row { display: flex; min-height: 68px; align-items: center; gap: 12px; padding: 14px 18px; transition: background var(--motion-fast); }
  .menu-row:hover, .account-card:hover { background: var(--surface-raised); }
  .menu-row:active, .account-card:active { background: var(--surface-level-1); }
  .menu-icon { display: grid; flex-shrink: 0; place-items: center; width: 34px; height: 34px; border-radius: 11px; background: var(--surface-level-1); color: var(--text-secondary); }
  .menu-row-label { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; overflow-wrap: anywhere; }
  .menu-detail { max-width: 32%; color: var(--text-secondary); font-size: 13px; text-align: end; overflow-wrap: anywhere; }
  .menu-row > :global(svg), .account-card > :global(svg) { flex-shrink: 0; color: var(--text-muted); }
</style>

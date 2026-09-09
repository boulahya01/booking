<script lang="ts">
  import { authState, isAdmin } from '$lib/stores/auth'
  import { language, theme, uiState, unreadNotifications, type Theme, type Language } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import SegmentedControl from '$lib/components/SegmentedControl.svelte'
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
    { href: '/notifications', icon: 'bell', title: ar ? 'الإشعارات' : 'Notifications', detail: $unreadNotifications ? String($unreadNotifications) : '' }
  ]
  $: supportLinks = [
    { href: '/help', icon: 'message-circle', title: ar ? 'المساعدة والدعم' : 'Help & support' }
  ]
</script>

<svelte:head><title>{ar ? 'القائمة' : 'Menu'} · UNEEM</title></svelte:head>

<div class="uneem-page-narrow menu-page">
  <h1 class="uneem-title">{ar ? 'القائمة' : 'Menu'}</h1>
  <a href="/profile" class="account-card">
    <span class="account-avatar" aria-hidden="true">{initials}</span>
    <span class="account-copy"><strong>{name}</strong><span>{ar ? 'الملف الشخصي والأمان' : 'Profile & security'}</span></span>
    <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={19} />
  </a>
  <section aria-labelledby="menu-account">
    <h2 id="menu-account">{ar ? 'الحساب' : 'Account'}</h2>
    <div class="menu-group">
      {#each accountLinks as item}
        <a class="menu-row" href={item.href}><span class="menu-icon"><Icon name={item.icon} size={20}/></span><span class="menu-row-label">{item.title}</span>{#if item.detail}<span class="menu-detail">{item.detail}</span>{/if}<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={17}/></a>
      {/each}
    </div>
  </section>
  <section aria-labelledby="menu-preferences">
    <h2 id="menu-preferences">{ar ? 'التفضيلات' : 'Preferences'}</h2>
    <div class="menu-group preference-group">
      <div class="preference"><p><Icon name="sun" size={20}/>{ar ? 'المظهر' : 'Appearance'}</p><SegmentedControl ariaLabel={ar ? 'المظهر' : 'Appearance'} value={$theme} options={[{value:'light',label:ar?'فاتح':'Light'},{value:'dark',label:ar?'داكن':'Dark'},{value:'auto',label:ar?'تلقائي':'System'}]} onChange={value => uiState.setTheme(value as Theme)}/></div>
      <div class="preference"><p><Icon name="globe" size={20}/>{ar ? 'اللغة' : 'Language'}</p><SegmentedControl ariaLabel={ar ? 'اللغة' : 'Language'} value={$language} options={[{value:'en',label:'English'},{value:'ar',label:'العربية'}]} onChange={value => uiState.setLanguage(value as Language)}/></div>
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
  {#if $pwaUpdateState.available}<Button variant="secondary" fullWidth loading={$pwaUpdateState.applying} on:click={() => void applyPwaUpdate()}><Icon name="refresh-cw" size={18}/>{ar ? 'تحديث UNEEM' : 'Update UNEEM'}</Button>{/if}
  <ActionLink href="/logout" variant="secondary" fullWidth><Icon name="log-out" size={18}/>{ar ? 'تسجيل الخروج' : 'Sign out'}</ActionLink>
  <p class="menu-version">UNEEM · v2.1</p>
</div>

<style>
  .menu-page { display: flex; flex-direction: column; gap: 24px; max-width: 660px; }
  .menu-page h2 { margin: 0 4px 10px; color: var(--text-secondary); font-size: 13px; font-weight: 600; }
  .account-card { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: var(--radius-xl); background: var(--surface); }
  .account-avatar { display: grid; place-items: center; flex-shrink: 0; width: 56px; height: 56px; border-radius: 20px; background: var(--primary-light); color: var(--primary); font-size: 19px; font-weight: 650; }
  .account-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5px; overflow-wrap: anywhere; }
  .account-copy strong { font-size: 18px; font-weight: 650; letter-spacing: -.02em; }
  .account-copy > span { font-size: 13px; color: var(--text-secondary); }
  .menu-group { overflow: hidden; border-radius: var(--radius-xl); background: var(--surface); }
  .menu-row { display: flex; min-height: 68px; align-items: center; gap: 12px; padding: 14px 18px; transition: background var(--motion-fast); }
  .menu-row:hover, .account-card:hover { background: var(--surface-raised); }
  .menu-row:active, .account-card:active { background: var(--surface-level-1); }
  .menu-icon { display: grid; flex-shrink: 0; place-items: center; width: 34px; height: 34px; border-radius: 11px; background: var(--surface-level-1); color: var(--text-secondary); }
  .menu-row-label { flex: 1; min-width: 0; font-size: 15px; font-weight: 550; overflow-wrap: anywhere; }
  .menu-detail { max-width: 32%; color: var(--text-secondary); font-size: 12px; text-align: end; overflow-wrap: anywhere; }
  .menu-row > :global(svg), .account-card > :global(svg) { flex-shrink: 0; color: var(--text-muted); }
  .preference-group { display: flex; flex-direction: column; gap: 24px; padding: 20px; }
  .preference p { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 14px; font-weight: 550; }
  .preference p :global(svg) { color: var(--text-secondary); }
  .menu-version { text-align: center; color: var(--text-muted); font-size: 12px; }
</style>

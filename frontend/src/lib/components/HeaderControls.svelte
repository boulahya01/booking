<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { page } from '$app/stores'
  import { isAuthenticated, isAdmin } from '$lib/stores/auth'
  import { language, theme, uiState, unreadNotifications } from '$lib/stores/ui'
  import Icon from './Icon.svelte'
  export let showMenu = true
  export let id = 'header'
  let open: 'language' | 'menu' | null = null
  let controls: HTMLDivElement
  let trigger: HTMLButtonElement | null = null
  let systemDark = false
  let previousPathname = $page.url.pathname
  $: ar = $language === 'ar'
  $: dark = $theme === 'dark' || ($theme === 'auto' && systemDark)
  $: if ($page.url.pathname !== previousPathname) {
    previousPathname = $page.url.pathname
    close()
  }
  onMount(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => { systemDark = media.matches }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  })
  async function toggle(value: 'language' | 'menu', event: MouseEvent) {
    trigger = event.currentTarget as HTMLButtonElement
    open = open === value ? null : value
    if (open) {
      await tick()
      if (open === value) controls?.querySelector<HTMLElement>('[data-header-popover] a, [data-header-popover] button')?.focus()
    }
  }
  function close(restore = false) {
    open = null
    if (restore) trigger?.focus()
  }
  function handleKeydown(event: KeyboardEvent) {
    if (!open) return
    if (event.key === 'Escape') { event.preventDefault(); close(true); return }
    const popover = controls?.querySelector<HTMLElement>('[data-header-popover]')
    if (!popover?.contains(event.target as Node)) return
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const items = Array.from(popover.querySelectorAll<HTMLElement>('a, button'))
    const current = items.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    event.preventDefault()
    items[next]?.focus()
  }
</script>

<svelte:window on:pointerdown={(event) => { if (open && !controls?.contains(event.target as Node)) close() }} on:keydown={handleKeydown} />
<div class="header-controls" bind:this={controls} on:focusout={(event) => { if (open && !controls.contains(event.relatedTarget as Node)) close() }}>
  <button class="language-control" type="button" aria-label={ar ? 'اللغة' : 'Language'} aria-expanded={open === 'language'} aria-controls={id + '-languages'} on:click={(event) => toggle('language', event)}>
    <span>{ar ? 'العربية' : 'EN'}</span><Icon name="chevron-down" size={14} />
  </button>
  <button type="button" class="utility-control" aria-label={dark ? (ar ? 'التبديل إلى الوضع الفاتح' : 'Switch to light mode') : (ar ? 'التبديل إلى الوضع الداكن' : 'Switch to dark mode')} on:click={() => { close(); uiState.setTheme(dark ? 'light' : 'dark') }}>
    <Icon name={dark ? 'sun' : 'moon'} size={20} />
  </button>
  {#if showMenu}
    <button type="button" class="utility-control menu-trigger" aria-label={(open === 'menu' ? (ar ? 'إغلاق القائمة' : 'Close menu') : (ar ? 'فتح القائمة' : 'Open menu')) + ($unreadNotifications ? (ar ? '، إشعارات جديدة' : ', unread notifications') : '')} aria-expanded={open === 'menu'} aria-controls={id + '-menu'} on:click={(event) => toggle('menu', event)}>
      <Icon name={open === 'menu' ? 'x' : 'menu'} size={21} />
      {#if $unreadNotifications > 0}<span class="unread-dot" aria-hidden="true"></span>{/if}
    </button>
  {/if}
  {#if open === 'language'}
    <div id={id + '-languages'} data-header-popover class="header-popover language-options" role="group" aria-label={ar ? 'اختر اللغة' : 'Choose language'}>
      {#each [{ value: 'en' as const, label: 'English' }, { value: 'ar' as const, label: 'العربية' }] as option}
        <button type="button" lang={option.value} aria-pressed={$language === option.value} on:click={() => { uiState.setLanguage(option.value); close(true) }}>
          <span>{option.label}</span>{#if $language === option.value}<Icon name="check" size={16} />{/if}
        </button>
      {/each}
    </div>
  {:else if open === 'menu'}
    <nav id={id + '-menu'} data-header-popover class="header-popover" aria-label={ar ? 'روابط سريعة' : 'Quick links'}>
      {#if $isAuthenticated}
        <a href="/menu" on:click={() => close()}><Icon name="user" size={18}/>{ar ? 'حسابي' : 'Account'}</a>
        <a href="/bookings" on:click={() => close()}><Icon name="calendar-days" size={18}/>{ar ? 'نشاطي' : 'My activity'}</a>
        <a href="/notifications" on:click={() => close()}><Icon name="bell" size={18}/>{ar ? 'الإشعارات' : 'Notifications'}{#if $unreadNotifications}<span class="unread-count">{$unreadNotifications}</span>{/if}</a>
        <a href="/settings" on:click={() => close()}><Icon name="settings" size={18}/>{ar ? 'الإعدادات' : 'Settings'}</a>
      {:else}
        <a href="/login" on:click={() => close()}><Icon name="user" size={18}/>{ar ? 'تسجيل الدخول' : 'Sign in'}</a>
        <a href="/register" on:click={() => close()}><Icon name="user-check" size={18}/>{ar ? 'إنشاء حساب' : 'Create account'}</a>
      {/if}
      <a href="/help" on:click={() => close()}><Icon name="message-circle" size={18}/>{ar ? 'المساعدة والدعم' : 'Help & support'}</a>
      {#if $isAdmin}<a href="/admin" on:click={() => close()}><Icon name="shield" size={18}/>{ar ? 'الإدارة' : 'Admin workspace'}</a>{/if}
      {#if $isAuthenticated}<a href="/logout" class="sign-out" on:click={() => close()}><Icon name="log-out" size={18}/>{ar ? 'تسجيل الخروج' : 'Sign out'}</a>{/if}
    </nav>
  {/if}
</div>
<style>
  .header-controls { position: relative; display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
  .utility-control, .language-control { display: inline-flex; min-height: 44px; min-width: 44px; align-items: center; justify-content: center; gap: 5px; padding: 6px; border-radius: 10px; color: var(--text-secondary); background: transparent; transition: background 140ms, color 140ms; font-size: 14px; font-weight: 400; }
  .utility-control:hover, .language-control:hover, button[aria-expanded='true'] { background: var(--surface-level-1); color: var(--text); }
  .menu-trigger { position: relative; }
  .unread-dot { position: absolute; inset-inline-end: 7px; top: 7px; width: 6px; height: 6px; border-radius: 50%; background: var(--primary); }
  .header-popover { position: absolute; z-index: 60; inset-inline-end: 0; top: calc(100% + 8px); width: min(272px, calc(100vw - 32px)); padding: 8px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); box-shadow: var(--shadow-md); max-height: calc(100dvh - 100px); overflow-y: auto; overscroll-behavior: contain; overflow-wrap: anywhere; }
  .language-options { width: 168px; }
  .header-popover a, .header-popover button { display: flex; width: 100%; align-items: center; gap: 12px; min-height: 44px; padding: 10px 12px; border-radius: 8px; text-align: start; font-size: 15px; font-weight: 400; color: var(--text); }
  .header-popover a:hover, .header-popover button:hover { background: var(--surface-level-1); }
  .language-options button { justify-content: space-between; }
  .language-options [aria-pressed='true'] { color: var(--primary); background: var(--primary-light); }
  .unread-count { margin-inline-start: auto; color: var(--primary); font-size: 13px; }
  .header-popover .sign-out { border-top: 1px solid var(--border-light); margin-top: 6px; border-radius: 0; color: var(--text-secondary); }
  @media (prefers-reduced-motion: reduce) { .utility-control, .language-control { transition: none; } }
</style>

<script lang="ts">
  import { language, theme, uiState, type Theme, type Language } from '$lib/stores/ui'
  import SegmentedControl from '$lib/components/SegmentedControl.svelte'
  import Icon from '$lib/components/Icon.svelte'
  $: ar = $language === 'ar'
</script>

<svelte:head><title>{ar ? 'الإعدادات' : 'Settings'} · UNEEM</title></svelte:head>
<div class="uneem-page-narrow settings-page">
  <header><h1 class="uneem-title">{ar ? 'الإعدادات' : 'Settings'}</h1><p class="uneem-subtitle">{ar ? 'اجعل التطبيق مناسباً لك.' : 'Make yourself at home.'}</p></header>
  <section aria-labelledby="appearance-label">
    <h2 id="appearance-label"><Icon name="sun" size={20}/>{ar ? 'المظهر' : 'Appearance'}</h2>
    <SegmentedControl ariaLabel={ar ? 'المظهر' : 'Appearance'} value={$theme} options={[{value:'light',label:ar?'فاتح':'Light'},{value:'dark',label:ar?'داكن':'Dark'},{value:'auto',label:ar?'تلقائي':'System'}]} onChange={value => uiState.setTheme(value as Theme)}/>
  </section>
  <section aria-labelledby="language-label">
    <h2 id="language-label"><Icon name="globe" size={20}/>{ar ? 'اللغة' : 'Language'}</h2>
    <SegmentedControl ariaLabel={ar ? 'اللغة' : 'Language'} value={$language} options={[{value:'en',label:'English'},{value:'ar',label:'العربية'}]} onChange={value => uiState.setLanguage(value as Language)}/>
  </section>
  <a href="/profile" class="settings-row"><Icon name="lock" size={20}/><div><h2>{ar ? 'تسجيل الدخول والأمان' : 'Sign-in & security'}</h2><p>{ar ? 'البريد الإلكتروني وكلمة المرور وطرق الدخول.' : 'Email, password, and sign-in methods.'}</p></div><Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18}/></a>
  <p class="preference-note">{ar ? 'تُحفظ تفضيلات العرض على هذا الجهاز.' : 'Display preferences are saved on this device.'}</p>
</div>

<style>
  .settings-page { display: grid; gap: 28px; max-width: 660px; }
  section, .settings-row { padding: 22px; border: 1px solid var(--border-light); border-radius: 16px; background: var(--surface); }
  h2 { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 500; margin-bottom: 16px; }
  .settings-row { display: flex; align-items: center; gap: 14px; }
  .settings-row div { flex: 1; min-width: 0; }
  .settings-row h2 { margin-bottom: 5px; }
  .settings-row p, .preference-note { font-size: 14px; color: var(--text-secondary); }
</style>

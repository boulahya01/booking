<script lang="ts">
  import { goto } from '$app/navigation'
  import AuthShell from '$lib/components/AuthShell.svelte'
  import Button from '$lib/components/Button.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import { signOut } from '$lib/auth'
  import { authState } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'

  let retrying = false
  let signingOut = false
  $: ar = $language === 'ar'

  async function retry() {
    if (retrying) return
    retrying = true
    window.location.replace('/launch')
  }

  async function leaveAccount() {
    if (signingOut) return
    signingOut = true
    await signOut()
    authState.clear()
    await goto('/login', { replaceState: true })
  }
</script>

<svelte:head><title>{ar ? 'تعذر تحميل الحساب' : 'Account unavailable'} · UNEM Sports</title></svelte:head>

<AuthShell>
  <section class="w-full">
    <p class="text-sm font-semibold text-primary">UNEM Sports</p>
    <h1 class="auth-title mt-3">{ar ? 'تعذر تحميل حسابك' : 'We couldn’t load your account'}</h1>
    <p class="mt-3 text-[15px] leading-6 text-text-secondary">
      {ar
        ? 'تم تسجيل الدخول، لكن تعذر تحميل ملف التطبيق بأمان. أعد المحاولة قبل المتابعة.'
        : 'You are signed in, but your app profile could not be loaded safely. Retry before continuing.'}
    </p>

    <div class="mt-8 grid gap-3">
      <Button variant="primary" size="lg" fullWidth loading={retrying} disabled={retrying || signingOut} on:click={retry}>
        {ar ? 'إعادة المحاولة' : 'Try again'}
      </Button>
      <Button variant="secondary" size="lg" fullWidth loading={signingOut} disabled={retrying || signingOut} on:click={leaveAccount}>
        {ar ? 'تسجيل الخروج' : 'Sign out'}
      </Button>
    </div>
  </section>

  <div slot="footer" class="text-center">
    <ActionLink href="/help">{ar ? 'الحصول على المساعدة' : 'Get help'}</ActionLink>
  </div>
</AuthShell>

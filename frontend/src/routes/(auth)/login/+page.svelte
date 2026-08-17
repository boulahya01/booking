<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import Button from '$lib/components/Button.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { uiState, language } from '$lib/stores/ui'
  import { authState, isAuthenticated } from '$lib/stores/auth'
  import { loginWithEmail } from '$lib/auth'
  import { isValidEmail } from '$lib/utils/cn'
  import { sanitizeInput } from '$lib/validation'
  import { classifyAuthFailure, type AuthFailureKind } from '$lib/ux/authFailure'
  import { _ } from 'svelte-i18n'

  type Step = 'email' | 'password'
  let step: Step = 'email'
  let email = ''
  let password = ''
  let loading = false
  let errors: Record<string, string> = {}
  let submitError = ''
  let authFailureKind: AuthFailureKind | null = null

  $: cleanEmail = email.trim().toLowerCase()
  $: emailValid = isValidEmail(cleanEmail)
  $: registerHref = emailValid ? `/register?email=${encodeURIComponent(cleanEmail)}` : '/register'
  $: forgotHref = emailValid ? `/forgot-password?email=${encodeURIComponent(cleanEmail)}` : '/forgot-password'
  $: copy = $language === 'ar'
    ? { title:'مرحباً بعودتك', email:'البريد الإلكتروني', emailPlaceholder:'name@usmba.ac.ma', continue:'متابعة', passwordTitle:'كلمة المرور', change:'تغيير', password:'كلمة المرور', signIn:'تسجيل الدخول', forgot:'نسيت كلمة المرور؟', newHere:'جديد في UNEEM؟', create:'إنشاء حساب', help:'تحتاج مساعدة؟', invalidEmail:'أدخل بريداً إلكترونياً صحيحاً.' }
    : { title:'Welcome back', email:'Email address', emailPlaceholder:'name@usmba.ac.ma', continue:'Continue', passwordTitle:'Password', change:'Change', password:'Password', signIn:'Sign in', forgot:'Forgot password?', newHere:'New to UNEEM?', create:'Create account', help:'Need help?', invalidEmail:'Enter a valid email address.' }

  onMount(() => {
    const hintedEmail = new URLSearchParams(window.location.search).get('email')
    if (hintedEmail && isValidEmail(hintedEmail)) email = hintedEmail.trim().toLowerCase()
    if ($isAuthenticated) goto('/home')
  })

  function toggleLanguage() { uiState.setLanguage($language === 'en' ? 'ar' : 'en') }
  function continueWithEmail() {
    submitError = ''; errors = {}; email = sanitizeInput(email).trim().toLowerCase()
    if (!isValidEmail(email)) { errors.email = copy.invalidEmail; return }
    step = 'password'
  }
  function getLoginErrorMessage(kind: AuthFailureKind): string {
    if (kind === 'rate_limited') return $_('verify_email.resend_error_rate_limit')
    if (kind === 'network' || kind === 'profile_missing') return $_('register.error_support_contact')
    return $_('login.error_login_failed')
  }
  async function handleLogin() {
    errors = {}
    if (!password) { errors.password = $_('login.error_password_required'); return }
    loading = true; submitError = ''; authFailureKind = null; authState.setLoading(true)
    try {
      const result = await loginWithEmail(cleanEmail, password)
      if (result.error) { authFailureKind = classifyAuthFailure(result.error.message); submitError = getLoginErrorMessage(authFailureKind); authState.setError(submitError); return }
      const profile = result.data?.profile
      if (!profile) { authFailureKind = 'profile_missing'; submitError = getLoginErrorMessage(authFailureKind); authState.setError(submitError); return }
      authState.setUser({ id: profile.id, email: result.data.user?.email, student_id: profile.student_id, full_name: profile.full_name, role: profile.role === 'admin' ? 'admin' : 'user', status: profile.status })
      await goto('/home')
    } catch (error: any) {
      authFailureKind = classifyAuthFailure(error?.message, error?.status); submitError = getLoginErrorMessage(authFailureKind); authState.setError(submitError)
    } finally { loading = false; authState.setLoading(false) }
  }
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>
<div class="min-h-screen bg-background px-4 py-6 sm:py-10">
  <div class="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col">
    <header class="flex items-center justify-between">
      <a href="/login" class="text-lg font-bold tracking-tight text-text">UNEEM</a>
      <button on:click={toggleLanguage} class="system-secondary-action min-h-10 px-3 text-sm" aria-label="Toggle language">{$language === 'ar' ? 'EN' : 'ع'}</button>
    </header>
    <main class="flex flex-1 items-center py-8">
      <section class="w-full space-y-7">
        <h1 class="text-4xl font-semibold tracking-[-0.035em] text-text">{step === 'email' ? copy.title : copy.passwordTitle}</h1>
        {#if submitError}
          <div class="rounded-2xl bg-danger-light p-4 text-danger" role="alert">
            <div class="flex items-start gap-3">
              <Icon name="alert-circle" size={20} className="mt-0.5 flex-shrink-0" />
              <div class="min-w-0 flex-1 space-y-3">
                <p class="text-sm font-medium leading-relaxed">{submitError}</p>
                {#if authFailureKind === 'invalid_credentials'}
                  <div class="flex flex-wrap gap-4 text-sm font-semibold"><a href={forgotHref} class="underline">{copy.forgot}</a><a href={registerHref} class="underline">{copy.create}</a></div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
        {#if step === 'email'}
          <form on:submit|preventDefault={continueWithEmail} class="space-y-5">
            <TextField label={copy.email} type="email" placeholder={copy.emailPlaceholder} bind:value={email} error={errors.email} />
            <Button type="submit" variant="primary" size="lg" className="w-full">{copy.continue}</Button>
          </form>
        {:else}
          <div class="space-y-5">
            <div class="flex items-center justify-between gap-3 rounded-2xl bg-surface-level-1 px-4 py-3">
              <p class="min-w-0 truncate text-sm font-semibold text-text">{email}</p>
              <button type="button" on:click={() => { step = 'email'; password = ''; submitError = '' }} class="shrink-0 text-sm font-semibold text-primary">{copy.change}</button>
            </div>
            <form on:submit|preventDefault={handleLogin} class="space-y-5">
              <TextField label={copy.password} type="password" bind:value={password} error={errors.password} disabled={loading} />
              <Button type="submit" variant="primary" size="lg" {loading} className="w-full">{copy.signIn}</Button>
            </form>
            <div class="text-center"><a href={forgotHref} class="text-sm font-semibold text-primary hover:underline">{copy.forgot}</a></div>
          </div>
        {/if}
        <div class="text-center text-sm text-text-secondary">
          {copy.newHere}<a href={registerHref} class="ms-1 font-semibold text-text hover:text-primary">{copy.create}</a>
        </div>
      </section>
    </main>
    <footer class="pb-[max(0.25rem,env(safe-area-inset-bottom))] text-center text-sm text-text-secondary"><a href="/help" class="font-semibold text-text hover:text-primary">{copy.help}</a></footer>
  </div>
</div>

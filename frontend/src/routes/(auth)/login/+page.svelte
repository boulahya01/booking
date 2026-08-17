<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import Button from '$lib/components/Button.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import AuthShell from '$lib/components/AuthShell.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import { language } from '$lib/stores/ui'
  import { authState, isAuthenticated } from '$lib/stores/auth'
  import { loginWithEmail } from '$lib/auth'
  import { isValidEmail } from '$lib/utils/cn'
  import { sanitizeInput } from '$lib/validation'
  import { classifyAuthFailure, type AuthFailureKind } from '$lib/ux/authFailure'

  let email = ''
  let password = ''
  let loading = false
  let loginAttempted = false
  let submitError = ''
  let authFailureKind: AuthFailureKind | null = null

  $: cleanEmail = email.trim().toLowerCase()
  $: emailValid = isValidEmail(cleanEmail)
  $: emailState = email.length > 0 || loginAttempted ? (emailValid ? 'valid' : 'invalid') : 'idle'
  $: passwordError = loginAttempted && !password ? copy.passwordRequired : ''
  $: registerHref = emailValid ? `/register?email=${encodeURIComponent(cleanEmail)}` : '/register'
  $: forgotHref = emailValid ? `/forgot-password?email=${encodeURIComponent(cleanEmail)}` : '/forgot-password'

  $: copy = $language === 'ar'
    ? {
        title: 'تسجيل الدخول', email: 'البريد الإلكتروني', emailPlaceholder: 'mehdi@usmba.ac.ma', emailReady: 'البريد صحيح',
        password: 'كلمة المرور', passwordPlaceholder: 'كلمة المرور', signIn: 'دخول', forgot: 'نسيت كلمة المرور؟', create: 'إنشاء حساب', help: 'المساعدة',
        invalidEmail: 'أدخل بريداً صحيحاً.', passwordRequired: 'أدخل كلمة المرور.', invalidCredentials: 'البريد أو كلمة المرور غير صحيحة.',
        rateLimited: 'محاولات كثيرة. حاول بعد قليل.', trouble: 'تعذر تسجيل الدخول. حاول مرة أخرى أو اطلب المساعدة.'
      }
    : {
        title: 'Sign in', email: 'Email', emailPlaceholder: 'mehdi@usmba.ac.ma', emailReady: 'Valid email',
        password: 'Password', passwordPlaceholder: 'Your password', signIn: 'Sign in', forgot: 'Forgot password?', create: 'Create account', help: 'Help',
        invalidEmail: 'Enter a valid email.', passwordRequired: 'Enter your password.', invalidCredentials: 'Email or password is incorrect.',
        rateLimited: 'Too many attempts. Try again shortly.', trouble: 'Couldn’t sign in. Try again or get help.'
      }

  onMount(() => {
    const hintedEmail = new URLSearchParams(window.location.search).get('email')
    if (hintedEmail && isValidEmail(hintedEmail)) email = hintedEmail.trim().toLowerCase()
    if ($isAuthenticated) goto('/home')
  })

  function loginError(kind: AuthFailureKind): string {
    if (kind === 'invalid_credentials') return copy.invalidCredentials
    if (kind === 'rate_limited') return copy.rateLimited
    return copy.trouble
  }

  async function handleLogin() {
    loginAttempted = true
    submitError = ''
    authFailureKind = null
    email = sanitizeInput(email).trim().toLowerCase()
    if (!emailValid || !password) return

    loading = true
    authState.setLoading(true)
    try {
      const result = await loginWithEmail(email, password)
      if (result.error) {
        authFailureKind = classifyAuthFailure(result.error.message)
        submitError = loginError(authFailureKind)
        authState.setError(submitError)
        return
      }
      const profile = result.data?.profile
      if (!profile) {
        authFailureKind = 'profile_missing'
        submitError = copy.trouble
        authState.setError(submitError)
        return
      }
      authState.setUser({ id: profile.id, email: result.data.user?.email, student_id: profile.student_id, full_name: profile.full_name, role: profile.role === 'admin' ? 'admin' : 'user', status: profile.status })
      await goto('/home')
    } catch (error: any) {
      authFailureKind = classifyAuthFailure(error?.message, error?.status)
      submitError = loginError(authFailureKind)
      authState.setError(submitError)
    } finally {
      loading = false
      authState.setLoading(false)
    }
  }
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>

<AuthShell>
  <section class="w-full">
    <div class="mb-8"><h1 class="text-3xl font-semibold tracking-[-0.035em] text-text sm:text-4xl">{copy.title}</h1></div>

    {#if submitError}
      <div class="mb-5 rounded-2xl bg-danger-light p-4 text-danger" role="alert">
        <div class="flex items-start gap-3"><Icon name="alert-circle" size={20} className="mt-0.5 shrink-0" /><p class="text-sm font-medium leading-6">{submitError}</p></div>
      </div>
    {/if}

    <form on:submit|preventDefault={handleLogin} class="space-y-4">
      <TextField label={copy.email} type="email" placeholder={copy.emailPlaceholder} icon="mail" autocomplete="email" bind:value={email} validation={emailState} hint={emailState === 'invalid' ? copy.invalidEmail : ''} validHint={copy.emailReady} disabled={loading} />
      <TextField label={copy.password} type="password" placeholder={copy.passwordPlaceholder} icon="lock" autocomplete="current-password" bind:value={password} error={passwordError} disabled={loading} />
      <Button type="submit" variant="primary" size="lg" {loading} disabled={loading} className="mt-2 w-full">{copy.signIn}</Button>
    </form>

    <div class="mt-4 grid grid-cols-2 gap-3">
      <ActionLink href={registerHref} variant="secondary" size="md" icon="user">{copy.create}</ActionLink>
      <ActionLink href={forgotHref} variant="secondary" size="md" icon="key">{copy.forgot}</ActionLink>
    </div>
    <ActionLink href="/help" variant="ghost" size="md" icon="info" className="mt-3 w-full">{copy.help}</ActionLink>
  </section>
</AuthShell>

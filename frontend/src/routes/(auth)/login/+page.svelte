<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import Button from '$lib/components/Button.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import AuthShell from '$lib/components/AuthShell.svelte'
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
  let emailState: 'idle' | 'valid' | 'invalid' = 'idle'

  $: cleanEmail = email.trim().toLowerCase()
  $: emailValid = isValidEmail(cleanEmail)
  $: emailState = email.length > 0 || loginAttempted ? (emailValid ? 'valid' : 'invalid') : 'idle'
  $: passwordError = loginAttempted && !password ? copy.passwordRequired : ''
  $: registerHref = emailValid ? `/register?email=${encodeURIComponent(cleanEmail)}` : '/register'
  $: forgotHref = emailValid ? `/forgot-password?email=${encodeURIComponent(cleanEmail)}` : '/forgot-password'
  $: verifyHref = emailValid ? `/verify-email?email=${encodeURIComponent(cleanEmail)}` : '/verify-email'

  $: copy = $language === 'ar'
    ? {
        title: 'مرحباً بعودتك', subtitle: 'سجّل الدخول للمتابعة', email: 'البريد الإلكتروني', emailPlaceholder: 'name@usmba.ac.ma',
        password: 'كلمة المرور', passwordPlaceholder: 'كلمة المرور', signIn: 'تسجيل الدخول', forgot: 'نسيت كلمة المرور؟',
        newTo: 'جديد في UNEEM؟', create: 'إنشاء حساب', help: 'تحتاج مساعدة؟', invalidEmail: 'أدخل بريداً صحيحاً.',
        passwordRequired: 'أدخل كلمة المرور.', invalidCredentials: 'البريد أو كلمة المرور غير صحيحة.', rateLimited: 'محاولات كثيرة. حاول بعد قليل.',
        emailUnconfirmed: 'أكد بريدك الإلكتروني قبل تسجيل الدخول.', resendConfirmation: 'إعادة إرسال رابط التأكيد',
        trouble: 'تعذر تسجيل الدخول. حاول مرة أخرى أو اطلب المساعدة.'
      }
    : {
        title: 'Welcome back', subtitle: 'Sign in to continue', email: 'Email address', emailPlaceholder: 'name@usmba.ac.ma',
        password: 'Password', passwordPlaceholder: 'Password', signIn: 'Sign in', forgot: 'Forgot password?', newTo: 'New to UNEEM?',
        create: 'Create account', help: 'Need help?', invalidEmail: 'Enter a valid email.', passwordRequired: 'Enter your password.',
        invalidCredentials: 'Email or password is incorrect.', rateLimited: 'Too many attempts. Try again shortly.',
        emailUnconfirmed: 'Confirm your email before signing in.', resendConfirmation: 'Resend confirmation link',
        trouble: 'Couldn’t sign in. Try again or get help.'
      }

  onMount(() => {
    const hintedEmail = new URLSearchParams(window.location.search).get('email')
    if (hintedEmail && isValidEmail(hintedEmail)) email = hintedEmail.trim().toLowerCase()
    if ($isAuthenticated) {
      const account = $authState.account
      void goto(account?.role === 'admin' ? '/admin' : account?.can_use_sports ? '/home' : '/pending-approval')
    }
  })

  function loginError(kind: AuthFailureKind): string {
    if (kind === 'invalid_credentials') return copy.invalidCredentials
    if (kind === 'email_unconfirmed') return copy.emailUnconfirmed
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
      const account = result.data?.accountState
      if (!profile || !account) {
        authFailureKind = 'profile_missing'
        submitError = copy.trouble
        authState.setError(submitError)
        return
      }

      authState.setSessionContext({
        id: profile.id,
        email: result.data.user?.email,
        student_id: profile.student_id,
        full_name: profile.full_name,
        role: profile.role === 'admin' ? 'admin' : 'user',
        status: profile.status
      }, account)

      const nextPath = account.role === 'admin' ? '/admin' : account.can_use_sports ? '/home' : '/pending-approval'
      await goto(nextPath)
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
    <div class="mb-9 text-center">
      <h1 class="text-[32px] font-semibold tracking-[-0.035em] text-text">{copy.title}</h1>
      <p class="mt-2 text-[15px] text-text-secondary">{copy.subtitle}</p>
    </div>

    {#if submitError}
      <div class="mb-5 rounded-[18px] bg-danger-light p-4 text-danger" role="alert">
        <div class="flex items-start gap-3"><Icon name="alert-circle" size={19} className="mt-0.5 shrink-0" /><p class="text-sm font-medium leading-6">{submitError}</p></div>
        {#if authFailureKind === 'email_unconfirmed'}
          <a href={verifyHref} class="mt-3 inline-flex min-h-10 items-center font-semibold text-primary hover:text-primary-hover">{copy.resendConfirmation}</a>
        {/if}
      </div>
    {/if}

    <form on:submit|preventDefault={handleLogin} class="space-y-4">
      <TextField ariaLabel={copy.email} type="email" placeholder={copy.emailPlaceholder} icon="mail" autocomplete="email" bind:value={email} validation={emailState} hint={emailState === 'invalid' ? copy.invalidEmail : ''} disabled={loading} />
      <TextField ariaLabel={copy.password} type="password" placeholder={copy.passwordPlaceholder} icon="lock" autocomplete="current-password" bind:value={password} error={passwordError} disabled={loading} />

      <div class="flex justify-end pt-0.5"><a href={forgotHref} class="text-sm font-medium text-primary transition-colors hover:text-primary-hover">{copy.forgot}</a></div>

      <Button type="submit" variant="primary" size="lg" {loading} disabled={loading} className="mt-2 w-full">{copy.signIn}</Button>
    </form>

    <p class="mt-7 text-center text-sm text-text-secondary">
      {copy.newTo}<a href={registerHref} class="ms-1 font-semibold text-primary transition-colors hover:text-primary-hover">{copy.create}</a>
    </p>
  </section>

  <div slot="footer" class="text-center">
    <a href="/help" class="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm text-text-muted transition-colors hover:text-text">
      <Icon name="info" size={17} /><span>{copy.help}</span>
    </a>
  </div>
</AuthShell>
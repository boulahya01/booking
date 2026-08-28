<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { resetPasswordForEmail } from '$lib/auth'
  import { language } from '$lib/stores/ui'
  import { isValidEmail } from '$lib/utils/cn'
  import { authRetryAfterSeconds, classifyAuthFailure } from '$lib/ux/authFailure'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import AuthShell from '$lib/components/AuthShell.svelte'
  import Icon from '$lib/components/Icon.svelte'

  type FieldState = 'idle' | 'valid' | 'invalid'

  let email = ''
  let error = ''
  let loading = false
  let emailSent = false
  let attempted = false
  let retrySeconds = 0
  let retryTimer: ReturnType<typeof setInterval> | null = null

  $: copy = $language === 'ar'
    ? {
        title: 'نسيت كلمة المرور؟', subtitle: 'أدخل بريدك وسنرسل رابطاً جديداً.', email: 'البريد الإلكتروني', placeholder: 'mehdi@usmba.ac.ma',
        send: 'إرسال رابط الاسترجاع', sentTitle: 'تحقق من بريدك', sentBody: 'إذا كان البريد مرتبطاً بحساب، ستصلك التعليمات بعد قليل.',
        another: 'استخدام بريد آخر', invalid: 'أدخل بريداً صحيحاً.', generic: 'تعذر إرسال الطلب. حاول بعد قليل.', rateLimited: 'طلبات كثيرة الآن. حاول مجدداً بعد', signIn: 'العودة لتسجيل الدخول', help: 'تحتاج مساعدة؟'
      }
    : {
        title: 'Forgot password?', subtitle: 'Enter your email to reset your password.', email: 'Email address', placeholder: 'mehdi@usmba.ac.ma',
        send: 'Send reset link', sentTitle: 'Check your email', sentBody: 'If the email is linked to an account, recovery instructions will arrive shortly.',
        another: 'Use another email', invalid: 'Enter a valid email.', generic: 'Couldn’t send the request. Try again shortly.', rateLimited: 'Too many recovery requests. Try again in', signIn: 'Back to sign in', help: 'Need help?'
      }

  $: normalizedEmail = email.trim().toLowerCase()
  $: emailValid = isValidEmail(normalizedEmail)
  $: emailState = fieldState(email.length > 0 || attempted, emailValid)
  $: emailHint = emailState === 'invalid' ? copy.invalid : ''
  $: loginHref = emailValid ? `/login?email=${encodeURIComponent(normalizedEmail)}` : '/login'
  $: retryLabel = retrySeconds > 0 ? formatCountdown(retrySeconds) : ''

  function fieldState(active: boolean, valid: boolean): FieldState {
    if (!active) return 'idle'
    return valid ? 'valid' : 'invalid'
  }

  function formatCountdown(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  function clearRetryTimer() {
    if (retryTimer) {
      clearInterval(retryTimer)
      retryTimer = null
    }
  }

  function startRetryCooldown(rawMessage: string) {
    clearRetryTimer()
    retrySeconds = authRetryAfterSeconds(rawMessage) ?? 60
    error = `${copy.rateLimited} ${formatCountdown(retrySeconds)}.`

    retryTimer = setInterval(() => {
      retrySeconds = Math.max(0, retrySeconds - 1)
      if (retrySeconds === 0) {
        clearRetryTimer()
        error = ''
        return
      }
      error = `${copy.rateLimited} ${formatCountdown(retrySeconds)}.`
    }, 1000)
  }

  onMount(() => {
    const hintedEmail = new URLSearchParams(window.location.search).get('email')?.trim().toLowerCase() || ''
    if (isValidEmail(hintedEmail)) email = hintedEmail
  })

  onDestroy(clearRetryTimer)

  async function handleSubmit() {
    error = ''
    attempted = true
    if (!emailValid || retrySeconds > 0) return

    loading = true
    try {
      const result = await resetPasswordForEmail(normalizedEmail)
      if (result.error) {
        const kind = classifyAuthFailure(result.error.message)
        if (kind === 'rate_limited') {
          startRetryCooldown(result.error.message)
        } else {
          error = copy.generic
        }
        return
      }

      // Supabase's successful recovery response is intentionally treated as
      // non-enumerating; we never reveal whether the address exists.
      emailSent = true
    } catch {
      error = copy.generic
    } finally {
      loading = false
    }
  }

  function startAgain() {
    emailSent = false
    error = ''
    attempted = false
  }
</script>

<svelte:head><title>{emailSent ? copy.sentTitle : copy.title} · UNEEM</title></svelte:head>

<AuthShell backHref={loginHref} backLabel={copy.signIn}>
  <section class="w-full">
    <div class="mb-9 text-center">
      <h1 class="text-[30px] font-semibold tracking-[-0.035em] text-text">{emailSent ? copy.sentTitle : copy.title}</h1>
      <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">{emailSent ? copy.sentBody : copy.subtitle}</p>
    </div>

    {#if error}
      <div class="mb-5 rounded-[18px] bg-danger-light p-4 text-sm font-medium leading-6 text-danger" role="alert" aria-live="polite">{error}</div>
    {/if}

    {#if emailSent}
      <div class="space-y-5">
        <div class="rounded-[18px] border border-border bg-surface px-4 py-4 text-center">
          <div class="mb-2 flex justify-center text-primary"><Icon name="mail" size={20} /></div>
          <p class="break-all text-sm font-semibold text-text">{normalizedEmail}</p>
        </div>
        <button type="button" on:click={startAgain} class="mx-auto block min-h-11 px-3 text-sm font-medium text-text-secondary transition-colors hover:text-text">{copy.another}</button>
      </div>
    {:else}
      <form on:submit|preventDefault={handleSubmit} class="space-y-5">
        <TextField ariaLabel={copy.email} type="email" placeholder={copy.placeholder} icon="mail" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck={false} maxlength={254} bind:value={email} validation={emailState} hint={emailHint} disabled={loading || retrySeconds > 0} />
        <Button type="submit" variant="primary" size="lg" {loading} disabled={loading || retrySeconds > 0} className="w-full">
          {retrySeconds > 0 ? `${copy.send} · ${retryLabel}` : copy.send}
        </Button>
      </form>
    {/if}

    <div class="mt-6 text-center">
      <a href={loginHref} class="inline-flex min-h-11 items-center justify-center px-3 text-sm font-medium text-text-secondary transition-colors hover:text-text">{copy.signIn}</a>
    </div>
  </section>

  <div slot="footer" class="text-center">
    <a href="/help" class="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm text-text-muted transition-colors hover:text-text"><Icon name="info" size={17} /><span>{copy.help}</span></a>
  </div>
</AuthShell>

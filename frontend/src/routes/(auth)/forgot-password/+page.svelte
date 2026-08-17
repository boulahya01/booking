<script lang="ts">
  import { onMount } from 'svelte'
  import { resetPasswordForEmail } from '$lib/auth'
  import { language } from '$lib/stores/ui'
  import { isValidEmail } from '$lib/utils/cn'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import AuthShell from '$lib/components/AuthShell.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import Icon from '$lib/components/Icon.svelte'

  type FieldState = 'idle' | 'valid' | 'invalid'

  let email = ''
  let error = ''
  let loading = false
  let emailSent = false
  let attempted = false

  $: copy = $language === 'ar'
    ? {
        title: 'استرجاع الحساب',
        subtitle: 'أدخل بريد حساب UNEEM وسنرسل رابط الاسترجاع.',
        email: 'البريد الإلكتروني',
        placeholder: 'mehdi@usmba.ac.ma',
        valid: 'البريد جاهز',
        send: 'إرسال رابط الاسترجاع',
        sentTitle: 'تحقق من بريدك',
        sentBody: 'إذا كان البريد مرتبطاً بحساب، فستصلك تعليمات الاسترجاع بعد قليل.',
        another: 'استخدام بريد آخر',
        invalid: 'أدخل بريداً صحيحاً.',
        generic: 'تعذر إرسال الطلب الآن. حاول بعد قليل.',
        signIn: 'تسجيل الدخول',
        help: 'المساعدة'
      }
    : {
        title: 'Recover account',
        subtitle: 'Enter your UNEEM email and we’ll send a recovery link.',
        email: 'Email',
        placeholder: 'mehdi@usmba.ac.ma',
        valid: 'Email looks good',
        send: 'Send recovery link',
        sentTitle: 'Check your email',
        sentBody: 'If the email is connected to an account, recovery instructions will arrive shortly.',
        another: 'Use another email',
        invalid: 'Enter a valid email.',
        generic: 'Couldn’t send the request. Try again shortly.',
        signIn: 'Sign in',
        help: 'Help'
      }

  $: normalizedEmail = email.trim().toLowerCase()
  $: emailValid = isValidEmail(normalizedEmail)
  $: emailState = fieldState(email.length > 0 || attempted, emailValid)
  $: emailHint = emailState === 'invalid' ? copy.invalid : ''
  $: loginHref = emailValid ? `/login?email=${encodeURIComponent(normalizedEmail)}` : '/login'

  function fieldState(active: boolean, valid: boolean): FieldState {
    if (!active) return 'idle'
    return valid ? 'valid' : 'invalid'
  }

  onMount(() => {
    const hintedEmail = new URLSearchParams(window.location.search).get('email')?.trim().toLowerCase() || ''
    if (isValidEmail(hintedEmail)) email = hintedEmail
  })

  async function handleSubmit() {
    error = ''
    attempted = true
    if (!emailValid) return

    loading = true
    try {
      const result = await resetPasswordForEmail(normalizedEmail)
      if (result.error) {
        const lower = result.error.message.toLowerCase()
        if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection')) {
          error = copy.generic
          return
        }
      }
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

<svelte:head>
  <title>{emailSent ? copy.sentTitle : copy.title} · UNEEM</title>
</svelte:head>

<AuthShell backHref={loginHref} backLabel={copy.signIn}>
  <section class="w-full">
    <div class="mb-7">
      <div class={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${emailSent ? 'bg-success-light text-success' : 'bg-primary-light text-primary'}`}>
        <Icon name={emailSent ? 'check' : 'key'} size={20} />
      </div>
      <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text sm:text-4xl">{emailSent ? copy.sentTitle : copy.title}</h1>
      <p class="mt-2 max-w-sm text-sm leading-6 text-text-secondary">{emailSent ? copy.sentBody : copy.subtitle}</p>
    </div>

    {#if error}
      <div class="mb-4 rounded-2xl bg-danger-light p-4 text-sm font-medium leading-6 text-danger" role="alert">{error}</div>
    {/if}

    {#if emailSent}
      <div class="space-y-4">
        <div class="rounded-2xl bg-surface-level-1 px-4 py-3.5">
          <p class="text-xs font-medium text-text-muted">{copy.email}</p>
          <p class="mt-1 break-all text-sm font-semibold text-text">{normalizedEmail}</p>
        </div>
        <Button on:click={startAgain} variant="secondary" size="lg" className="w-full">{copy.another}</Button>
      </div>
    {:else}
      <form on:submit|preventDefault={handleSubmit} class="space-y-5">
        <TextField label={copy.email} type="email" placeholder={copy.placeholder} icon="mail" autocomplete="email" bind:value={email} validation={emailState} hint={emailHint} validHint={copy.valid} disabled={loading} />
        <Button type="submit" variant="primary" size="lg" {loading} className="w-full">{copy.send}</Button>
      </form>
    {/if}

    <div class="mt-4 grid grid-cols-2 gap-3">
      <ActionLink href={loginHref} variant="secondary" size="md" icon="arrow-left">{copy.signIn}</ActionLink>
      <ActionLink href="/help" variant="secondary" size="md" icon="info">{copy.help}</ActionLink>
    </div>
  </section>
</AuthShell>

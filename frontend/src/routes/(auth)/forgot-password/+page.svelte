<script lang="ts">
  import { onMount } from 'svelte'
  import { resetPasswordForEmail } from '$lib/auth'
  import { uiState, language } from '$lib/stores/ui'
  import { isValidEmail } from '$lib/utils/cn'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'

  let email = ''
  let error = ''
  let loading = false
  let emailSent = false

  $: copy = $language === 'ar'
    ? {
        title: 'استرجاع الحساب',
        subtitle: 'أدخل البريد المرتبط بحساب UNEEM وسنرسل تعليمات الاسترجاع إذا كان الحساب موجوداً.',
        email: 'البريد الإلكتروني',
        placeholder: 'name@usmba.ac.ma',
        send: 'إرسال رابط الاسترجاع',
        sentTitle: 'تحقق من بريدك',
        sentBody: 'إذا كان هذا البريد مرتبطاً بحساب UNEEM، فستصلك رسالة الاسترجاع بعد قليل.',
        another: 'استخدام بريد آخر',
        invalid: 'أدخل بريداً إلكترونياً صحيحاً.',
        generic: 'تعذر إرسال الطلب الآن. حاول مرة أخرى بعد قليل.',
        signIn: 'العودة لتسجيل الدخول',
        help: 'المساعدة'
      }
    : {
        title: 'Recover your account',
        subtitle: 'Enter the email connected to UNEEM. If an account exists, we’ll send recovery instructions.',
        email: 'Email address',
        placeholder: 'name@usmba.ac.ma',
        send: 'Send recovery link',
        sentTitle: 'Check your email',
        sentBody: 'If this email is connected to a UNEEM account, recovery instructions will arrive shortly.',
        another: 'Use another email',
        invalid: 'Enter a valid email address.',
        generic: 'We could not send the request right now. Try again shortly.',
        signIn: 'Back to sign in',
        help: 'Help'
      }

  $: normalizedEmail = email.trim().toLowerCase()
  $: loginHref = isValidEmail(normalizedEmail)
    ? `/login?email=${encodeURIComponent(normalizedEmail)}`
    : '/login'

  onMount(() => {
    const hintedEmail = new URLSearchParams(window.location.search).get('email')?.trim().toLowerCase() || ''
    if (isValidEmail(hintedEmail)) email = hintedEmail
  })

  function toggleLanguage() {
    uiState.setLanguage($language === 'en' ? 'ar' : 'en')
  }

  async function handleSubmit() {
    error = ''
    const value = email.trim().toLowerCase()
    if (!isValidEmail(value)) {
      error = copy.invalid
      return
    }

    loading = true
    try {
      const result = await resetPasswordForEmail(value)

      // Password recovery intentionally converges on the same success state so
      // this screen never becomes an account-existence oracle. Authoritative
      // rate limiting remains a server/provider responsibility.
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
  }
</script>

<svelte:head>
  <title>{copy.title} · UNEEM</title>
</svelte:head>

<div class="min-h-screen bg-background px-4 py-8 flex items-center justify-center">
  <button
    type="button"
    on:click={toggleLanguage}
    class="fixed top-4 right-4 z-50 min-w-11 h-11 px-3 rounded-full bg-surface border border-border text-sm font-semibold text-text-secondary hover:text-text transition"
    aria-label="Toggle language"
  >
    {$language === 'ar' ? 'EN' : 'ع'}
  </button>

  <main class="w-full max-w-md">
    <section class="ui-panel p-6 sm:p-7 space-y-6">
      <div class="space-y-4">
        <div class={`w-12 h-12 rounded-2xl flex items-center justify-center ${emailSent ? 'bg-success-light text-success' : 'bg-primary/10 text-primary'}`}>
          <Icon name={emailSent ? 'check-circle' : 'key'} size={24} />
        </div>
        <div>
          <h1 class="text-3xl font-semibold tracking-tight text-text">{emailSent ? copy.sentTitle : copy.title}</h1>
          <p class="mt-2 text-text-secondary leading-relaxed">{emailSent ? copy.sentBody : copy.subtitle}</p>
        </div>
      </div>

      {#if error}
        <div class="rounded-2xl bg-danger-light p-4 text-sm text-danger" role="alert">{error}</div>
      {/if}

      {#if emailSent}
        <div class="rounded-2xl bg-surface-level-1 p-4">
          <p class="text-sm font-medium text-text break-all">{normalizedEmail}</p>
        </div>
        <Button on:click={startAgain} variant="secondary" size="lg" className="w-full">{copy.another}</Button>
      {:else}
        <form on:submit|preventDefault={handleSubmit} class="space-y-5">
          <TextField
            label={copy.email}
            type="email"
            placeholder={copy.placeholder}
            bind:value={email}
            disabled={loading}
            required
          />
          <Button type="submit" variant="primary" size="lg" {loading} className="w-full">{copy.send}</Button>
        </form>
      {/if}

      <div class="pt-1 flex items-center justify-center gap-4 text-sm font-semibold">
        <a href={loginHref} class="text-primary hover:underline">{copy.signIn}</a>
        <span class="text-border">•</span>
        <a href="/help" class="text-text-secondary hover:text-text">{copy.help}</a>
      </div>
    </section>
  </main>
</div>

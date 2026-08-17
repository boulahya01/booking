<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { supabase } from '$lib/supabaseClient'
  import { authState } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'
  import { getMyAccountState, getUserProfile } from '$lib/auth'
  import { isValidEmail } from '$lib/utils/cn'
  import Button from '$lib/components/Button.svelte'
  import AuthShell from '$lib/components/AuthShell.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import Icon from '$lib/components/Icon.svelte'

  type Status = 'waiting' | 'verifying' | 'success' | 'error'

  let status: Status = 'waiting'
  let errorMessage = ''
  let resendLoading = false
  let resendMessage = ''
  let hintedEmail = ''
  let nextPath = '/home'

  $: copy = $language === 'ar'
    ? {
        title: 'أكد بريدك',
        subtitle: 'أرسلنا رابط التأكيد إلى بريدك.',
        spam: 'لم تجد الرسالة؟ تحقق من البريد غير المرغوب فيه أو أرسل رابطاً جديداً.',
        resend: 'إرسال رابط جديد',
        sent: 'إذا كان البريد صالحاً، فسيصلك رابط جديد بعد قليل.',
        verifying: 'جاري تأكيد البريد',
        verifyingHelp: 'نؤكد الرابط ونجهز حسابك.',
        success: 'تم تأكيد البريد',
        successHelp: 'حسابك جاهز للخطوة التالية.',
        continue: 'متابعة',
        error: 'تعذر تأكيد الرابط',
        expired: 'الرابط منتهي أو غير صالح. اطلب رابطاً جديداً.',
        generic: 'تعذر تأكيد البريد الآن. حاول مرة أخرى.',
        help: 'المساعدة',
        signIn: 'تسجيل الدخول',
        rateLimit: 'طلبات كثيرة. انتظر قليلاً قبل إعادة المحاولة.'
      }
    : {
        title: 'Confirm email',
        subtitle: 'We sent a confirmation link to your email.',
        spam: 'No email yet? Check spam or request a fresh link.',
        resend: 'Send a new link',
        sent: 'If the email is eligible, a fresh link will arrive shortly.',
        verifying: 'Confirming email',
        verifyingHelp: 'We’re confirming the link and preparing your account.',
        success: 'Email confirmed',
        successHelp: 'Your account is ready for the next step.',
        continue: 'Continue',
        error: 'Link not confirmed',
        expired: 'This link is expired or invalid. Request a fresh one.',
        generic: 'Couldn’t confirm your email. Try again.',
        help: 'Help',
        signIn: 'Sign in',
        rateLimit: 'Too many requests. Wait a moment and try again.'
      }

  $: loginHref = hintedEmail ? `/login?email=${encodeURIComponent(hintedEmail)}` : '/login'

  function safeVerificationError(raw = '') {
    const value = raw.toLowerCase()
    if (value.includes('expired') || value.includes('token') || value.includes('invalid')) return copy.expired
    return copy.generic
  }

  async function restoreAuthoritativeContext() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw error || new Error('missing_session')

    const [profile, account] = await Promise.all([
      getUserProfile(user.id),
      getMyAccountState()
    ])

    if (!profile || !account) throw new Error('missing_account_state')

    authState.setSessionContext({
      id: profile.id,
      email: user.email ?? undefined,
      student_id: profile.student_id,
      full_name: profile.full_name,
      role: profile.role === 'admin' ? 'admin' : 'user',
      status: profile.status
    }, account)

    nextPath = account.can_use_sports ? '/home' : '/pending-approval'
  }

  onMount(async () => {
    const queryEmail = $page.url.searchParams.get('email')?.trim().toLowerCase() || ''
    hintedEmail = isValidEmail(queryEmail) ? queryEmail : ''

    const token = $page.url.searchParams.get('token')
    if (!token) return

    status = 'verifying'
    try {
      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'email' })
      if (error) throw error
      await restoreAuthoritativeContext()
      status = 'success'
    } catch (err: any) {
      status = 'error'
      errorMessage = safeVerificationError(err?.message)
    }
  })

  async function resendEmail() {
    resendLoading = true
    resendMessage = ''
    errorMessage = ''

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email?.trim().toLowerCase() || hintedEmail

      // Keep this response non-enumerating. Do not reveal whether the email
      // exists or whether the provider accepted a resend request.
      if (email && isValidEmail(email)) {
        const { error } = await supabase.auth.resend({ type: 'signup', email })
        if (error) {
          const lower = error.message.toLowerCase()
          if (lower.includes('rate') || lower.includes('too many')) {
            errorMessage = copy.rateLimit
            return
          }
        }
      }

      resendMessage = copy.sent
    } catch {
      resendMessage = copy.sent
    } finally {
      resendLoading = false
    }
  }
</script>

<svelte:head>
  <title>{status === 'success' ? copy.success : status === 'error' ? copy.error : copy.title} · UNEEM</title>
</svelte:head>

<AuthShell backHref={status === 'success' || status === 'verifying' ? '' : loginHref} backLabel={copy.signIn}>
  <section class="w-full" aria-live="polite">
    <div class="mb-7">
      <div class={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${status === 'error' ? 'bg-danger-light text-danger' : status === 'success' ? 'bg-success-light text-success' : 'bg-primary-light text-primary'}`}>
        {#if status === 'verifying'}
          <span class="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true"></span>
        {:else}
          <Icon name={status === 'success' ? 'check' : status === 'error' ? 'alert-circle' : 'mail'} size={20} />
        {/if}
      </div>

      <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text sm:text-4xl">
        {status === 'verifying' ? copy.verifying : status === 'success' ? copy.success : status === 'error' ? copy.error : copy.title}
      </h1>
      <p class="mt-2 max-w-sm text-sm leading-6 text-text-secondary">
        {status === 'verifying' ? copy.verifyingHelp : status === 'success' ? copy.successHelp : status === 'error' ? (errorMessage || copy.generic) : copy.subtitle}
      </p>

      {#if hintedEmail && status === 'waiting'}
        <div class="mt-4 rounded-2xl bg-surface-level-1 px-4 py-3">
          <p class="break-all text-sm font-semibold text-text">{hintedEmail}</p>
        </div>
      {/if}
    </div>

    {#if status === 'waiting'}
      <div class="mb-4 flex gap-3 rounded-2xl bg-surface-level-1 p-4">
        <Icon name="info" size={18} className="mt-0.5 shrink-0 text-primary" />
        <p class="text-sm leading-6 text-text-secondary">{copy.spam}</p>
      </div>

      {#if resendMessage}
        <div class="mb-4 rounded-2xl bg-success-light p-4 text-sm font-medium text-success" role="status">{resendMessage}</div>
      {/if}
      {#if errorMessage}
        <div class="mb-4 rounded-2xl bg-danger-light p-4 text-sm font-medium text-danger" role="alert">{errorMessage}</div>
      {/if}

      <Button on:click={resendEmail} loading={resendLoading} variant="primary" size="lg" className="w-full">
        {copy.resend}
      </Button>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <ActionLink href={loginHref} variant="secondary" size="md" icon="arrow-left">{copy.signIn}</ActionLink>
        <ActionLink href="/help" variant="secondary" size="md" icon="info">{copy.help}</ActionLink>
      </div>
    {:else if status === 'success'}
      <div class="space-y-3">
        <Button on:click={() => goto(nextPath)} variant="primary" size="lg" className="w-full">{copy.continue}</Button>
        <ActionLink href="/help" variant="secondary" size="lg" icon="info" className="w-full">{copy.help}</ActionLink>
      </div>
    {:else if status === 'error'}
      <div class="space-y-3">
        <Button on:click={resendEmail} loading={resendLoading} variant="primary" size="lg" className="w-full">{copy.resend}</Button>
        <div class="grid grid-cols-2 gap-3">
          <ActionLink href={loginHref} variant="secondary" size="md" icon="arrow-left">{copy.signIn}</ActionLink>
          <ActionLink href="/help" variant="secondary" size="md" icon="info">{copy.help}</ActionLink>
        </div>
      </div>
    {/if}
  </section>
</AuthShell>

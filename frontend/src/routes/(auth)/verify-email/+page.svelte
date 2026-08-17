<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { supabase } from '$lib/supabaseClient'
  import { authState } from '$lib/stores/auth'
  import { uiState, language } from '$lib/stores/ui'
  import { getMyAccountState, getUserProfile } from '$lib/auth'
  import { isValidEmail } from '$lib/utils/cn'
  import Button from '$lib/components/Button.svelte'
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
        title: 'أكد بريدك الإلكتروني',
        subtitle: 'أرسلنا رابط التأكيد إلى بريدك. بعد التأكيد سنفتح لك المسار المناسب تلقائياً.',
        spam: 'إذا لم تجد الرسالة، تحقق من البريد غير المرغوب فيه أو أعد إرسالها.',
        resend: 'إعادة إرسال الرابط',
        sent: 'إذا كان البريد صالحاً للتسجيل، فسيصلك رابط جديد بعد قليل.',
        verifying: 'جاري تأكيد البريد',
        verifyingHelp: 'نؤكد هويتك ونجهز حساب UNEEM.',
        success: 'تم تأكيد البريد',
        successHelp: 'حسابك جاهز. سننقلك الآن إلى الخطوة المناسبة.',
        continue: 'متابعة',
        error: 'تعذر تأكيد الرابط',
        expired: 'قد يكون الرابط منتهياً أو غير صالح. اطلب رابطاً جديداً.',
        generic: 'تعذر تأكيد البريد الآن. أعد المحاولة أو تواصل مع الدعم.',
        help: 'المساعدة',
        signIn: 'تسجيل الدخول',
        rateLimit: 'تم إرسال عدة طلبات. انتظر قليلاً قبل إعادة المحاولة.'
      }
    : {
        title: 'Confirm your email',
        subtitle: 'We sent a confirmation link to your email. After confirmation, UNEEM will take you to the right next step automatically.',
        spam: 'If you do not see it, check spam or request a fresh link.',
        resend: 'Resend confirmation',
        sent: 'If this email is eligible for registration, a fresh link will arrive shortly.',
        verifying: 'Confirming your email',
        verifyingHelp: 'We are confirming your identity and preparing your UNEEM account.',
        success: 'Email confirmed',
        successHelp: 'Your account is ready. We will continue with the correct access path.',
        continue: 'Continue',
        error: 'This link could not be confirmed',
        expired: 'The link may be expired or invalid. Request a fresh confirmation link.',
        generic: 'We could not confirm your email right now. Try again or contact Help.',
        help: 'Help',
        signIn: 'Sign in',
        rateLimit: 'Several requests were sent recently. Wait a moment before trying again.'
      }

  function toggleLanguage() {
    uiState.setLanguage($language === 'en' ? 'ar' : 'en')
  }

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

      // Keep the response non-enumerating. We do not tell the visitor whether
      // this email already exists or whether Supabase accepted it.
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
    <section class="ui-panel p-6 sm:p-7 space-y-6" aria-live="polite">
      <div class="space-y-4">
        <div class={`w-12 h-12 rounded-2xl flex items-center justify-center ${status === 'error' ? 'bg-danger-light text-danger' : status === 'success' ? 'bg-success-light text-success' : 'bg-primary/10 text-primary'}`}>
          {#if status === 'verifying'}
            <span class="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true"></span>
          {:else}
            <Icon name={status === 'success' ? 'check-circle' : status === 'error' ? 'alert-circle' : 'mail'} size={24} />
          {/if}
        </div>

        <div>
          <h1 class="text-3xl font-semibold tracking-tight text-text">
            {status === 'verifying' ? copy.verifying : status === 'success' ? copy.success : status === 'error' ? copy.error : copy.title}
          </h1>
          <p class="mt-2 text-text-secondary leading-relaxed">
            {status === 'verifying' ? copy.verifyingHelp : status === 'success' ? copy.successHelp : status === 'error' ? (errorMessage || copy.generic) : copy.subtitle}
          </p>
          {#if hintedEmail && status === 'waiting'}
            <p class="mt-2 text-sm font-medium text-text break-all">{hintedEmail}</p>
          {/if}
        </div>
      </div>

      {#if status === 'waiting'}
        <div class="rounded-2xl bg-surface-level-1 p-4 flex gap-3">
          <Icon name="info" size={18} className="text-primary flex-shrink-0 mt-0.5" />
          <p class="text-sm text-text-secondary leading-relaxed">{copy.spam}</p>
        </div>

        {#if resendMessage}
          <div class="rounded-2xl bg-success-light p-4 text-sm text-success" role="status">{resendMessage}</div>
        {/if}
        {#if errorMessage}
          <div class="rounded-2xl bg-danger-light p-4 text-sm text-danger" role="alert">{errorMessage}</div>
        {/if}

        <Button on:click={resendEmail} loading={resendLoading} variant="primary" size="lg" className="w-full">
          {copy.resend}
        </Button>
      {:else if status === 'success'}
        <Button on:click={() => goto(nextPath)} variant="primary" size="lg" className="w-full">
          {copy.continue}
        </Button>
      {:else if status === 'error'}
        <div class="space-y-3">
          <Button on:click={resendEmail} loading={resendLoading} variant="primary" size="lg" className="w-full">
            {copy.resend}
          </Button>
          <a href="/help" class="ui-action-secondary w-full min-h-12">{copy.help}</a>
        </div>
      {/if}

      {#if status !== 'verifying' && status !== 'success'}
        <div class="pt-1 text-center">
          <a href={hintedEmail ? `/login?email=${encodeURIComponent(hintedEmail)}` : '/login'} class="text-sm font-semibold text-primary hover:underline">
            {copy.signIn}
          </a>
        </div>
      {/if}
    </section>
  </main>
</div>

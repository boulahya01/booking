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
        title: 'تحقق من بريدك', subtitle: 'أرسلنا رابط التأكيد إلى بريدك.', resend: 'إرسال رابط جديد', sent: 'إذا كان البريد صالحاً، سيصلك رابط جديد بعد قليل.',
        verifying: 'جاري تأكيد البريد', verifyingHelp: 'لحظة واحدة فقط.', success: 'تم تأكيد البريد', successHelp: 'حسابك جاهز.', continue: 'متابعة',
        error: 'تعذر تأكيد الرابط', expired: 'الرابط منتهي أو غير صالح. اطلب رابطاً جديداً.', generic: 'تعذر تأكيد البريد الآن.', help: 'تحتاج مساعدة؟', signIn: 'العودة لتسجيل الدخول',
        rateLimit: 'طلبات كثيرة. انتظر قليلاً ثم حاول مجدداً.'
      }
    : {
        title: 'Check your email', subtitle: 'We sent a confirmation link to your email.', resend: 'Resend link', sent: 'If the email is eligible, a fresh link will arrive shortly.',
        verifying: 'Confirming email', verifyingHelp: 'Just a moment.', success: 'Email confirmed', successHelp: 'Your account is ready.', continue: 'Continue',
        error: 'Link not confirmed', expired: 'This link is expired or invalid. Request a fresh one.', generic: 'Couldn’t confirm your email.', help: 'Need help?', signIn: 'Back to sign in',
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

    const [profile, account] = await Promise.all([getUserProfile(user.id), getMyAccountState()])
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

<svelte:head><title>{status === 'success' ? copy.success : status === 'error' ? copy.error : copy.title} · UNEEM</title></svelte:head>

<AuthShell backHref={status === 'success' || status === 'verifying' ? '' : loginHref} backLabel={copy.signIn}>
  <section class="w-full text-center" aria-live="polite">
    <div class="mb-8">
      <div class="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
        {#if status === 'verifying'}
          <span class="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true"></span>
        {:else}
          <Icon name={status === 'success' ? 'check' : status === 'error' ? 'alert-circle' : 'mail'} size={21} />
        {/if}
      </div>

      <h1 class="text-[30px] font-semibold tracking-[-0.035em] text-text">
        {status === 'verifying' ? copy.verifying : status === 'success' ? copy.success : status === 'error' ? copy.error : copy.title}
      </h1>
      <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">
        {status === 'verifying' ? copy.verifyingHelp : status === 'success' ? copy.successHelp : status === 'error' ? (errorMessage || copy.generic) : copy.subtitle}
      </p>

      {#if hintedEmail && status === 'waiting'}
        <div class="mt-5 rounded-[18px] border border-border bg-surface px-4 py-4">
          <p class="break-all text-sm font-semibold text-text">{hintedEmail}</p>
        </div>
      {/if}
    </div>

    {#if resendMessage}
      <div class="mb-4 rounded-[18px] bg-success-light p-4 text-sm font-medium text-success" role="status">{resendMessage}</div>
    {/if}
    {#if errorMessage && status !== 'error'}
      <div class="mb-4 rounded-[18px] bg-danger-light p-4 text-sm font-medium text-danger" role="alert">{errorMessage}</div>
    {/if}

    {#if status === 'waiting'}
      <Button on:click={resendEmail} loading={resendLoading} variant="primary" size="lg" className="w-full">{copy.resend}</Button>
      <a href={loginHref} class="mt-5 inline-flex min-h-11 items-center justify-center px-3 text-sm font-medium text-text-secondary transition-colors hover:text-text">{copy.signIn}</a>
    {:else if status === 'success'}
      <Button on:click={() => goto(nextPath)} variant="primary" size="lg" className="w-full">{copy.continue}</Button>
    {:else if status === 'error'}
      <Button on:click={resendEmail} loading={resendLoading} variant="primary" size="lg" className="w-full">{copy.resend}</Button>
      <a href={loginHref} class="mt-5 inline-flex min-h-11 items-center justify-center px-3 text-sm font-medium text-text-secondary transition-colors hover:text-text">{copy.signIn}</a>
    {/if}
  </section>

  <div slot="footer" class="text-center">
    <a href="/help" class="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm text-text-muted transition-colors hover:text-text"><Icon name="info" size={17} /><span>{copy.help}</span></a>
  </div>
</AuthShell>

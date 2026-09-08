<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import { updatePasswordFromRecovery } from '$lib/auth'
  import {
    clearPasswordRecovery,
    markPasswordRecovery,
    restorePasswordRecovery
  } from '$lib/authFlow'
  import { language } from '$lib/stores/ui'
  import { isValidPassword } from '$lib/utils/cn'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import AuthShell from '$lib/components/AuthShell.svelte'
  import PasswordRequirements from '$lib/components/PasswordRequirements.svelte'
  import Icon from '$lib/components/Icon.svelte'

  type FieldState = 'idle' | 'valid' | 'invalid'
  type RecoveryState = 'checking' | 'ready' | 'invalid' | 'complete'

  let newPassword = ''
  let confirmPassword = ''
  let loading = false
  let error = ''
  let attempted = false
  let recoveryState: RecoveryState = 'checking'

  $: passwordValid = isValidPassword(newPassword) && newPassword.length <= 128
  $: confirmValid = confirmPassword.length > 0 && confirmPassword === newPassword
  $: passwordState = attempted ? fieldState(true, passwordValid) : 'idle'
  $: confirmState = confirmPassword.length > 0 || attempted ? fieldState(true, confirmValid) : 'idle'
  $: complete = recoveryState === 'complete'

  $: copy = $language === 'ar'
    ? {
        title: 'كلمة مرور جديدة', subtitle: 'اختر كلمة مرور جديدة لحسابك.', password: 'كلمة المرور الجديدة', passwordPlaceholder: 'كلمة مرور جديدة',
        confirm: 'تأكيد كلمة المرور', confirmPlaceholder: 'أعد كتابة كلمة المرور', update: 'تحديث كلمة المرور', required: 'أنشئ كلمة مرور.', mismatch: 'غير متطابقة',
        ruleLength: '8 أحرف على الأقل', ruleAlternative: 'رقم أو رمز واحد', generic: 'تعذر تحديث كلمة المرور. اطلب رابطاً جديداً وحاول مرة أخرى.',
        doneTitle: 'تم تحديث كلمة المرور', doneBody: 'تم إغلاق جلسة الاسترجاع. سجّل الدخول بكلمة المرور الجديدة.', signIn: 'تسجيل الدخول', newLink: 'طلب رابط جديد', help: 'تحتاج مساعدة؟',
        checkingTitle: 'جارٍ التحقق من رابط الاسترجاع', checkingBody: 'لحظة واحدة.', invalidTitle: 'رابط الاسترجاع غير صالح', invalidBody: 'الرابط منتهي أو غير صالح. اطلب رابطاً جديداً من صفحة نسيت كلمة المرور.'
      }
    : {
        title: 'Reset password', subtitle: 'Choose a new password for your account.', password: 'New password', passwordPlaceholder: 'New password',
        confirm: 'Confirm password', confirmPlaceholder: 'Confirm password', update: 'Update password', required: 'Create a password.', mismatch: 'Doesn’t match',
        ruleLength: '8 characters minimum', ruleAlternative: '1 number or symbol', generic: 'Couldn’t update your password. Request a fresh link and try again.',
        doneTitle: 'Password updated', doneBody: 'The recovery session is closed. Sign in with your new password.', signIn: 'Back to sign in', newLink: 'Request a new link', help: 'Need help?',
        checkingTitle: 'Checking recovery link', checkingBody: 'Just a moment.', invalidTitle: 'Recovery link not valid', invalidBody: 'This link is expired or invalid. Request a fresh link from Forgot password.'
      }

  function fieldState(active: boolean, valid: boolean): FieldState {
    if (!active) return 'idle'
    return valid ? 'valid' : 'invalid'
  }

  function redirectError(): string {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    return hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error') || ''
  }

  function stripRecoveryUrl() {
    if (typeof history !== 'undefined') history.replaceState({}, '', '/reset-password')
  }

  async function resolveRecoverySession() {
    if (redirectError()) {
      clearPasswordRecovery()
      recoveryState = 'invalid'
      return
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.user) throw sessionError || new Error('missing_recovery_session')

      if (!restorePasswordRecovery(session.user.id)) {
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      if (!restorePasswordRecovery(session.user.id)) {
        throw new Error('recovery_session_required')
      }

      recoveryState = 'ready'
      error = ''
      stripRecoveryUrl()
    } catch {
      clearPasswordRecovery()
      recoveryState = 'invalid'
    }
  }

  onMount(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        markPasswordRecovery(session)
        recoveryState = 'ready'
        error = ''
        stripRecoveryUrl()
      } else if (event === 'SIGNED_OUT' && recoveryState !== 'complete') {
        clearPasswordRecovery()
        recoveryState = 'invalid'
      }
    })

    void resolveRecoverySession()
    return () => listener.subscription.unsubscribe()
  })

  async function handleReset() {
    error = ''
    attempted = true
    if (recoveryState !== 'ready' || !passwordValid || !confirmValid) return

    loading = true
    try {
      const result = await updatePasswordFromRecovery(newPassword)
      if (result.error) {
        if (result.error.message === 'recovery_session_required') {
          recoveryState = 'invalid'
          clearPasswordRecovery()
        } else {
          error = copy.generic
        }
        return
      }

      newPassword = ''
      confirmPassword = ''
      recoveryState = 'complete'
    } catch {
      error = copy.generic
    } finally {
      loading = false
    }
  }
</script>

<svelte:head><title>{complete ? copy.doneTitle : recoveryState === 'invalid' ? copy.invalidTitle : recoveryState === 'checking' ? copy.checkingTitle : copy.title} · UNEEM</title></svelte:head>

<AuthShell backHref={complete ? '/login' : '/forgot-password'} backLabel={complete ? copy.signIn : copy.newLink}>
  <section class="w-full">
    {#if recoveryState === 'checking'}
      <div class="py-8 text-center" aria-live="polite" aria-busy="true">
        <span class="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true"></span>
        <h1 class="mt-6 auth-title">{copy.checkingTitle}</h1>
        <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">{copy.checkingBody}</p>
      </div>
    {:else if recoveryState === 'invalid'}
      <div class="text-center" aria-live="polite">
        <div class="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-light text-danger"><Icon name="alert-circle" size={21} /></div>
        <h1 class="auth-title">{copy.invalidTitle}</h1>
        <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">{copy.invalidBody}</p>
        <Button on:click={() => goto('/forgot-password')} variant="primary" size="lg" className="mt-8 w-full">{copy.newLink}</Button>
      </div>
    {:else if complete}
      <div class="text-center" aria-live="polite">
        <div class="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-success-light text-success"><Icon name="check" size={21} /></div>
        <h1 class="auth-title">{copy.doneTitle}</h1>
        <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">{copy.doneBody}</p>
        <Button on:click={() => goto('/login')} variant="primary" size="lg" className="mt-8 w-full">{copy.signIn}</Button>
      </div>
    {:else}
      <div class="mb-9 text-center">
        <h1 class="auth-title">{copy.title}</h1>
        <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">{copy.subtitle}</p>
      </div>

      {#if error}
        <div class="mb-5 rounded-[18px] bg-danger-light p-4 text-sm font-medium leading-6 text-danger" role="alert">{error}</div>
      {/if}

      <form on:submit|preventDefault={handleReset} class="space-y-4">
        <TextField label={copy.password} type="password" placeholder={copy.passwordPlaceholder} autocomplete="new-password" maxlength={128} bind:value={newPassword} validation={passwordState} hint={passwordState === 'invalid' && attempted && !newPassword.length ? copy.required : ''} disabled={loading} />

        <PasswordRequirements password={newPassword} lengthLabel={copy.ruleLength} numberOrSymbolLabel={copy.ruleAlternative} />

        <TextField label={copy.confirm} type="password" placeholder={copy.confirmPlaceholder} autocomplete="new-password" maxlength={128} bind:value={confirmPassword} validation={confirmState} hint={confirmState === 'invalid' ? copy.mismatch : ''} disabled={loading} />
        <Button type="submit" variant="primary" size="lg" {loading} className="mt-2 w-full">{copy.update}</Button>
      </form>
    {/if}
  </section>

  <div slot="footer" class="text-center">
    <a href="/help" class="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm text-text-muted transition-colors hover:text-text"><Icon name="info" size={17} /><span>{copy.help}</span></a>
  </div>
</AuthShell>

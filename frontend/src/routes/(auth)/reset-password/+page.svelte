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
  import Icon from '$lib/components/Icon.svelte'

  type FieldState = 'idle' | 'valid' | 'invalid'
  type RecoveryState = 'checking' | 'ready' | 'invalid' | 'complete'

  let newPassword = ''
  let confirmPassword = ''
  let loading = false
  let error = ''
  let attempted = false
  let recoveryState: RecoveryState = 'checking'

  $: passwordLength = newPassword.length >= 8
  $: passwordNumber = /\d/.test(newPassword)
  $: passwordSymbol = /[!@#$%^&*()\-+]/.test(newPassword)
  $: passwordValid = isValidPassword(newPassword)
  $: confirmValid = confirmPassword.length > 0 && confirmPassword === newPassword
  $: passwordState = fieldState(newPassword.length > 0 || attempted, passwordValid)
  $: confirmState = fieldState(confirmPassword.length > 0 || attempted, confirmValid)
  $: complete = recoveryState === 'complete'

  $: copy = $language === 'ar'
    ? {
        title: 'كلمة مرور جديدة', subtitle: 'اختر كلمة مرور جديدة لحسابك.', password: 'كلمة المرور الجديدة', passwordPlaceholder: 'كلمة مرور جديدة',
        confirm: 'تأكيد كلمة المرور', confirmPlaceholder: 'أعد كتابة كلمة المرور', update: 'تحديث كلمة المرور', required: 'أنشئ كلمة مرور.', mismatch: 'غير متطابقة',
        ready: 'جاهزة', match: 'متطابقة', ruleLength: '8+ أحرف', ruleNumber: 'رقم', ruleSymbol: 'رمز', generic: 'تعذر تحديث كلمة المرور. اطلب رابطاً جديداً وحاول مرة أخرى.',
        doneTitle: 'تم تحديث كلمة المرور', doneBody: 'تم إغلاق جلسة الاسترجاع. سجّل الدخول بكلمة المرور الجديدة.', signIn: 'تسجيل الدخول', newLink: 'طلب رابط جديد', help: 'تحتاج مساعدة؟',
        checkingTitle: 'جارٍ التحقق من رابط الاسترجاع', checkingBody: 'لحظة واحدة.', invalidTitle: 'رابط الاسترجاع غير صالح', invalidBody: 'الرابط منتهي أو غير صالح. اطلب رابطاً جديداً من صفحة نسيت كلمة المرور.'
      }
    : {
        title: 'Reset password', subtitle: 'Choose a new password for your account.', password: 'New password', passwordPlaceholder: 'New password',
        confirm: 'Confirm password', confirmPlaceholder: 'Confirm password', update: 'Update password', required: 'Create a password.', mismatch: 'Doesn’t match',
        ready: 'Ready', match: 'Passwords match', ruleLength: '8+ chars', ruleNumber: '1 number', ruleSymbol: '1 symbol', generic: 'Couldn’t update your password. Request a fresh link and try again.',
        doneTitle: 'Password updated', doneBody: 'The recovery session is closed. Sign in with your new password.', signIn: 'Back to sign in', newLink: 'Request a new link', help: 'Need help?',
        checkingTitle: 'Checking recovery link', checkingBody: 'Just a moment.', invalidTitle: 'Recovery link not valid', invalidBody: 'This link is expired or invalid. Request a fresh link from Forgot password.'
      }

  function fieldState(active: boolean, valid: boolean): FieldState {
    if (!active) return 'idle'
    return valid ? 'valid' : 'invalid'
  }

  function ruleClass(passed: boolean) {
    if (!newPassword.length) return 'text-text-muted'
    return passed ? 'text-success' : 'text-danger'
  }

  function recoveryMarkerPresent(): boolean {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    return hash.get('type') === 'recovery' || query.get('type') === 'recovery'
  }

  function redirectError(): string {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    return hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error') || ''
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

      // The global auth listener records PASSWORD_RECOVERY. The URL marker is a
      // safe fallback for the initial redirect in case the event fired before
      // this route subscribed; the session itself still has to be valid.
      if (recoveryMarkerPresent()) markPasswordRecovery(session)

      if (!restorePasswordRecovery(session.user.id)) {
        throw new Error('recovery_session_required')
      }

      recoveryState = 'ready'
      error = ''
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
        <h1 class="mt-6 text-[30px] font-semibold tracking-[-0.035em] text-text">{copy.checkingTitle}</h1>
        <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">{copy.checkingBody}</p>
      </div>
    {:else if recoveryState === 'invalid'}
      <div class="text-center" aria-live="polite">
        <div class="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-light text-danger"><Icon name="alert-circle" size={21} /></div>
        <h1 class="text-[30px] font-semibold tracking-[-0.035em] text-text">{copy.invalidTitle}</h1>
        <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">{copy.invalidBody}</p>
        <Button on:click={() => goto('/forgot-password')} variant="primary" size="lg" className="mt-8 w-full">{copy.newLink}</Button>
      </div>
    {:else if complete}
      <div class="text-center" aria-live="polite">
        <div class="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-success-light text-success"><Icon name="check" size={21} /></div>
        <h1 class="text-[30px] font-semibold tracking-[-0.035em] text-text">{copy.doneTitle}</h1>
        <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">{copy.doneBody}</p>
        <Button on:click={() => goto('/login')} variant="primary" size="lg" className="mt-8 w-full">{copy.signIn}</Button>
      </div>
    {:else}
      <div class="mb-9 text-center">
        <h1 class="text-[30px] font-semibold tracking-[-0.035em] text-text">{copy.title}</h1>
        <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">{copy.subtitle}</p>
      </div>

      {#if error}
        <div class="mb-5 rounded-[18px] bg-danger-light p-4 text-sm font-medium leading-6 text-danger" role="alert">{error}</div>
      {/if}

      <form on:submit|preventDefault={handleReset} class="space-y-4">
        <TextField ariaLabel={copy.password} type="password" placeholder={copy.passwordPlaceholder} icon="lock" autocomplete="new-password" bind:value={newPassword} validation={passwordState} hint={passwordState === 'invalid' && attempted && !newPassword.length ? copy.required : ''} validHint={copy.ready} disabled={loading} />

        <div class="grid grid-cols-3 gap-2 rounded-[16px] bg-surface-level-1 px-3 py-3" aria-live="polite">
          {#each [{ label: copy.ruleLength, passed: passwordLength }, { label: copy.ruleNumber, passed: passwordNumber }, { label: copy.ruleSymbol, passed: passwordSymbol }] as rule}
            <div class={`flex items-center justify-center gap-1.5 text-xs font-medium ${ruleClass(rule.passed)}`}>
              <Icon name={rule.passed ? 'check' : 'x'} size={12} /><span>{rule.label}</span>
            </div>
          {/each}
        </div>

        <TextField ariaLabel={copy.confirm} type="password" placeholder={copy.confirmPlaceholder} icon="lock" autocomplete="new-password" bind:value={confirmPassword} validation={confirmState} hint={confirmState === 'invalid' ? copy.mismatch : ''} validHint={copy.match} disabled={loading} />
        <Button type="submit" variant="primary" size="lg" {loading} className="mt-2 w-full">{copy.update}</Button>
      </form>
    {/if}
  </section>

  <div slot="footer" class="text-center">
    <a href="/help" class="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm text-text-muted transition-colors hover:text-text"><Icon name="info" size={17} /><span>{copy.help}</span></a>
  </div>
</AuthShell>

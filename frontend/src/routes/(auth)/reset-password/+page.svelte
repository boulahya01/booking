<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { signOut, updatePassword } from '$lib/auth'
  import { clearAuthFlowUrl, completeAuthFlow, hasRecoveryEvidence } from '$lib/authFlow'
  import { language } from '$lib/stores/ui'
  import { isValidPassword } from '$lib/utils/cn'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import AuthShell from '$lib/components/AuthShell.svelte'
  import Icon from '$lib/components/Icon.svelte'

  type FieldState = 'idle' | 'valid' | 'invalid'
  type RecoveryState = 'checking' | 'ready' | 'invalid'

  let newPassword = ''
  let confirmPassword = ''
  let loading = false
  let error = ''
  let complete = false
  let attempted = false
  let recoveryState: RecoveryState = 'checking'

  $: passwordLength = newPassword.length >= 8
  $: passwordNumber = /\d/.test(newPassword)
  $: passwordSymbol = /[!@#$%^&*()\-+]/.test(newPassword)
  $: passwordValid = isValidPassword(newPassword)
  $: confirmValid = confirmPassword.length > 0 && confirmPassword === newPassword
  $: passwordState = fieldState(newPassword.length > 0 || attempted, passwordValid)
  $: confirmState = fieldState(confirmPassword.length > 0 || attempted, confirmValid)

  $: copy = $language === 'ar'
    ? {
        title: 'كلمة مرور جديدة', subtitle: 'اختر كلمة مرور جديدة لحسابك.', checking: 'جاري التحقق من رابط الاسترجاع…', invalidLinkTitle: 'رابط الاسترجاع غير صالح',
        invalidLinkBody: 'الرابط منتهي أو غير صالح. اطلب رابطاً جديداً للمتابعة.', password: 'كلمة المرور الجديدة', passwordPlaceholder: 'كلمة مرور جديدة',
        confirm: 'تأكيد كلمة المرور', confirmPlaceholder: 'أعد كتابة كلمة المرور', update: 'تحديث كلمة المرور', required: 'أنشئ كلمة مرور.', mismatch: 'غير متطابقة',
        ready: 'جاهزة', match: 'متطابقة', ruleLength: '8+ أحرف', ruleNumber: 'رقم', ruleSymbol: 'رمز', generic: 'تعذر تحديث كلمة المرور. اطلب رابطاً جديداً وحاول مرة أخرى.',
        doneTitle: 'تم تحديث كلمة المرور', doneBody: 'تم إنهاء جلسة الاسترجاع. سجّل الدخول بكلمة المرور الجديدة.', signIn: 'تسجيل الدخول', newLink: 'طلب رابط جديد', help: 'تحتاج مساعدة؟'
      }
    : {
        title: 'Reset password', subtitle: 'Choose a new password for your account.', checking: 'Checking your recovery link…', invalidLinkTitle: 'Recovery link not valid',
        invalidLinkBody: 'This recovery link is expired or invalid. Request a fresh link to continue.', password: 'New password', passwordPlaceholder: 'New password',
        confirm: 'Confirm password', confirmPlaceholder: 'Confirm password', update: 'Update password', required: 'Create a password.', mismatch: 'Doesn’t match',
        ready: 'Ready', match: 'Passwords match', ruleLength: '8+ chars', ruleNumber: '1 number', ruleSymbol: '1 symbol', generic: 'Couldn’t update your password. Request a fresh link and try again.',
        doneTitle: 'Password updated', doneBody: 'The recovery session is closed. Sign in with your new password.', signIn: 'Back to sign in', newLink: 'Request a new link', help: 'Need help?'
      }

  function fieldState(active: boolean, valid: boolean): FieldState {
    if (!active) return 'idle'
    return valid ? 'valid' : 'invalid'
  }

  function ruleClass(passed: boolean) {
    if (!newPassword.length) return 'text-text-muted'
    return passed ? 'text-success' : 'text-danger'
  }

  onMount(async () => {
    const url = new URL(window.location.href)
    const evidence = hasRecoveryEvidence(url)
    const rememberedRecovery = sessionStorage.getItem('uneem_password_recovery') === '1'

    try {
      const result = await completeAuthFlow(url, 'recovery')
      const validHandledRecovery = result.handled && evidence && !!result.session && !result.error
      const validRememberedRecovery = !result.handled && rememberedRecovery && !!result.session && !result.error

      if (!validHandledRecovery && !validRememberedRecovery) {
        recoveryState = 'invalid'
        sessionStorage.removeItem('uneem_password_recovery')
        return
      }

      sessionStorage.setItem('uneem_password_recovery', '1')
      if (result.handled) clearAuthFlowUrl(url)
      recoveryState = 'ready'
    } catch {
      sessionStorage.removeItem('uneem_password_recovery')
      recoveryState = 'invalid'
    }
  })

  async function handleReset() {
    error = ''
    attempted = true
    if (recoveryState !== 'ready' || !passwordValid || !confirmValid) return

    loading = true
    try {
      const result = await updatePassword(newPassword)
      if (result.error) {
        error = copy.generic
        return
      }

      sessionStorage.removeItem('uneem_password_recovery')
      await signOut()
      complete = true
    } catch {
      error = copy.generic
    } finally {
      loading = false
    }
  }
</script>

<svelte:head><title>{complete ? copy.doneTitle : recoveryState === 'invalid' ? copy.invalidLinkTitle : copy.title} · UNEEM</title></svelte:head>

<AuthShell backHref={complete ? '/login' : '/forgot-password'} backLabel={complete ? copy.signIn : copy.newLink}>
  <section class="w-full">
    <div class="mb-9 text-center">
      <h1 class="text-[30px] font-semibold tracking-[-0.035em] text-text">
        {complete ? copy.doneTitle : recoveryState === 'invalid' ? copy.invalidLinkTitle : copy.title}
      </h1>
      <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">
        {complete ? copy.doneBody : recoveryState === 'checking' ? copy.checking : recoveryState === 'invalid' ? copy.invalidLinkBody : copy.subtitle}
      </p>
    </div>

    {#if error}
      <div class="mb-5 rounded-[18px] bg-danger-light p-4 text-sm font-medium leading-6 text-danger" role="alert">{error}</div>
    {/if}

    {#if complete}
      <Button on:click={() => goto('/login')} variant="primary" size="lg" className="w-full">{copy.signIn}</Button>
    {:else if recoveryState === 'checking'}
      <div class="flex justify-center py-8" aria-busy="true"><span class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></span></div>
    {:else if recoveryState === 'invalid'}
      <Button on:click={() => goto('/forgot-password')} variant="primary" size="lg" className="w-full">{copy.newLink}</Button>
    {:else}
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

      <div class="mt-6 text-center">
        <a href="/forgot-password" class="inline-flex min-h-11 items-center justify-center px-3 text-sm font-medium text-text-secondary transition-colors hover:text-text">{copy.newLink}</a>
      </div>
    {/if}
  </section>

  <div slot="footer" class="text-center">
    <a href="/help" class="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm text-text-muted transition-colors hover:text-text"><Icon name="info" size={17} /><span>{copy.help}</span></a>
  </div>
</AuthShell>

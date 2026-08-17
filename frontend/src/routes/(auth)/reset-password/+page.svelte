<script lang="ts">
  import { goto } from '$app/navigation'
  import { updatePassword } from '$lib/auth'
  import { language } from '$lib/stores/ui'
  import { isValidPassword } from '$lib/utils/cn'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import AuthShell from '$lib/components/AuthShell.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import Icon from '$lib/components/Icon.svelte'

  type FieldState = 'idle' | 'valid' | 'invalid'

  let newPassword = ''
  let confirmPassword = ''
  let loading = false
  let error = ''
  let complete = false
  let attempted = false

  $: passwordLength = newPassword.length >= 8
  $: passwordNumber = /\d/.test(newPassword)
  $: passwordSymbol = /[!@#$%^&*()\-+]/.test(newPassword)
  $: passwordValid = isValidPassword(newPassword)
  $: confirmValid = confirmPassword.length > 0 && confirmPassword === newPassword
  $: passwordState = fieldState(newPassword.length > 0 || attempted, passwordValid)
  $: confirmState = fieldState(confirmPassword.length > 0 || attempted, confirmValid)

  $: copy = $language === 'ar'
    ? {
        title: 'كلمة مرور جديدة',
        subtitle: 'اختر كلمة مرور جديدة لحسابك.',
        password: 'كلمة المرور الجديدة',
        passwordPlaceholder: '8 أحرف أو أكثر',
        confirm: 'تأكيد كلمة المرور',
        confirmPlaceholder: 'أعد كتابة كلمة المرور',
        update: 'تحديث كلمة المرور',
        required: 'أنشئ كلمة مرور.',
        mismatch: 'غير متطابقة',
        ready: 'جاهزة',
        match: 'متطابقة',
        ruleLength: '8+ أحرف',
        ruleNumber: 'رقم',
        ruleSymbol: 'رمز',
        generic: 'تعذر تحديث كلمة المرور. اطلب رابطاً جديداً وحاول مرة أخرى.',
        doneTitle: 'تم تحديث كلمة المرور',
        doneBody: 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
        signIn: 'تسجيل الدخول',
        newLink: 'رابط جديد',
        support: 'المساعدة'
      }
    : {
        title: 'New password',
        subtitle: 'Choose a new password for your account.',
        password: 'New password',
        passwordPlaceholder: '8+ characters',
        confirm: 'Confirm password',
        confirmPlaceholder: 'Repeat password',
        update: 'Update password',
        required: 'Create a password.',
        mismatch: 'Doesn’t match',
        ready: 'Ready',
        match: 'Passwords match',
        ruleLength: '8+ chars',
        ruleNumber: '1 number',
        ruleSymbol: '1 symbol',
        generic: 'Couldn’t update your password. Request a fresh link and try again.',
        doneTitle: 'Password updated',
        doneBody: 'You can now sign in with your new password.',
        signIn: 'Sign in',
        newLink: 'New recovery link',
        support: 'Help'
      }

  function fieldState(active: boolean, valid: boolean): FieldState {
    if (!active) return 'idle'
    return valid ? 'valid' : 'invalid'
  }

  function ruleClass(passed: boolean) {
    if (!newPassword.length) return 'text-text-muted'
    return passed ? 'text-success' : 'text-danger'
  }

  async function handleReset() {
    error = ''
    attempted = true
    if (!passwordValid || !confirmValid) return

    loading = true
    try {
      const result = await updatePassword(newPassword)
      if (result.error) {
        error = copy.generic
        return
      }
      complete = true
    } catch {
      error = copy.generic
    } finally {
      loading = false
    }
  }
</script>

<svelte:head>
  <title>{complete ? copy.doneTitle : copy.title} · UNEEM</title>
</svelte:head>

<AuthShell
  backHref={complete ? '/login' : '/forgot-password'}
  backLabel={complete ? copy.signIn : copy.newLink}
>
  <section class="w-full">
    <div class="mb-7">
      <div class={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${complete ? 'bg-success-light text-success' : 'bg-primary-light text-primary'}`}>
        <Icon name={complete ? 'check' : 'key'} size={20} />
      </div>
      <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text sm:text-4xl">
        {complete ? copy.doneTitle : copy.title}
      </h1>
      <p class="mt-2 max-w-sm text-sm leading-6 text-text-secondary">
        {complete ? copy.doneBody : copy.subtitle}
      </p>
    </div>

    {#if error}
      <div class="mb-4 rounded-2xl bg-danger-light p-4 text-sm font-medium leading-6 text-danger" role="alert">{error}</div>
    {/if}

    {#if complete}
      <div class="space-y-3">
        <Button on:click={() => goto('/login')} variant="primary" size="lg" className="w-full">{copy.signIn}</Button>
        <ActionLink href="/help" variant="secondary" size="lg" icon="info" className="w-full">{copy.support}</ActionLink>
      </div>
    {:else}
      <form on:submit|preventDefault={handleReset} class="space-y-4">
        <TextField
          label={copy.password}
          type="password"
          placeholder={copy.passwordPlaceholder}
          icon="lock"
          autocomplete="new-password"
          bind:value={newPassword}
          validation={passwordState}
          hint={passwordState === 'invalid' && attempted && !newPassword.length ? copy.required : ''}
          validHint={copy.ready}
          disabled={loading}
        />

        <div class="grid grid-cols-3 gap-2 px-1" aria-live="polite">
          {#each [
            { label: copy.ruleLength, passed: passwordLength },
            { label: copy.ruleNumber, passed: passwordNumber },
            { label: copy.ruleSymbol, passed: passwordSymbol }
          ] as rule}
            <div class={`flex items-center gap-1.5 text-xs font-medium ${ruleClass(rule.passed)}`}>
              <Icon name={rule.passed ? 'check' : 'x'} size={13} />
              <span>{rule.label}</span>
            </div>
          {/each}
        </div>

        <TextField
          label={copy.confirm}
          type="password"
          placeholder={copy.confirmPlaceholder}
          icon="lock"
          autocomplete="new-password"
          bind:value={confirmPassword}
          validation={confirmState}
          hint={confirmState === 'invalid' ? copy.mismatch : ''}
          validHint={copy.match}
          disabled={loading}
        />

        <Button type="submit" variant="primary" size="lg" {loading} className="mt-2 w-full">{copy.update}</Button>
      </form>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <ActionLink href="/forgot-password" variant="secondary" size="md" icon="mail">{copy.newLink}</ActionLink>
        <ActionLink href="/help" variant="secondary" size="md" icon="info">{copy.support}</ActionLink>
      </div>
    {/if}
  </section>
</AuthShell>

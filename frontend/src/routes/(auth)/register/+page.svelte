<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { register, isAcademicEmail, mapAuthError } from '$lib/auth'
  import { uiState, language } from '$lib/stores/ui'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { isValidEmail, isValidStudentId, isValidPassword, isValidUsername } from '$lib/utils/cn'
  import { sanitizeInput, sanitizeName, sanitizeStudentId } from '$lib/validation'

  type Step = 'email' | 'details' | 'password'
  type FieldState = 'idle' | 'valid' | 'invalid'

  let step: Step = 'email'
  let fullName = ''
  let username = ''
  let email = ''
  let studentId = ''
  let password = ''
  let confirmPassword = ''
  let submitError = ''
  let loading = false
  let emailAttempted = false
  let detailsAttempted = false
  let passwordAttempted = false

  $: cleanEmail = email.trim().toLowerCase()
  $: academic = isAcademicEmail(cleanEmail)
  $: emailValid = isValidEmail(cleanEmail)
  $: cleanName = sanitizeName(fullName)
  $: fullNameValid = cleanName.length >= 2
  $: cleanUsername = username.trim().toLowerCase()
  $: usernameValid = isValidUsername(cleanUsername)
  $: cleanStudentId = sanitizeStudentId(studentId).toUpperCase()
  $: studentIdValid = academic || isValidStudentId(cleanStudentId)
  $: passwordLength = password.length >= 8
  $: passwordNumber = /\d/.test(password)
  $: passwordSymbol = /[!@#$%^&*()\-+]/.test(password)
  $: passwordValid = isValidPassword(password)
  $: confirmValid = confirmPassword.length > 0 && confirmPassword === password
  $: detailsValid = fullNameValid && usernameValid && studentIdValid

  $: emailState = fieldState(email.length > 0 || emailAttempted, emailValid)
  $: nameState = fieldState(fullName.length > 0 || detailsAttempted, fullNameValid)
  $: usernameState = fieldState(username.length > 0 || detailsAttempted, usernameValid)
  $: studentIdState = fieldState(studentId.length > 0 || detailsAttempted, studentIdValid)
  $: passwordState = fieldState(password.length > 0 || passwordAttempted, passwordValid)
  $: confirmState = fieldState(confirmPassword.length > 0 || passwordAttempted, confirmValid)

  $: copy = $language === 'ar'
    ? {
        emailTitle: 'إنشاء حساب', detailsTitle: 'معلوماتك', passwordTitle: 'كلمة المرور',
        email: 'البريد الإلكتروني', emailPlaceholder: 'mehdi@usmba.ac.ma',
        academicEmailValid: 'بريد جامعي — دخول أسرع', personalEmailValid: 'بريد شخصي — البطاقة مطلوبة', invalidEmail: 'أدخل بريداً صحيحاً.',
        universityEmail: 'بريد جامعي', universityAccess: 'يمكنك الحجز بعد تأكيد البريد', personalEmail: 'بريد شخصي', personalAccess: 'تأكيد بطاقة الطالب مطلوب قبل الحجز',
        continue: 'متابعة', back: 'رجوع',
        fullName: 'الاسم الكامل', fullNamePlaceholder: 'Mehdi El Amrani', fullNameValid: 'الاسم واضح', invalidName: 'اكتب الاسم الكامل.',
        username: 'اسم المستخدم', usernamePlaceholder: 'mehdi01', usernameValid: 'سيظهر كـ', invalidUsername: '3–24 حرفاً أو رقماً أو _',
        studentId: 'رقم الطالب', studentIdPlaceholder: 'S123456789', studentIdValid: 'الصيغة صحيحة', invalidStudentId: 'حرف واحد + 9 أرقام',
        password: 'كلمة المرور', passwordPlaceholder: '8 أحرف أو أكثر', confirmPassword: 'تأكيد كلمة المرور', confirmPlaceholder: 'أعد كتابة كلمة المرور',
        passwordReady: 'جاهزة', passwordRequired: 'أنشئ كلمة مرور.', match: 'متطابقة', mismatch: 'غير متطابقة',
        ruleLength: '8+ أحرف', ruleNumber: 'رقم', ruleSymbol: 'رمز', create: 'إنشاء الحساب', signIn: 'تسجيل الدخول', help: 'تحتاج مساعدة؟'
      }
    : {
        emailTitle: 'Create account', detailsTitle: 'Your details', passwordTitle: 'Set password',
        email: 'Email', emailPlaceholder: 'mehdi@usmba.ac.ma',
        academicEmailValid: 'USMBA email · faster access', personalEmailValid: 'Personal email · card approval required', invalidEmail: 'Enter a valid email.',
        universityEmail: 'University email', universityAccess: 'Book after confirming your email', personalEmail: 'Personal email', personalAccess: 'Student-card approval required before booking',
        continue: 'Continue', back: 'Back',
        fullName: 'Full name', fullNamePlaceholder: 'Mehdi El Amrani', fullNameValid: 'Looks good', invalidName: 'Use your full name.',
        username: 'Username', usernamePlaceholder: 'mehdi01', usernameValid: 'Will be', invalidUsername: '3–24 letters, numbers or _',
        studentId: 'Student ID', studentIdPlaceholder: 'S123456789', studentIdValid: 'Valid format', invalidStudentId: '1 letter + 9 digits',
        password: 'Password', passwordPlaceholder: '8+ characters', confirmPassword: 'Confirm password', confirmPlaceholder: 'Repeat password',
        passwordReady: 'Ready', passwordRequired: 'Create a password.', match: 'Passwords match', mismatch: 'Doesn’t match',
        ruleLength: '8+ chars', ruleNumber: '1 number', ruleSymbol: '1 symbol', create: 'Create account', signIn: 'Sign in', help: 'Need help?'
      }

  $: title = step === 'email' ? copy.emailTitle : step === 'details' ? copy.detailsTitle : copy.passwordTitle
  $: emailHint = emailState === 'valid' ? (academic ? copy.academicEmailValid : copy.personalEmailValid) : emailState === 'invalid' ? copy.invalidEmail : ''
  $: usernameHint = usernameState === 'valid' ? `${copy.usernameValid} @${cleanUsername}` : usernameState === 'invalid' ? copy.invalidUsername : ''
  $: loginHref = emailValid ? `/login?email=${encodeURIComponent(cleanEmail)}` : '/login'

  function fieldState(active: boolean, valid: boolean): FieldState {
    if (!active) return 'idle'
    return valid ? 'valid' : 'invalid'
  }
  function ruleClass(passed: boolean) {
    if (!password.length) return 'text-text-muted'
    return passed ? 'text-success' : 'text-danger'
  }
  function ruleIcon(passed: boolean) { return passed ? 'check' : 'x' }

  onMount(() => {
    const hintedEmail = new URLSearchParams(window.location.search).get('email')
    if (hintedEmail && isValidEmail(hintedEmail)) email = sanitizeInput(hintedEmail).trim().toLowerCase()
  })

  function toggleLanguage() { uiState.setLanguage($language === 'en' ? 'ar' : 'en') }
  function clearServerError() { submitError = '' }
  function goBack() {
    clearServerError()
    if (step === 'password') step = 'details'
    else if (step === 'details') step = 'email'
  }
  function continueFromEmail() {
    clearServerError(); emailAttempted = true; email = sanitizeInput(email).trim().toLowerCase()
    if (!emailValid) return
    step = 'details'
  }
  function continueFromDetails() {
    clearServerError(); detailsAttempted = true
    if (!detailsValid) return
    step = 'password'
  }
  async function submit() {
    clearServerError(); passwordAttempted = true
    if (!passwordValid || !confirmValid) return
    loading = true
    try {
      const normalizedStudentId = academic ? null : cleanStudentId
      const result = await register(cleanEmail, password, normalizedStudentId, cleanName, cleanUsername)
      if (result.error) { submitError = result.error.message; return }
      await goto(`/verify-email?email=${encodeURIComponent(cleanEmail)}`)
    } catch (err: any) {
      submitError = mapAuthError(err?.message, err?.status)
    } finally { loading = false }
  }
</script>

<svelte:head><title>{title} · UNEEM</title></svelte:head>

<div class="min-h-screen bg-background px-4 py-6 sm:py-10">
  <div class="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col">
    <header class="flex items-center justify-between">
      <a href="/login" class="text-lg font-bold tracking-tight text-text">UNEEM</a>
      <button type="button" on:click={toggleLanguage} class="min-h-10 min-w-10 rounded-full px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text" aria-label="Toggle language">{$language === 'ar' ? 'EN' : 'ع'}</button>
    </header>

    <main class="flex flex-1 items-start pt-12 sm:pt-20">
      <section class="w-full">
        <div class="mb-7">
          <div class="mb-5 flex gap-1.5" aria-hidden="true">
            <span class="h-1 flex-1 rounded-full bg-primary"></span>
            <span class={`h-1 flex-1 rounded-full ${step === 'details' || step === 'password' ? 'bg-primary' : 'bg-surface-level-2'}`}></span>
            <span class={`h-1 flex-1 rounded-full ${step === 'password' ? 'bg-primary' : 'bg-surface-level-2'}`}></span>
          </div>
          <div class="flex items-center gap-3">
            {#if step !== 'email'}
              <button type="button" on:click={goBack} class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text" aria-label={copy.back}>
                <Icon name={$language === 'ar' ? 'arrow-right' : 'arrow-left'} size={18} />
              </button>
            {/if}
            <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text sm:text-4xl">{title}</h1>
          </div>
        </div>

        {#if submitError}
          <div class="mb-5 rounded-2xl bg-danger-light p-4 text-danger" role="alert"><div class="flex items-start gap-3"><Icon name="alert-circle" size={20} className="mt-0.5 flex-shrink-0" /><p class="text-sm font-medium leading-relaxed">{submitError}</p></div></div>
        {/if}

        {#if step === 'email'}
          <form on:submit|preventDefault={continueFromEmail} class="space-y-5">
            <TextField label={copy.email} type="email" placeholder={copy.emailPlaceholder} icon="mail" autocomplete="email" bind:value={email} validation={emailState} hint={emailHint} disabled={loading} />
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>{copy.continue}</Button>
          </form>
        {:else if step === 'details'}
          <div class="mb-5 flex items-center gap-3 rounded-2xl bg-surface-level-1 px-4 py-3">
            <span class={`h-2.5 w-2.5 shrink-0 rounded-full ${academic ? 'bg-success' : 'bg-warning'}`}></span>
            <div class="min-w-0"><p class="text-sm font-semibold text-text">{academic ? copy.universityEmail : copy.personalEmail}</p><p class="mt-0.5 text-xs text-text-muted">{academic ? copy.universityAccess : copy.personalAccess}</p></div>
          </div>
          <form on:submit|preventDefault={continueFromDetails} class="space-y-4">
            <TextField label={copy.fullName} placeholder={copy.fullNamePlaceholder} icon="user" autocomplete="name" bind:value={fullName} validation={nameState} hint={nameState === 'invalid' ? copy.invalidName : ''} validHint={copy.fullNameValid} disabled={loading} />
            <TextField label={copy.username} placeholder={copy.usernamePlaceholder} icon="users" autocomplete="username" bind:value={username} validation={usernameState} hint={usernameHint} disabled={loading} />
            {#if !academic}
              <TextField label={copy.studentId} placeholder={copy.studentIdPlaceholder} icon="id-card" bind:value={studentId} validation={studentIdState} hint={studentIdState === 'invalid' ? copy.invalidStudentId : ''} validHint={copy.studentIdValid} disabled={loading} />
            {/if}
            <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" disabled={loading}>{copy.continue}</Button>
          </form>
        {:else}
          <form on:submit|preventDefault={submit} class="space-y-4">
            <TextField label={copy.password} type="password" placeholder={copy.passwordPlaceholder} icon="lock" autocomplete="new-password" bind:value={password} validation={passwordState} hint={passwordState === 'invalid' && passwordAttempted && !password.length ? copy.passwordRequired : ''} validHint={copy.passwordReady} disabled={loading} />
            <div class="grid grid-cols-3 gap-2 px-1" aria-live="polite">
              {#each [{ label: copy.ruleLength, passed: passwordLength }, { label: copy.ruleNumber, passed: passwordNumber }, { label: copy.ruleSymbol, passed: passwordSymbol }] as rule}
                <div class={`flex items-center gap-1.5 text-xs font-medium ${ruleClass(rule.passed)}`}>
                  {#if password.length}<Icon name={ruleIcon(rule.passed)} size={12} strokeWidth={2.4} />{:else}<span class="h-1.5 w-1.5 rounded-full bg-current opacity-45"></span>{/if}
                  <span>{rule.label}</span>
                </div>
              {/each}
            </div>
            <TextField label={copy.confirmPassword} type="password" placeholder={copy.confirmPlaceholder} icon="lock" autocomplete="new-password" bind:value={confirmPassword} validation={confirmState} hint={confirmState === 'invalid' ? copy.mismatch : ''} validHint={copy.match} disabled={loading} />
            <Button type="submit" variant="primary" size="lg" {loading} className="mt-2 w-full" disabled={loading}>{copy.create}</Button>
          </form>
        {/if}

        <div class="mt-7 text-center text-sm text-text-secondary"><a href={loginHref} class="font-semibold text-text hover:text-primary">{copy.signIn}</a></div>
      </section>
    </main>

    <footer class="pb-[max(0.25rem,env(safe-area-inset-bottom))] text-center text-sm text-text-secondary"><a href="/help" class="font-semibold text-text hover:text-primary">{copy.help}</a></footer>
  </div>
</div>

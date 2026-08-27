<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { checkUsernameAvailability, register, isAcademicEmail, mapAuthError } from '$lib/registrationApi'
  import { rememberConfirmationSend } from '$lib/confirmationResend'
  import { language } from '$lib/stores/ui'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import AuthShell from '$lib/components/AuthShell.svelte'
  import { isValidEmail, isValidStudentId, isValidPassword, isValidUsername } from '$lib/utils/cn'
  import { sanitizeInput, sanitizeName, sanitizeStudentId } from '$lib/validation'

  type Step = 'email' | 'details' | 'password'
  type FieldState = 'idle' | 'valid' | 'invalid'
  type UsernameAvailability = 'idle' | 'checking' | 'available' | 'taken' | 'error'

  let step: Step = 'email'
  let fullName = ''
  let username = ''
  let email = ''
  let studentId = ''
  let password = ''
  let confirmPassword = ''
  let submitError = ''
  let emailFieldError = ''
  let passwordFieldError = ''
  let loading = false
  let emailAttempted = false
  let detailsAttempted = false
  let passwordAttempted = false
  let usernameAvailability: UsernameAvailability = 'idle'
  let usernameAvailabilityError = ''
  let usernameCheckTimer: ReturnType<typeof setTimeout> | null = null
  let usernameCheckVersion = 0

  $: cleanEmail = email.trim().toLowerCase()
  $: academic = isAcademicEmail(cleanEmail)
  $: emailValid = isValidEmail(cleanEmail)
  $: cleanName = sanitizeName(fullName)
  $: fullNameValid = cleanName.length >= 2 && cleanName.length <= 100
  $: cleanUsername = username.trim().toLowerCase()
  $: usernameValid = isValidUsername(cleanUsername)
  $: cleanStudentId = sanitizeStudentId(studentId)
  $: studentIdValid = academic || isValidStudentId(cleanStudentId)
  $: passwordLength = password.length >= 8
  $: passwordNumber = /\d/.test(password)
  $: passwordSymbol = /[!@#$%^&*()\-+]/.test(password)
  $: passwordValid = isValidPassword(password) && password.length <= 128
  $: confirmValid = confirmPassword.length > 0 && confirmPassword === password
  $: detailsValid = fullNameValid && usernameValid && usernameAvailability === 'available' && studentIdValid

  $: emailState = emailFieldError ? 'invalid' : fieldState(email.length > 0 || emailAttempted, emailValid)
  $: nameState = fieldState(fullName.length > 0 || detailsAttempted, fullNameValid)
  $: usernameState = usernameAvailability === 'available'
    ? 'valid'
    : usernameAvailability === 'taken' || usernameAvailability === 'error'
      ? 'invalid'
      : fieldState((username.length > 0 || detailsAttempted) && !usernameValid, false)
  $: studentIdState = fieldState(studentId.length > 0 || detailsAttempted, studentIdValid)
  $: passwordState = passwordFieldError ? 'invalid' : fieldState(password.length > 0 || passwordAttempted, passwordValid)
  $: confirmState = fieldState(confirmPassword.length > 0 || passwordAttempted, confirmValid)

  $: copy = $language === 'ar'
    ? {
        emailTitle: 'إنشاء حساب', detailsTitle: 'معلوماتك', passwordTitle: 'اختر كلمة مرور',
        emailSubtitle: 'ابدأ ببريدك الإلكتروني', detailsSubtitle: 'معلومات قصيرة فقط', passwordSubtitle: 'اجعلها آمنة وسهلة التذكر',
        email: 'البريد الإلكتروني', emailPlaceholder: 'mehdi@usmba.ac.ma', academicEmailValid: 'بريد جامعي · دخول أسرع', personalEmailValid: 'بريد شخصي · البطاقة مطلوبة', invalidEmail: 'أدخل بريداً صحيحاً.',
        universityEmail: 'بريد جامعي', universityAccess: 'يمكنك الحجز بعد تأكيد البريد', personalEmail: 'بريد شخصي', personalAccess: 'بطاقة الطالب مطلوبة قبل الحجز',
        continue: 'متابعة', back: 'رجوع', fullName: 'الاسم الكامل', fullNamePlaceholder: 'Mehdi El Amrani', fullNameValid: 'الاسم واضح', invalidName: 'اكتب اسماً من 2 إلى 100 حرف.',
        username: 'اسم المستخدم', usernamePlaceholder: 'mehdi01', invalidUsername: '3–24 حرفاً صغيراً أو رقماً أو _', usernameChecking: 'جارٍ التحقق من توفر الاسم…', usernameAvailable: 'متاح', usernameTaken: 'اسم المستخدم مستعمل بالفعل. اختر اسماً آخر.', usernameCheckFailed: 'تعذر التحقق من الاسم الآن. حاول مجدداً.',
        studentId: 'رقم الطالب', studentIdPlaceholder: 'S123456789', studentIdValid: 'الصيغة صحيحة · الملكية تُراجع مع بطاقة الطالب', invalidStudentId: 'حرف واحد + 9 أرقام فقط',
        password: 'كلمة المرور', passwordPlaceholder: '8 أحرف أو أكثر', confirmPassword: 'تأكيد كلمة المرور', confirmPlaceholder: 'أعد كتابة كلمة المرور',
        passwordReady: 'جاهزة', passwordRequired: 'أنشئ كلمة مرور.', match: 'متطابقة', mismatch: 'غير متطابقة',
        ruleLength: '8+ أحرف', ruleNumber: 'رقم', ruleSymbol: 'رمز', create: 'إنشاء الحساب', haveAccount: 'لديك حساب؟', signIn: 'تسجيل الدخول', help: 'تحتاج مساعدة؟'
      }
    : {
        emailTitle: 'Create account', detailsTitle: 'Your details', passwordTitle: 'Set password',
        emailSubtitle: 'Start with your email', detailsSubtitle: 'Just the essentials', passwordSubtitle: 'Keep it secure and memorable',
        email: 'Email address', emailPlaceholder: 'mehdi@usmba.ac.ma', academicEmailValid: 'USMBA email · faster access', personalEmailValid: 'Personal email · card approval required', invalidEmail: 'Enter a valid email.',
        universityEmail: 'University email', universityAccess: 'Book after confirming your email', personalEmail: 'Personal email', personalAccess: 'Student card required before booking',
        continue: 'Continue', back: 'Back', fullName: 'Full name', fullNamePlaceholder: 'Mehdi El Amrani', fullNameValid: 'Looks good', invalidName: 'Use 2–100 characters for your name.',
        username: 'Username', usernamePlaceholder: 'mehdi01', invalidUsername: '3–24 lowercase letters, numbers or _', usernameChecking: 'Checking availability…', usernameAvailable: 'Available', usernameTaken: 'That username is already taken. Choose another one.', usernameCheckFailed: 'Could not check that username right now. Try again.',
        studentId: 'Student ID', studentIdPlaceholder: 'S123456789', studentIdValid: 'Format valid · ownership is checked with your student card', invalidStudentId: 'Use exactly 1 letter + 9 digits',
        password: 'Password', passwordPlaceholder: '8+ characters', confirmPassword: 'Confirm password', confirmPlaceholder: 'Repeat password',
        passwordReady: 'Ready', passwordRequired: 'Create a password.', match: 'Passwords match', mismatch: 'Doesn’t match',
        ruleLength: '8+ chars', ruleNumber: '1 number', ruleSymbol: '1 symbol', create: 'Create account', haveAccount: 'Already have an account?', signIn: 'Sign in', help: 'Need help?'
      }

  $: title = step === 'email' ? copy.emailTitle : step === 'details' ? copy.detailsTitle : copy.passwordTitle
  $: subtitle = step === 'email' ? copy.emailSubtitle : step === 'details' ? copy.detailsSubtitle : copy.passwordSubtitle
  $: emailHint = emailFieldError || (emailState === 'valid' ? (academic ? copy.academicEmailValid : copy.personalEmailValid) : emailState === 'invalid' ? copy.invalidEmail : '')
  $: usernameHint = !usernameValid && (username.length > 0 || detailsAttempted)
    ? copy.invalidUsername
    : usernameAvailability === 'checking'
      ? copy.usernameChecking
      : usernameAvailability === 'available'
        ? `${copy.usernameAvailable} · @${cleanUsername}`
        : usernameAvailability === 'taken'
          ? copy.usernameTaken
          : usernameAvailability === 'error'
            ? (usernameAvailabilityError || copy.usernameCheckFailed)
            : ''
  $: loginHref = emailValid ? `/login?email=${encodeURIComponent(cleanEmail)}` : '/login'

  function fieldState(active: boolean, valid: boolean): FieldState {
    if (!active) return 'idle'
    return valid ? 'valid' : 'invalid'
  }

  function ruleClass(passed: boolean) {
    if (!password.length) return 'text-text-muted'
    return passed ? 'text-success' : 'text-danger'
  }

  function clearUsernameTimer() {
    if (usernameCheckTimer) {
      clearTimeout(usernameCheckTimer)
      usernameCheckTimer = null
    }
  }

  async function performUsernameCheck(candidate: string, version: number): Promise<boolean> {
    const result = await checkUsernameAvailability(candidate)
    if (version !== usernameCheckVersion || candidate !== username.trim().toLowerCase()) return false

    if (result.error) {
      usernameAvailability = 'error'
      usernameAvailabilityError = result.error.message || copy.usernameCheckFailed
      return false
    }

    usernameAvailabilityError = ''
    usernameAvailability = result.available ? 'available' : 'taken'
    return result.available
  }

  function handleUsernameInput() {
    submitError = ''
    detailsAttempted = false
    usernameAvailabilityError = ''
    clearUsernameTimer()
    const version = ++usernameCheckVersion
    const candidate = username.trim().toLowerCase()

    if (!isValidUsername(candidate)) {
      usernameAvailability = 'idle'
      return
    }

    usernameAvailability = 'checking'
    usernameCheckTimer = setTimeout(() => {
      usernameCheckTimer = null
      void performUsernameCheck(candidate, version)
    }, 450)
  }

  async function ensureUsernameAvailable(): Promise<boolean> {
    const candidate = cleanUsername
    if (!isValidUsername(candidate)) return false
    if (usernameAvailability === 'available') return true

    clearUsernameTimer()
    const version = ++usernameCheckVersion
    usernameAvailability = 'checking'
    return performUsernameCheck(candidate, version)
  }

  function goBack() {
    submitError = ''
    emailFieldError = ''
    passwordFieldError = ''
    if (step === 'password') step = 'details'
    else if (step === 'details') step = 'email'
  }

  onMount(() => {
    const hintedEmail = new URLSearchParams(window.location.search).get('email')
    if (hintedEmail && isValidEmail(hintedEmail)) email = sanitizeInput(hintedEmail).trim().toLowerCase()
  })

  function continueFromEmail() {
    submitError = ''
    emailFieldError = ''
    emailAttempted = true
    email = sanitizeInput(email).trim().toLowerCase()
    if (!emailValid) return
    step = 'details'
  }

  async function continueFromDetails() {
    submitError = ''
    detailsAttempted = true
    fullName = cleanName
    username = cleanUsername
    if (!academic) studentId = cleanStudentId
    if (!fullNameValid || !usernameValid || !studentIdValid) return
    if (!(await ensureUsernameAvailable())) return
    step = 'password'
  }

  function handlePasswordInput() {
    passwordFieldError = ''
    submitError = ''
  }

  async function submit() {
    submitError = ''
    passwordFieldError = ''
    passwordAttempted = true
    if (!passwordValid || !confirmValid) return
    if (!(await ensureUsernameAvailable())) {
      step = 'details'
      return
    }

    loading = true
    try {
      const result = await register(cleanEmail, password, academic ? null : cleanStudentId, cleanName, cleanUsername)
      if (result.error) {
        if (result.error.kind === 'username_taken') {
          usernameAvailability = 'taken'
          step = 'details'
          return
        }
        if (result.error.kind === 'weak_password') {
          passwordFieldError = result.error.message
          return
        }
        if (result.error.kind === 'account_exists') {
          emailFieldError = result.error.message
          step = 'email'
          return
        }
        submitError = result.error.message
        return
      }
      rememberConfirmationSend(cleanEmail)
      await goto(`/verify-email?email=${encodeURIComponent(cleanEmail)}`)
    } catch (err: any) {
      submitError = mapAuthError(err?.message, err?.status)
    } finally {
      loading = false
    }
  }
</script>

<svelte:head><title>{title} · UNEEM</title></svelte:head>

<AuthShell>
  <section class="w-full">
    <div class="mb-8">
      <div class="mb-7 flex gap-1.5" aria-hidden="true">
        <span class="h-1 flex-1 rounded-full bg-primary"></span>
        <span class={`h-1 flex-1 rounded-full ${step === 'details' || step === 'password' ? 'bg-primary' : 'bg-surface-level-2'}`}></span>
        <span class={`h-1 flex-1 rounded-full ${step === 'password' ? 'bg-primary' : 'bg-surface-level-2'}`}></span>
      </div>

      <div class="relative text-center">
        {#if step !== 'email'}
          <button type="button" on:click={goBack} class="absolute start-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25" aria-label={copy.back}>
            <Icon name={$language === 'ar' ? 'arrow-right' : 'arrow-left'} size={18} />
          </button>
        {/if}
        <h1 class="text-[30px] font-semibold tracking-[-0.035em] text-text">{title}</h1>
        <p class="mt-2 text-sm text-text-secondary">{subtitle}</p>
      </div>
    </div>

    {#if submitError}
      <div class="mb-5 rounded-[18px] border border-danger/15 bg-danger-light p-4 text-danger" role="alert">
        <div class="flex items-start gap-3"><Icon name="alert-circle" size={19} className="mt-0.5 shrink-0" /><p class="text-sm font-medium leading-6">{submitError}</p></div>
      </div>
    {/if}

    {#if step === 'email'}
      <form on:submit|preventDefault={continueFromEmail} class="space-y-5">
        <TextField ariaLabel={copy.email} type="email" placeholder={copy.emailPlaceholder} icon="mail" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck={false} maxlength={254} bind:value={email} validation={emailState} error={emailFieldError} hint={emailHint} disabled={loading} />
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>{copy.continue}</Button>
      </form>
    {:else if step === 'details'}
      <div class="mb-5 flex items-center gap-3 rounded-[18px] border border-border/70 bg-surface-level-1 px-4 py-3.5">
        <span class={`h-2.5 w-2.5 shrink-0 rounded-full ${academic ? 'bg-success' : 'bg-warning'}`}></span>
        <div class="min-w-0"><p class="text-sm font-semibold text-text">{academic ? copy.universityEmail : copy.personalEmail}</p><p class="mt-0.5 text-xs text-text-muted">{academic ? copy.universityAccess : copy.personalAccess}</p></div>
      </div>
      <form on:submit|preventDefault={continueFromDetails} class="space-y-4">
        <TextField ariaLabel={copy.fullName} placeholder={copy.fullNamePlaceholder} icon="user" autocomplete="name" maxlength={100} bind:value={fullName} validation={nameState} hint={nameState === 'invalid' ? copy.invalidName : ''} validHint={copy.fullNameValid} disabled={loading} />
        <TextField ariaLabel={copy.username} placeholder={copy.usernamePlaceholder} icon="users" autocomplete="username" autocapitalize="none" spellcheck={false} maxlength={24} bind:value={username} validation={usernameState} hint={usernameHint} disabled={loading} on:input={handleUsernameInput} />
        {#if !academic}
          <TextField ariaLabel={copy.studentId} placeholder={copy.studentIdPlaceholder} icon="id-card" autocapitalize="characters" spellcheck={false} maxlength={20} bind:value={studentId} validation={studentIdState} hint={studentIdState === 'invalid' ? copy.invalidStudentId : ''} validHint={copy.studentIdValid} disabled={loading} />
        {/if}
        <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" loading={usernameAvailability === 'checking'} disabled={loading || usernameAvailability === 'checking'}>{copy.continue}</Button>
      </form>
    {:else}
      <form on:submit|preventDefault={submit} class="space-y-4">
        <TextField ariaLabel={copy.password} type="password" placeholder={copy.passwordPlaceholder} icon="lock" autocomplete="new-password" maxlength={128} bind:value={password} validation={passwordState} error={passwordFieldError} hint={passwordState === 'invalid' && passwordAttempted && !password.length ? copy.passwordRequired : ''} validHint={copy.passwordReady} disabled={loading} on:input={handlePasswordInput} />

        <div class="grid grid-cols-3 gap-2 px-1" aria-live="polite">
          {#each [{ label: copy.ruleLength, passed: passwordLength }, { label: copy.ruleNumber, passed: passwordNumber }, { label: copy.ruleSymbol, passed: passwordSymbol }] as rule}
            <div class={`flex items-center justify-center gap-1.5 text-xs font-medium ${ruleClass(rule.passed)}`}>
              {#if password.length}<Icon name={rule.passed ? 'check' : 'x'} size={12} strokeWidth={2.4} />{:else}<span class="h-1.5 w-1.5 rounded-full bg-current opacity-45"></span>{/if}
              <span>{rule.label}</span>
            </div>
          {/each}
        </div>

        <TextField ariaLabel={copy.confirmPassword} type="password" placeholder={copy.confirmPlaceholder} icon="lock" autocomplete="new-password" maxlength={128} bind:value={confirmPassword} validation={confirmState} hint={confirmState === 'invalid' ? copy.mismatch : ''} validHint={copy.match} disabled={loading} />
        <Button type="submit" variant="primary" size="lg" {loading} className="mt-2 w-full" disabled={loading}>{copy.create}</Button>
      </form>
    {/if}

    <p class="mt-7 text-center text-sm text-text-secondary">
      {copy.haveAccount}<a href={loginHref} class="ms-1 font-semibold text-primary transition-colors hover:text-primary-hover">{copy.signIn}</a>
    </p>
  </section>

  <div slot="footer" class="text-center">
    <a href="/help" class="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm text-text-muted transition-colors hover:text-text"><Icon name="info" size={17} /><span>{copy.help}</span></a>
  </div>
</AuthShell>

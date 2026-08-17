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

  let step: Step = 'email'
  let fullName = ''
  let username = ''
  let email = ''
  let studentId = ''
  let password = ''
  let confirmPassword = ''
  let submitError = ''
  let errors: Record<string, string> = {}
  let loading = false

  $: cleanEmail = email.trim().toLowerCase()
  $: academic = isAcademicEmail(cleanEmail)
  $: emailValid = isValidEmail(cleanEmail)

  $: copy = $language === 'ar'
    ? {
        emailTitle: 'إنشاء حساب',
        detailsTitle: 'معلوماتك',
        passwordTitle: 'كلمة المرور',
        email: 'البريد الإلكتروني',
        emailPlaceholder: 'name@usmba.ac.ma',
        emailHint: 'بريد USMBA يعطيك دخولاً أسرع. البريد الشخصي مقبول أيضاً.',
        universityEmail: 'بريد جامعي',
        universityAccess: 'دخول أسرع بعد تأكيد البريد',
        personalEmail: 'بريد شخصي',
        personalAccess: 'تأكيد بطاقة الطالب مطلوب',
        continue: 'متابعة',
        back: 'رجوع',
        fullName: 'الاسم الكامل',
        fullNamePlaceholder: 'كما يظهر في بطاقتك',
        username: 'اسم المستخدم',
        usernamePlaceholder: 'marwan_23',
        usernameHelp: 'للدعوات والبحث.',
        studentId: 'رقم الطالب',
        studentIdPlaceholder: 'S123456789',
        password: 'كلمة المرور',
        confirmPassword: 'تأكيد كلمة المرور',
        passwordHelp: '8 أحرف أو أكثر، مع رقم ورمز.',
        create: 'إنشاء الحساب',
        signIn: 'تسجيل الدخول',
        help: 'تحتاج مساعدة؟',
        invalidEmail: 'أدخل بريداً صحيحاً.',
        invalidName: 'أدخل اسمك الكامل.',
        invalidUsername: 'استخدم 3–24 حرفاً صغيراً أو رقماً أو _.',
        invalidStudentId: 'أدخل رقم طالب صحيحاً مثل S123456789.',
        invalidPassword: 'تحقق من كلمة المرور.',
        mismatch: 'كلمتا المرور غير متطابقتين.'
      }
    : {
        emailTitle: 'Create account',
        detailsTitle: 'Your details',
        passwordTitle: 'Set password',
        email: 'Email',
        emailPlaceholder: 'name@usmba.ac.ma',
        emailHint: 'USMBA email gives faster access. Personal email works too.',
        universityEmail: 'University email',
        universityAccess: 'Faster access after confirmation',
        personalEmail: 'Personal email',
        personalAccess: 'Student-card approval required',
        continue: 'Continue',
        back: 'Back',
        fullName: 'Full name',
        fullNamePlaceholder: 'As shown on your student card',
        username: 'Username',
        usernamePlaceholder: 'marwan_23',
        usernameHelp: 'For invites and search.',
        studentId: 'Student ID',
        studentIdPlaceholder: 'S123456789',
        password: 'Password',
        confirmPassword: 'Confirm password',
        passwordHelp: '8+ characters with a number and symbol.',
        create: 'Create account',
        signIn: 'Sign in',
        help: 'Need help?',
        invalidEmail: 'Enter a valid email.',
        invalidName: 'Enter your full name.',
        invalidUsername: 'Use 3–24 lowercase letters, numbers, or underscores.',
        invalidStudentId: 'Enter a valid Student ID, like S123456789.',
        invalidPassword: 'Check your password.',
        mismatch: 'Passwords do not match.'
      }

  $: title = step === 'email'
    ? copy.emailTitle
    : step === 'details'
      ? copy.detailsTitle
      : copy.passwordTitle

  $: loginHref = emailValid
    ? `/login?email=${encodeURIComponent(cleanEmail)}`
    : '/login'

  onMount(() => {
    const hintedEmail = new URLSearchParams(window.location.search).get('email')
    if (hintedEmail && isValidEmail(hintedEmail)) {
      email = sanitizeInput(hintedEmail).trim().toLowerCase()
    }
  })

  function toggleLanguage() {
    uiState.setLanguage($language === 'en' ? 'ar' : 'en')
  }

  function clearFeedback() {
    errors = {}
    submitError = ''
  }

  function goBack() {
    clearFeedback()
    if (step === 'password') step = 'details'
    else if (step === 'details') step = 'email'
  }

  function continueFromEmail() {
    clearFeedback()
    email = sanitizeInput(email).trim().toLowerCase()

    if (!isValidEmail(email)) {
      errors.email = copy.invalidEmail
      return
    }

    step = 'details'
  }

  function continueFromDetails() {
    clearFeedback()

    if (sanitizeName(fullName).length < 2) {
      errors.fullName = copy.invalidName
    }
    if (!isValidUsername(username.trim().toLowerCase())) {
      errors.username = copy.invalidUsername
    }
    if (!academic && !isValidStudentId(studentId.toUpperCase())) {
      errors.studentId = copy.invalidStudentId
    }

    if (Object.keys(errors).length > 0) return
    step = 'password'
  }

  async function submit() {
    clearFeedback()

    if (!isValidPassword(password)) {
      errors.password = copy.invalidPassword
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = copy.mismatch
    }
    if (Object.keys(errors).length > 0) return

    loading = true
    try {
      const cleanFullName = sanitizeName(fullName)
      const cleanUsername = sanitizeInput(username).trim().toLowerCase()
      const cleanPassword = sanitizeInput(password)
      const cleanStudentId = academic ? null : sanitizeStudentId(studentId).toUpperCase()

      const result = await register(cleanEmail, cleanPassword, cleanStudentId, cleanFullName, cleanUsername)
      if (result.error) {
        submitError = result.error.message
        return
      }

      await goto(`/verify-email?email=${encodeURIComponent(cleanEmail)}`)
    } catch (err: any) {
      submitError = mapAuthError(err?.message, err?.status)
    } finally {
      loading = false
    }
  }
</script>

<svelte:head>
  <title>{title} · UNEEM</title>
</svelte:head>

<div class="min-h-screen bg-background px-4 py-6 sm:py-10">
  <div class="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col">
    <header class="flex items-center justify-between">
      <a href="/login" class="text-lg font-bold tracking-tight text-text">UNEEM</a>
      <button
        type="button"
        on:click={toggleLanguage}
        class="min-h-10 min-w-10 rounded-full px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text"
        aria-label="Toggle language"
      >
        {$language === 'ar' ? 'EN' : 'ع'}
      </button>
    </header>

    <main class="flex flex-1 items-start pt-12 sm:pt-20">
      <section class="w-full">
        <div class="mb-7">
          <div class="mb-5 flex gap-1.5" aria-hidden="true">
            <span class={`h-1 flex-1 rounded-full ${step === 'email' || step === 'details' || step === 'password' ? 'bg-primary' : 'bg-surface-level-2'}`}></span>
            <span class={`h-1 flex-1 rounded-full ${step === 'details' || step === 'password' ? 'bg-primary' : 'bg-surface-level-2'}`}></span>
            <span class={`h-1 flex-1 rounded-full ${step === 'password' ? 'bg-primary' : 'bg-surface-level-2'}`}></span>
          </div>

          <div class="flex items-center gap-3">
            {#if step !== 'email'}
              <button
                type="button"
                on:click={goBack}
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-level-1 hover:text-text"
                aria-label={copy.back}
              >
                <Icon name={$language === 'ar' ? 'arrow-right' : 'arrow-left'} size={18} />
              </button>
            {/if}
            <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text sm:text-4xl">{title}</h1>
          </div>
        </div>

        {#if submitError}
          <div class="mb-5 rounded-2xl bg-danger-light p-4 text-danger" role="alert">
            <div class="flex items-start gap-3">
              <Icon name="alert-circle" size={20} className="mt-0.5 flex-shrink-0" />
              <p class="text-sm font-medium leading-relaxed">{submitError}</p>
            </div>
          </div>
        {/if}

        {#if step === 'email'}
          <form on:submit|preventDefault={continueFromEmail} class="space-y-4">
            <TextField
              label={copy.email}
              type="email"
              placeholder={copy.emailPlaceholder}
              bind:value={email}
              error={errors.email}
              disabled={loading}
            />
            <p class="px-1 text-sm leading-6 text-text-secondary">{copy.emailHint}</p>
            <Button type="submit" variant="primary" size="lg" className="w-full">{copy.continue}</Button>
          </form>
        {:else if step === 'details'}
          <div class="mb-5 flex items-center gap-3 rounded-2xl bg-surface-level-1 px-4 py-3">
            <span class={`h-2.5 w-2.5 shrink-0 rounded-full ${academic ? 'bg-success' : 'bg-warning'}`}></span>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-text">{academic ? copy.universityEmail : copy.personalEmail}</p>
              <p class="mt-0.5 text-xs text-text-muted">{academic ? copy.universityAccess : copy.personalAccess}</p>
            </div>
          </div>

          <form on:submit|preventDefault={continueFromDetails} class="space-y-4">
            <TextField
              label={copy.fullName}
              placeholder={copy.fullNamePlaceholder}
              bind:value={fullName}
              error={errors.fullName}
              disabled={loading}
            />

            <div class="space-y-1.5">
              <TextField
                label={copy.username}
                placeholder={copy.usernamePlaceholder}
                bind:value={username}
                error={errors.username}
                disabled={loading}
              />
              <p class="px-1 text-xs text-text-muted">{copy.usernameHelp}</p>
            </div>

            {#if !academic}
              <TextField
                label={copy.studentId}
                placeholder={copy.studentIdPlaceholder}
                bind:value={studentId}
                error={errors.studentId}
                disabled={loading}
              />
            {/if}

            <Button type="submit" variant="primary" size="lg" className="mt-2 w-full">{copy.continue}</Button>
          </form>
        {:else}
          <form on:submit|preventDefault={submit} class="space-y-4">
            <div class="space-y-1.5">
              <TextField
                label={copy.password}
                type="password"
                bind:value={password}
                error={errors.password}
                disabled={loading}
              />
              <p class="px-1 text-xs text-text-muted">{copy.passwordHelp}</p>
            </div>

            <TextField
              label={copy.confirmPassword}
              type="password"
              bind:value={confirmPassword}
              error={errors.confirmPassword}
              disabled={loading}
            />

            <Button type="submit" variant="primary" size="lg" {loading} className="mt-2 w-full">{copy.create}</Button>
          </form>
        {/if}

        <div class="mt-7 text-center text-sm text-text-secondary">
          <a href={loginHref} class="font-semibold text-text hover:text-primary">{copy.signIn}</a>
        </div>
      </section>
    </main>

    <footer class="pb-[max(0.25rem,env(safe-area-inset-bottom))] text-center text-sm text-text-secondary">
      <a href="/help" class="font-semibold text-text hover:text-primary">{copy.help}</a>
    </footer>
  </div>
</div>

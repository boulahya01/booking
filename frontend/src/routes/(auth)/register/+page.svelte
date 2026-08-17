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

  type Step = 'email' | 'details'

  let step: Step = 'email'
  let fullName = ''
  let username = ''
  let email = ''
  let studentId = ''
  let password = ''
  let confirmPassword = ''
  let submitError = ''
  let loading = false

  $: academic = isAcademicEmail(email)
  $: emailValid = isValidEmail(email)
  $: usernameValid = isValidUsername(username)
  $: studentIdValid = academic || isValidStudentId(studentId.toUpperCase())
  $: passwordValid = isValidPassword(password)
  $: passwordsMatch = password.length > 0 && password === confirmPassword
  $: fullNameValid = fullName.trim().length >= 2

  $: copy = $language === 'ar'
    ? {
        title: 'إنشاء حساب',
        email: 'البريد الإلكتروني',
        emailPlaceholder: 'name@usmba.ac.ma',
        academicBenefit: 'بريد USMBA: دخول أسرع بعد تأكيد البريد.',
        personalOption: 'لا تملك بريداً جامعياً؟ استخدم بريدك الشخصي.',
        continue: 'متابعة',
        back: 'رجوع',
        academicPath: 'بريد جامعي',
        academicPathHelp: 'يمكنك الحجز بعد تأكيد البريد.',
        personalPath: 'بريد شخصي',
        personalPathHelp: 'يلزم تأكيد بطاقة الطالب قبل الحجز.',
        fullName: 'الاسم الكامل',
        fullNamePlaceholder: 'كما يظهر في بطاقتك',
        username: 'اسم المستخدم',
        usernamePlaceholder: 'marwan_23',
        usernameHelp: 'يظهر في الدعوات والبحث.',
        studentId: 'رقم الطالب',
        studentIdPlaceholder: 'S123456789',
        password: 'كلمة المرور',
        confirmPassword: 'تأكيد كلمة المرور',
        passwordHelp: '8 أحرف أو أكثر، مع رقم ورمز.',
        create: 'إنشاء الحساب',
        haveAccount: 'لديك حساب؟',
        signIn: 'تسجيل الدخول',
        help: 'تحتاج مساعدة؟',
        invalidEmail: 'أدخل بريداً إلكترونياً صحيحاً.',
        invalidName: 'أدخل اسمك الكامل.',
        invalidUsername: 'استخدم 3–24 حرفاً إنجليزياً صغيراً أو رقماً أو _.',
        invalidStudentId: 'أدخل رقم طالب صحيحاً مثل S123456789.',
        invalidPassword: 'تحقق من متطلبات كلمة المرور.',
        mismatch: 'كلمتا المرور غير متطابقتين.'
      }
    : {
        title: 'Create account',
        email: 'Email address',
        emailPlaceholder: 'name@usmba.ac.ma',
        academicBenefit: 'USMBA email: faster access after confirmation.',
        personalOption: "No university email? Use your personal email.",
        continue: 'Continue',
        back: 'Back',
        academicPath: 'University email',
        academicPathHelp: 'Book after confirming your email.',
        personalPath: 'Personal email',
        personalPathHelp: 'Student-card approval is required before booking.',
        fullName: 'Full name',
        fullNamePlaceholder: 'As shown on your student card',
        username: 'Username',
        usernamePlaceholder: 'marwan_23',
        usernameHelp: 'Used for invites and search.',
        studentId: 'Student ID',
        studentIdPlaceholder: 'S123456789',
        password: 'Password',
        confirmPassword: 'Confirm password',
        passwordHelp: '8+ characters with a number and symbol.',
        create: 'Create account',
        haveAccount: 'Already have an account?',
        signIn: 'Sign in',
        help: 'Need help?',
        invalidEmail: 'Enter a valid email address.',
        invalidName: 'Enter your full name.',
        invalidUsername: 'Use 3–24 lowercase letters, numbers, or underscores.',
        invalidStudentId: 'Enter a valid Student ID, like S123456789.',
        invalidPassword: 'Check the password requirements.',
        mismatch: 'Passwords do not match.'
      }

  $: loginHref = emailValid
    ? `/login?email=${encodeURIComponent(email.trim().toLowerCase())}`
    : '/login'

  onMount(() => {
    const hintedEmail = new URLSearchParams(window.location.search).get('email')
    if (hintedEmail && isValidEmail(hintedEmail)) {
      email = sanitizeInput(hintedEmail).trim().toLowerCase()
    }
  })

  function continueFromEmail() {
    submitError = ''
    email = sanitizeInput(email).trim().toLowerCase()
    if (!isValidEmail(email)) {
      submitError = copy.invalidEmail
      return
    }
    step = 'details'
  }

  async function submit() {
    submitError = ''
    if (!fullNameValid) { submitError = copy.invalidName; return }
    if (!usernameValid) { submitError = copy.invalidUsername; return }
    if (!studentIdValid) { submitError = copy.invalidStudentId; return }
    if (!passwordValid) { submitError = copy.invalidPassword; return }
    if (!passwordsMatch) { submitError = copy.mismatch; return }

    loading = true
    try {
      const cleanFullName = sanitizeName(fullName)
      const cleanUsername = sanitizeInput(username).trim().toLowerCase()
      const cleanEmail = sanitizeInput(email).trim().toLowerCase()
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

  function toggleLanguage() {
    uiState.setLanguage($language === 'en' ? 'ar' : 'en')
  }
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>

<div class="min-h-screen bg-background px-4 py-6 sm:py-10">
  <div class="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col">
    <header class="flex items-center justify-between">
      <a href="/login" class="text-lg font-bold tracking-tight text-text">UNEEM</a>
      <button on:click={toggleLanguage} class="system-secondary-action min-h-10 px-3 text-sm" aria-label="Toggle language">
        {$language === 'ar' ? 'EN' : 'ع'}
      </button>
    </header>

    <main class="flex flex-1 items-center py-8">
      <section class="w-full space-y-6">
        <div class="flex items-center gap-3">
          {#if step === 'details'}
            <button
              type="button"
              on:click={() => { step = 'email'; submitError = '' }}
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-level-1 text-text-secondary"
              aria-label={copy.back}
            >
              <Icon name={$language === 'ar' ? 'arrow-right' : 'arrow-left'} size={18} />
            </button>
          {/if}
          <h1 class="text-4xl font-semibold tracking-[-0.035em] text-text">{copy.title}</h1>
        </div>

        {#if submitError}
          <div class="rounded-2xl bg-danger-light p-4 text-danger" role="alert">
            <div class="flex items-start gap-3">
              <Icon name="alert-circle" size={20} className="mt-0.5 flex-shrink-0" />
              <p class="text-sm font-medium leading-relaxed">{submitError}</p>
            </div>
          </div>
        {/if}

        {#if step === 'email'}
          <form on:submit|preventDefault={continueFromEmail} class="space-y-5">
            <TextField label={copy.email} type="email" placeholder={copy.emailPlaceholder} bind:value={email} disabled={loading} />

            <div class="space-y-2 text-sm">
              <p class="font-medium text-text">{copy.academicBenefit}</p>
              <p class="text-text-secondary">{copy.personalOption}</p>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full">{copy.continue}</Button>
          </form>
        {:else}
          <div class="rounded-2xl bg-surface-level-1 px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-text">{academic ? copy.academicPath : copy.personalPath}</p>
                <p class="mt-0.5 truncate text-sm text-text-secondary">{email}</p>
              </div>
              <span class={`h-2.5 w-2.5 shrink-0 rounded-full ${academic ? 'bg-success' : 'bg-warning'}`}></span>
            </div>
            <p class="mt-2 text-sm text-text-secondary">{academic ? copy.academicPathHelp : copy.personalPathHelp}</p>
          </div>

          <form on:submit|preventDefault={submit} class="space-y-4">
            <TextField label={copy.fullName} placeholder={copy.fullNamePlaceholder} bind:value={fullName} disabled={loading} />

            <div class="space-y-1.5">
              <TextField label={copy.username} placeholder={copy.usernamePlaceholder} bind:value={username} disabled={loading} />
              <p class="px-1 text-xs text-text-muted">{copy.usernameHelp}</p>
            </div>

            {#if !academic}
              <TextField label={copy.studentId} placeholder={copy.studentIdPlaceholder} bind:value={studentId} disabled={loading} />
            {/if}

            <div class="space-y-1.5">
              <TextField label={copy.password} type="password" bind:value={password} disabled={loading} />
              <p class="px-1 text-xs text-text-muted">{copy.passwordHelp}</p>
            </div>

            <TextField label={copy.confirmPassword} type="password" bind:value={confirmPassword} disabled={loading} />
            <Button type="submit" variant="primary" size="lg" {loading} className="w-full">{copy.create}</Button>
          </form>
        {/if}

        <div class="text-center text-sm text-text-secondary">
          {copy.haveAccount}<a href={loginHref} class="ms-1 font-semibold text-text hover:text-primary">{copy.signIn}</a>
        </div>
      </section>
    </main>

    <footer class="pb-[max(0.25rem,env(safe-area-inset-bottom))] text-center text-sm text-text-secondary">
      <a href="/help" class="font-semibold text-text hover:text-primary">{copy.help}</a>
    </footer>
  </div>
</div>

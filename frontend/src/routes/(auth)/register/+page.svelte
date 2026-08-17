<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { register, isAcademicEmail, mapAuthError } from '$lib/auth'
  import { uiState, language } from '$lib/stores/ui'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import Card from '$lib/components/Card.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { isValidEmail, isValidStudentId, isValidPassword } from '$lib/utils/cn'
  import { sanitizeInput, sanitizeName, sanitizeStudentId } from '$lib/validation'

  type Step = 'email' | 'details'

  let step: Step = 'email'
  let fullName = ''
  let email = ''
  let studentId = ''
  let password = ''
  let confirmPassword = ''
  let submitError = ''
  let loading = false

  $: academic = isAcademicEmail(email)
  $: emailValid = isValidEmail(email)
  $: studentIdValid = academic || isValidStudentId(studentId.toUpperCase())
  $: passwordValid = isValidPassword(password)
  $: passwordsMatch = password.length > 0 && password === confirmPassword
  $: fullNameValid = fullName.trim().length >= 2

  $: copy = $language === 'ar'
    ? {
        title: 'انضم إلى UNEEM',
        subtitle: 'ابدأ ببريدك الإلكتروني وسنوجهك للطريقة المناسبة.',
        email: 'البريد الإلكتروني',
        emailPlaceholder: 'name@usmba.ac.ma',
        academicBenefit: 'استخدم بريد USMBA للدخول بشكل أسرع بعد تأكيد البريد.',
        personalOption: 'ليس لديك بريد جامعي؟ يمكنك التسجيل ببريدك الشخصي.',
        continue: 'متابعة',
        back: 'رجوع',
        academicPath: 'بريد جامعي',
        academicPathHelp: 'بعد تأكيد البريد يمكنك استعمال الحجز مباشرة. سيبقى تأكيد بطاقة الطالب مطلوباً لحماية هويتك.',
        personalPath: 'بريد شخصي',
        personalPathHelp: 'يلزم رقم الطالب وبطاقة الطالب. لن يتاح الحجز حتى يراجع المشرف طلبك.',
        fullName: 'الاسم الكامل',
        fullNamePlaceholder: 'الاسم كما يظهر في بطاقتك',
        studentId: 'رقم الطالب',
        studentIdPlaceholder: 'S123456789',
        password: 'كلمة المرور',
        confirmPassword: 'تأكيد كلمة المرور',
        passwordHelp: '8 أحرف على الأقل مع حرف كبير ورقم ورمز.',
        create: 'إنشاء الحساب',
        haveAccount: 'لديك حساب؟',
        signIn: 'تسجيل الدخول',
        invalidEmail: 'أدخل بريداً إلكترونياً صحيحاً.',
        invalidName: 'أدخل اسمك الكامل.',
        invalidStudentId: 'رقم الطالب يجب أن يكون مثل S123456789.',
        invalidPassword: 'كلمة المرور لا تستوفي المتطلبات.',
        mismatch: 'كلمتا المرور غير متطابقتين.'
      }
    : {
        title: 'Join UNEEM',
        subtitle: 'Start with your email. We’ll show only the steps you need.',
        email: 'Email address',
        emailPlaceholder: 'name@usmba.ac.ma',
        academicBenefit: 'Use your USMBA email for faster verification and immediate access after email confirmation.',
        personalOption: "Don't have a university email? You can continue with a personal email.",
        continue: 'Continue',
        back: 'Back',
        academicPath: 'University email',
        academicPathHelp: 'After confirming your email, you can book immediately. Student-card verification will remain required to protect your identity.',
        personalPath: 'Personal email',
        personalPathHelp: 'Student ID and student-card verification are required. Booking stays locked until an admin approves your verification.',
        fullName: 'Full name',
        fullNamePlaceholder: 'Name as shown on your student card',
        studentId: 'Student ID',
        studentIdPlaceholder: 'S123456789',
        password: 'Password',
        confirmPassword: 'Confirm password',
        passwordHelp: 'Use 8+ characters with an uppercase letter, number and symbol.',
        create: 'Create account',
        haveAccount: 'Already have an account?',
        signIn: 'Sign in',
        invalidEmail: 'Enter a valid email address.',
        invalidName: 'Enter your full name.',
        invalidStudentId: 'Student ID should look like S123456789.',
        invalidPassword: 'Your password does not meet the requirements.',
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

    if (!fullNameValid) {
      submitError = copy.invalidName
      return
    }
    if (!studentIdValid) {
      submitError = copy.invalidStudentId
      return
    }
    if (!passwordValid) {
      submitError = copy.invalidPassword
      return
    }
    if (!passwordsMatch) {
      submitError = copy.mismatch
      return
    }

    loading = true
    try {
      const cleanFullName = sanitizeName(fullName)
      const cleanEmail = sanitizeInput(email).trim().toLowerCase()
      const cleanPassword = sanitizeInput(password)
      const cleanStudentId = academic ? null : sanitizeStudentId(studentId).toUpperCase()

      const result = await register(cleanEmail, cleanPassword, cleanStudentId, cleanFullName)
      if (result.error) {
        submitError = result.error.message
        return
      }

      uiState.addToast($language === 'ar' ? 'تم إنشاء الحساب' : 'Account created', 'success')
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

<svelte:head>
  <title>{copy.title} · UNEEM</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 py-8 bg-background">
  <button
    on:click={toggleLanguage}
    class="fixed top-4 right-4 z-50 min-w-11 h-11 px-3 rounded-full bg-surface border border-border text-sm font-semibold text-text-secondary hover:text-text transition"
    aria-label="Toggle language"
  >
    {$language === 'ar' ? 'EN' : 'ع'}
  </button>

  <div class="w-full max-w-md">
    <Card className="w-full" variant="elevated">
      <div class="space-y-6">
        <div class="space-y-2">
          {#if step === 'details'}
            <button
              type="button"
              on:click={() => { step = 'email'; submitError = '' }}
              class="inline-flex items-center gap-2 min-h-10 text-sm font-medium text-text-secondary hover:text-text"
            >
              <Icon name="arrow-left" size={16} />
              {copy.back}
            </button>
          {/if}
          <div>
            <h1 class="text-3xl font-semibold tracking-tight text-text">{copy.title}</h1>
            <p class="text-text-secondary mt-2 leading-relaxed">{copy.subtitle}</p>
          </div>
        </div>

        {#if submitError}
          <div class="rounded-2xl bg-danger-light p-4 text-danger" role="alert">
            <div class="flex items-start gap-3">
              <Icon name="alert-circle" size={20} className="flex-shrink-0 mt-0.5" />
              <p class="text-sm font-medium leading-relaxed">{submitError}</p>
            </div>
          </div>
        {/if}

        {#if step === 'email'}
          <form on:submit|preventDefault={continueFromEmail} class="space-y-5">
            <TextField
              label={copy.email}
              type="email"
              placeholder={copy.emailPlaceholder}
              bind:value={email}
              disabled={loading}
            />

            <div class="rounded-2xl bg-primary/6 p-4 space-y-2">
              <div class="flex items-start gap-3">
                <Icon name="check-circle" size={19} className="text-primary flex-shrink-0 mt-0.5" />
                <p class="text-sm text-text leading-relaxed">{copy.academicBenefit}</p>
              </div>
              <p class="text-xs text-text-secondary ps-8 leading-relaxed">{copy.personalOption}</p>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full">
              {copy.continue}
            </Button>
          </form>
        {:else}
          <div class="rounded-2xl bg-surface-level-1 p-4">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-text">{academic ? copy.academicPath : copy.personalPath}</p>
                <p class="text-sm text-text-secondary truncate mt-0.5">{email}</p>
              </div>
              <span class={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${academic ? 'bg-success' : 'bg-warning'}`}></span>
            </div>
            <p class="text-sm text-text-secondary leading-relaxed mt-3">
              {academic ? copy.academicPathHelp : copy.personalPathHelp}
            </p>
          </div>

          <form on:submit|preventDefault={submit} class="space-y-5">
            <TextField
              label={copy.fullName}
              placeholder={copy.fullNamePlaceholder}
              bind:value={fullName}
              disabled={loading}
            />

            {#if !academic}
              <TextField
                label={copy.studentId}
                placeholder={copy.studentIdPlaceholder}
                bind:value={studentId}
                disabled={loading}
              />
            {/if}

            <div class="space-y-2">
              <TextField
                label={copy.password}
                type="password"
                bind:value={password}
                disabled={loading}
              />
              <p class="text-xs text-text-muted px-1">{copy.passwordHelp}</p>
            </div>

            <TextField
              label={copy.confirmPassword}
              type="password"
              bind:value={confirmPassword}
              disabled={loading}
            />

            <Button type="submit" variant="primary" size="lg" {loading} className="w-full">
              {copy.create}
            </Button>
          </form>
        {/if}

        <div class="pt-1 text-center">
          <p class="text-sm text-text-secondary">
            {copy.haveAccount}
            <a href={loginHref} class="text-primary font-semibold hover:underline ms-1">{copy.signIn}</a>
          </p>
        </div>
      </div>
    </Card>
  </div>
</div>

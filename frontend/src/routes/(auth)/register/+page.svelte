<script lang="ts">
  import { goto } from '$app/navigation'
  import { register } from '$lib/auth'
  import { uiState, language } from '$lib/stores/ui'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import Card from '$lib/components/Card.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { isValidEmail, isValidStudentId, isValidPassword } from '$lib/utils/cn'
  import { sanitizeInput, sanitizeName, sanitizeStudentId } from '$lib/validation'
  import { supabase } from '$lib/supabaseClient'

  let fullName = ''
  let email = ''
  let studentId = ''
  let password = ''
  let confirmPassword = ''
  let submitError = ''
  let loading = false

  // Duplicate check state
  let emailDuplicateError = ''
  let studentIdDuplicateError = ''
  let checkingEmail = false
  let checkingStudentId = false

  // Password validation state
  let passwordFocused = false
  let showPasswordHints = false

  // Full name validation state
  let fullNameFocused = false

  // Confirmation validation state
  let confirmFocused = false

  // Email validation state
  let emailFocused = false

  // Student ID validation state
  let studentIdFocused = false

  // Real-time validation checks
  $: passwordLength = password.length >= 8
  $: passwordNumber = /\d/.test(password)
  $: passwordSpecial = /[!@#$%^&*()-+]/.test(password)
  $: passwordUppercase = /[A-Z]/.test(password)
  $: passwordAllMet = passwordLength && passwordNumber && passwordSpecial && passwordUppercase

  $: emailValid = isValidEmail(email)
  $: emailUsmba = email.endsWith('@usmba.ac.ma') || email.length === 0
  $: emailTouched = email.length > 0 && !emailFocused

  $: studentIdValid = isValidStudentId(studentId.toUpperCase())
  $: studentIdFormat = /^[A-Z]/.test(studentId.toUpperCase()) || studentId.length === 0
  $: studentIdDigits = /^[A-Z][0-9]{0,9}$/.test(studentId.toUpperCase()) || studentId.length === 0
  $: studentIdTouched = studentId.length > 0 && !studentIdFocused

  $: passwordsMatch = password === confirmPassword && confirmPassword.length > 0
  $: confirmTouched = confirmPassword.length > 0 && !confirmFocused

  $: fullNameValid = fullName.trim().length >= 2
  $: fullNameTouched = fullName.length > 0 && !fullNameFocused

  async function checkEmailDuplicate(value: string): Promise<string> {
    if (!value || !isValidEmail(value)) return ''
    const { data, error } = await supabase
      .rpc('check_registration_duplicate', {
        p_email: value.toLowerCase().trim(),
        p_student_id: ''
      })
    if (error) return ''
    return (data === 'email' || data === 'both') ? $_('register.error_email_exists') : ''
  }

  async function checkStudentIdDuplicate(value: string): Promise<string> {
    if (!value || !isValidStudentId(value)) return ''
    const normalized = value.replace(/\s+/g, '').toUpperCase()
    const { data, error } = await supabase
      .rpc('check_registration_duplicate', {
        p_email: '',
        p_student_id: normalized
      })
    if (error) return ''
    return (data === 'student_id' || data === 'both') ? $_('register.error_student_id_exists') : ''
  }

  async function handleEmailBlur() {
    emailFocused = false
    emailDuplicateError = ''
    if (email && isValidEmail(email) && email.endsWith('@usmba.ac.ma')) {
      checkingEmail = true
      emailDuplicateError = await checkEmailDuplicate(email)
      checkingEmail = false
    }
  }

  async function handleStudentIdBlur() {
    studentIdFocused = false
    studentIdDuplicateError = ''
    const normalized = studentId.toUpperCase()
    if (studentId && isValidStudentId(normalized)) {
      checkingStudentId = true
      studentIdDuplicateError = await checkStudentIdDuplicate(normalized)
      checkingStudentId = false
    }
  }

  function validate(): boolean {
    if (!fullName || !email || !studentId || !password || !confirmPassword) {
      return false
    }
    if (!isValidEmail(email)) {
      return false
    }
    if (!email.endsWith('@usmba.ac.ma')) {
      return false
    }
    if (!isValidStudentId(studentId.toUpperCase())) {
      return false
    }
    if (!isValidPassword(password)) {
      return false
    }
    if (password !== confirmPassword) {
      return false
    }
    return true
  }

  async function submit() {
    if (!validate()) return

    loading = true
    submitError = ''
    emailDuplicateError = ''
    studentIdDuplicateError = ''
    try {
      const cleanFullName = sanitizeName(fullName)
      const cleanEmail = sanitizeInput(email).trim().toLowerCase()
      const cleanStudentId = sanitizeStudentId(studentId).toUpperCase()
      const cleanPassword = sanitizeInput(password)

      // Pre-submit duplicate check as a safety net (single RPC call)
      const { data: dupType, error } = await supabase
        .rpc('check_registration_duplicate', {
          p_email: cleanEmail,
          p_student_id: cleanStudentId
        })
      if (error) {
        // RPC failed silently, proceed with registration (DB will catch duplicates)
      } else if (dupType === 'email' || dupType === 'both') {
        emailDuplicateError = $_('register.error_email_exists')
        submitError = $_('register.error_email_exists')
        return
      } else if (dupType === 'student_id' || dupType === 'both') {
        studentIdDuplicateError = $_('register.error_student_id_exists')
        submitError = $_('register.error_student_id_exists')
        return
      }

      const result = await register(cleanEmail, cleanPassword, cleanStudentId, cleanFullName)
      if (result.error) {
        submitError = result.error.message
        return
      }
      uiState.addToast($_('register.created'), 'success')
      await goto('/verify-email')
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || ''
      if (msg.includes('profiles_student_id_key') || (msg.includes('duplicate') && msg.includes('student'))) {
        submitError = $_('register.error_student_id_exists')
      } else if (msg.includes('user already registered') || (msg.includes('duplicate') && msg.includes('email'))) {
        submitError = $_('register.error_email_exists')
      } else {
        submitError = err?.message || $_('register.error_registration_failed')
      }
    } finally {
      loading = false
    }
  }

  function checkMark(valid: boolean, active: boolean) {
    if (!active) return 'text-text-muted'
    return valid ? 'text-success' : 'text-text-muted'
  }

  function toggleLanguage() {
    uiState.setLanguage($language === 'en' ? 'ar' : 'en')
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4 py-8">
  <!-- Language Switcher -->
  <button
    on:click={toggleLanguage}
    class="fixed top-4 right-4 z-50 flex items-center justify-center w-11 h-11 rounded-full bg-surface border border-border dark:border-white/6 hover:bg-surface-level-2 hover:border-primary/30 transition shadow-sm"
    aria-label="Toggle language"
  >
    <span class="text-lg">🌐</span>
  </button>

  <Card className="w-full max-w-md" variant="elevated">
    <div class="space-y-6">
      <div class="text-center">
        <h1 class="text-2xl font-medium font-serif text-text">{$_('register.title')}</h1>
        <p class="text-text-secondary mt-2">{$_('register.subtitle')}</p>
      </div>

      {#if submitError}
        <div class="bg-danger-light border border-danger/30 rounded-xl p-4 text-danger">
          <div class="flex items-start gap-3">
            <Icon name="alert-circle" size={20} className="text-danger flex-shrink-0 mt-0.5" />
            <div>
              <p class="font-medium text-sm">{submitError}</p>
              {#if submitError.includes('sign in') || submitError.includes('تسجيل الدخول')}
                <a href="/login" class="text-sm font-semibold mt-1 inline-block underline">
                  {$_('login.sign_in')}
                </a>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <form on:submit|preventDefault={submit} class="space-y-5">
        <!-- Full Name -->
        <TextField
          label={$_('register.full_name_label')}
          placeholder={$_('register.full_name_placeholder')}
          bind:value={fullName}
          disabled={loading}
          on:focus={() => fullNameFocused = true}
          on:blur={() => fullNameFocused = false}
        />

        <!-- Email -->
        <div class="space-y-1.5">
          <TextField
            label={$_('register.email_label')}
            type="email"
            placeholder={$_('register.email_placeholder')}
            bind:value={email}
            disabled={loading}
            error={emailDuplicateError || (email.length > 0 && (!emailValid || !emailUsmba) ? (emailValid && !emailUsmba ? $_('register.error_invalid_email_domain') : $_('register.error_invalid_email')) : '')}
            on:focus={() => { emailFocused = true; emailDuplicateError = '' }}
            on:blur={handleEmailBlur}
          />
          {#if checkingEmail}
            <div class="flex items-center gap-2 text-xs px-1">
              <Icon name="loader" size={14} className="text-text-muted animate-spin" />
              <span class="text-text-muted">{$_('register.checking_email')}</span>
            </div>
          {:else if emailFocused || (emailTouched && (!emailValid || !emailUsmba))}
            <div class="space-y-1 px-1">
              <div class="flex items-center gap-2 text-xs">
                <Icon name={emailValid ? 'check' : 'x'} size={14} className={emailValid ? 'text-success' : 'text-text-muted'} />
                <span class={emailValid ? 'text-success' : 'text-text-secondary'}>
                  {$_('register.hint_email_format')}
                </span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <Icon name={emailUsmba ? 'check' : 'x'} size={14} className={emailUsmba ? 'text-success' : 'text-text-muted'} />
                <span class={emailUsmba ? 'text-success' : 'text-text-secondary'}>
                  {$_('register.email_domain_info')}
                </span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Student ID -->
        <div class="space-y-1.5">
          <TextField
            label={$_('register.student_id_label')}
            placeholder={$_('register.student_id_placeholder')}
            bind:value={studentId}
            disabled={loading}
            error={studentIdDuplicateError || (studentId.length > 0 && !studentIdValid ? $_('register.error_invalid_student') : '')}
            on:focus={() => { studentIdFocused = true; studentIdDuplicateError = '' }}
            on:blur={handleStudentIdBlur}
          />
          {#if checkingStudentId}
            <div class="flex items-center gap-2 text-xs px-1">
              <Icon name="loader" size={14} className="text-text-muted animate-spin" />
              <span class="text-text-muted">{$_('register.checking_student_id')}</span>
            </div>
          {:else if studentIdFocused || (studentIdTouched && !studentIdValid)}
            <div class="space-y-1 px-1">
              <div class="flex items-center gap-2 text-xs">
                <Icon name={studentIdFormat ? 'check' : 'x'} size={14} className={studentIdFormat ? 'text-success' : 'text-text-muted'} />
                <span class={studentIdFormat ? 'text-success' : 'text-text-secondary'}>
                  {$_('register.hint_id_start')}
                </span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <Icon name={studentIdDigits ? 'check' : 'x'} size={14} className={studentIdDigits ? 'text-success' : 'text-text-muted'} />
                <span class={studentIdDigits ? 'text-success' : 'text-text-secondary'}>
                  {$_('register.hint_id_digits')}
                </span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Password -->
        <div class="space-y-1.5">
          <TextField
            label={$_('register.password_label')}
            type="password"
            placeholder={$_('register.password_placeholder')}
            bind:value={password}
            disabled={loading}
            error={password.length > 0 && !passwordAllMet ? $_('register.error_password_short') : ''}
            on:focus={() => { passwordFocused = true; showPasswordHints = true }}
            on:blur={() => { passwordFocused = false }}
          />
          {#if showPasswordHints}
            <div class="bg-surface-level-1/50 rounded-lg p-3 space-y-1.5 dark:bg-surface-level-1">
              <p class="text-xs font-medium text-text-secondary mb-2">{$_('register.password_requirements')}</p>
              <div class="flex items-center gap-2 text-xs">
                <Icon name={passwordLength ? 'check' : 'x'} size={14} className={checkMark(passwordLength, passwordFocused || password.length > 0)} />
                <span class={passwordLength ? 'text-success' : 'text-text-secondary'}>
                  {$_('register.hint_password_length')}
                </span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <Icon name={passwordUppercase ? 'check' : 'x'} size={14} className={checkMark(passwordUppercase, passwordFocused || password.length > 0)} />
                <span class={passwordUppercase ? 'text-success' : 'text-text-secondary'}>
                  {$_('register.hint_password_uppercase')}
                </span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <Icon name={passwordNumber ? 'check' : 'x'} size={14} className={checkMark(passwordNumber, passwordFocused || password.length > 0)} />
                <span class={passwordNumber ? 'text-success' : 'text-text-secondary'}>
                  {$_('register.hint_password_number')}
                </span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <Icon name={passwordSpecial ? 'check' : 'x'} size={14} className={checkMark(passwordSpecial, passwordFocused || password.length > 0)} />
                <span class={passwordSpecial ? 'text-success' : 'text-text-secondary'}>
                  {$_('register.hint_password_special')}
                </span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Confirm Password -->
        <div class="space-y-1.5">
          <TextField
            label={$_('register.confirm_password_label')}
            type="password"
            placeholder={$_('register.confirm_password_placeholder')}
            bind:value={confirmPassword}
            disabled={loading}
            error={confirmFocused && confirmPassword.length > 0 && !passwordsMatch ? $_('register.error_password_mismatch') : ''}
            on:focus={() => confirmFocused = true}
            on:blur={() => confirmFocused = false}
          />
          {#if confirmTouched || (confirmFocused && confirmPassword.length > 0)}
            <div class="flex items-center gap-2 text-xs px-1">
              <Icon name={passwordsMatch ? 'check' : 'x'} size={14} className={passwordsMatch ? 'text-success' : 'text-danger'} />
              <span class={passwordsMatch ? 'text-success' : 'text-text-secondary'}>
                {$_('register.hint_password_match')}
              </span>
            </div>
          {/if}
        </div>

        <Button type="submit" variant="primary" size="lg" {loading} className="w-full">
          {loading ? $_('common.loading') : $_('register.create_button')}
        </Button>
      </form>

      <div class="text-center">
        <p class="text-text-secondary">
          {$_('register.have_account')}
          <a href="/login" class="text-primary font-semibold hover:underline">
            {$_('register.sign_in')}
          </a>
        </p>
      </div>
    </div>
  </Card>
</div>

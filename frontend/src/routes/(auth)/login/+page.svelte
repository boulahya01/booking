<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import Button from '$lib/components/Button.svelte'
  import Card from '$lib/components/Card.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { uiState, language } from '$lib/stores/ui'
  import { authState, isAuthenticated } from '$lib/stores/auth'
  import { loginWithEmail, loginWithStudentId } from '$lib/auth'
  import { isValidEmail, isValidStudentId } from '$lib/utils/cn'
  import { sanitizeInput, sanitizeStudentId } from '$lib/validation'
  import { _ } from 'svelte-i18n'

  let mode: 'email' | 'student_id' = 'email'
  let email = ''
  let studentId = ''
  let password = ''
  let loading = false
  let errors: Record<string, string> = {}

  onMount(() => {
    if ($isAuthenticated) {
      goto('/home')
    }
  })

  function toggleLanguage() {
    uiState.setLanguage($language === 'en' ? 'ar' : 'en')
  }

  function validate() {
    errors = {}
    if (mode === 'email') {
      if (!email) errors.email = $_('login.error_email_required')
      else if (!isValidEmail(email)) errors.email = $_('login.error_invalid_email')
    } else {
      if (!studentId) errors.studentId = $_('login.error_student_required')
      else if (!isValidStudentId(studentId)) errors.studentId = $_('login.error_invalid_student')
    }
    if (!password) errors.password = $_('login.error_password_required')
    return Object.keys(errors).length === 0
  }

  async function handleLogin() {
    if (!validate()) return

    loading = true
    authState.setLoading(true)

    // Sanitize inputs before submission
    const cleanEmail = sanitizeInput(email).trim().toLowerCase()
    const cleanStudentId = sanitizeStudentId(studentId).toUpperCase()
    // Do NOT sanitize password - sanitizeInput trims whitespace which alters passwords

    try {
      const result =
        mode === 'email'
          ? await loginWithEmail(cleanEmail, password)
          : await loginWithStudentId(cleanStudentId, password)

      if (result.error) {
        throw new Error('Invalid credentials. Please check your information and try again.')
      }

      const profile = result.data?.profile
      if (!profile) {
        throw new Error('Profile not found')
      }

      authState.setUser({
        id: profile.id,
        email: result.data.user?.email,
        student_id: profile.student_id,
        full_name: profile.full_name,
        role: profile.role === 'admin' ? 'admin' : 'user',
        status: profile.status
      })

      uiState.addToast('Logged in successfully!', 'success')

      if (profile.status === 'pending') {
        goto('/pending-approval')
      } else if (profile.status === 'rejected') {
        goto('/pending-approval')
      } else {
        goto('/home')
      }
    } catch (error: any) {
      authState.setError(error.message || 'Login failed')
      uiState.addToast(error.message || $_('login.error_login_failed'), 'error')
    } finally {
      loading = false
      authState.setLoading(false)
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4 py-8">
  <!-- Language Switcher -->
  <button
    on:click={toggleLanguage}
    class="fixed top-4 right-4 z-50 flex items-center justify-center w-11 h-11 rounded-full bg-surface border border-border dark:border-white/6 hover:bg-surface-level-2 hover:border-primary/30 transition shadow-sm"
    aria-label="Toggle language"
  >
    <span class="text-lg">{$language === 'en' ? '🌐' : '🌐'}</span>
  </button>

  <Card className="w-full max-w-md" variant="elevated">
    <div class="space-y-6">
      <!-- Header -->
      <div class="text-center space-y-2">
        <h1 class="text-2xl font-medium font-serif text-text">{$_('login.title')}</h1>
        <p class="text-text-secondary">{$_('login.subtitle')}</p>
      </div>

      <!-- Mode Selector -->
      <div class="flex gap-2">
        <button
          on:click={() => (mode = 'email')}
          class={`flex-1 py-2 px-3 rounded-lg font-medium transition min-h-[44px] ${
            mode === 'email'
              ? 'bg-primary text-white'
              : 'bg-surface-level-1 text-text-secondary border border-border hover:bg-surface-level-2'
          }`}
        >
          {$_('login.email_tab')}
        </button>
        <button
          on:click={() => (mode = 'student_id')}
          class={`flex-1 py-2 px-3 rounded-lg font-medium transition min-h-[44px] ${
            mode === 'student_id'
              ? 'bg-primary text-white'
              : 'bg-surface-level-1 text-text-secondary border border-border hover:bg-surface-level-2'
          }`}
        >
          {$_('login.student_id_tab')}
        </button>
      </div>

      <!-- Form -->
      <form on:submit|preventDefault={handleLogin} class="space-y-4">
        {#if mode === 'email'}
          <TextField
            label={$_('login.email_label')}
            type="email"
            placeholder={$_('login.email_placeholder')}
            bind:value={email}
            error={errors.email}
            required
          />
        {:else}
          <TextField
            label={$_('login.student_id_label')}
            type="text"
            placeholder={$_('login.student_id_placeholder')}
            bind:value={studentId}
            error={errors.studentId}
            required
          />
        {/if}

        <TextField
          label={$_('login.password_label')}
          type="password"
          placeholder={$_('login.password_placeholder')}
          bind:value={password}
          error={errors.password}
          required
        />

        <Button type="submit" variant="primary" size="lg" {loading} className="w-full">
          {$_('login.sign_in')}
        </Button>
      </form>

      <!-- Links -->
      <div class="space-y-3 text-sm text-center">
        <div>
          <a
            href="/forgot-password"
            class="text-primary hover:text-primary-hover font-medium"
          >
            {$_('login.forgot_password')}
          </a>
        </div>
        <div class="text-text-secondary">
          {$_('login.no_account')}
          <a
            href="/register"
            class="text-primary hover:text-primary-hover font-medium"
          >
            {$_('login.sign_up')}
          </a>
        </div>
      </div>
    </div>
  </Card>
</div>

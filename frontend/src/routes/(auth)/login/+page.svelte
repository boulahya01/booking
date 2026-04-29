<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import Button from '$lib/components/Button.svelte'
  import Card from '$lib/components/Card.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { uiState, language } from '$lib/stores/ui'
  import { authState, isAuthenticated } from '$lib/stores/auth'
  import { loginWithEmail } from '$lib/auth'
  import { isValidEmail } from '$lib/utils/cn'
  import { sanitizeInput } from '$lib/validation'
  import { _ } from 'svelte-i18n'

  let email = ''
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
    if (!email) errors.email = $_('login.error_email_required')
    else if (!isValidEmail(email)) errors.email = $_('login.error_invalid_email')
    if (!password) errors.password = $_('login.error_password_required')
    return Object.keys(errors).length === 0
  }

  async function handleLogin() {
    if (!validate()) return

    loading = true
    authState.setLoading(true)

    const cleanEmail = sanitizeInput(email).trim().toLowerCase()

    try {
      const result = await loginWithEmail(cleanEmail, password)

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

      // Route based on profile status
      if (profile.status === 'rejected') {
        goto('/pending-approval')
      } else if (profile.status === 'pending') {
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

      <!-- Form -->
      <form on:submit|preventDefault={handleLogin} class="space-y-4">
        <TextField
          label={$_('login.email_label')}
          type="email"
          placeholder={$_('login.email_placeholder')}
          bind:value={email}
          error={errors.email}
          required
        />

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

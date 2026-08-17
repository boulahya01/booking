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
  import { classifyAuthFailure, type AuthFailureKind } from '$lib/ux/authFailure'
  import { _ } from 'svelte-i18n'

  let email = ''
  let password = ''
  let loading = false
  let errors: Record<string, string> = {}
  let submitError = ''
  let authFailureKind: AuthFailureKind | null = null

  $: authEmailQuery = isValidEmail(email)
    ? `?email=${encodeURIComponent(email.trim().toLowerCase())}`
    : ''

  onMount(() => {
    const hintedEmail = new URLSearchParams(window.location.search).get('email')
    if (hintedEmail && isValidEmail(hintedEmail)) {
      email = hintedEmail.trim().toLowerCase()
    }

    if ($isAuthenticated) goto('/home')
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

  function getLoginErrorMessage(kind: AuthFailureKind): string {
    if (kind === 'rate_limited') return $_('verify_email.resend_error_rate_limit')
    if (kind === 'network' || kind === 'profile_missing') return $_('register.error_support_contact')
    return $_('login.error_login_failed')
  }

  async function handleLogin() {
    if (!validate()) return

    loading = true
    submitError = ''
    authFailureKind = null
    authState.setLoading(true)

    const cleanEmail = sanitizeInput(email).trim().toLowerCase()

    try {
      const result = await loginWithEmail(cleanEmail, password)

      if (result.error) {
        authFailureKind = classifyAuthFailure(result.error.message)
        submitError = getLoginErrorMessage(authFailureKind)
        authState.setError(submitError)
        return
      }

      const profile = result.data?.profile
      if (!profile) {
        authFailureKind = 'profile_missing'
        submitError = getLoginErrorMessage(authFailureKind)
        authState.setError(submitError)
        return
      }

      authState.setUser({
        id: profile.id,
        email: result.data.user?.email,
        student_id: profile.student_id,
        full_name: profile.full_name,
        role: profile.role === 'admin' ? 'admin' : 'user',
        status: profile.status
      })

      uiState.addToast($_('common.success'), 'success')

      if (profile.status === 'pending' || profile.status === 'suspended') {
        await goto('/pending-approval')
      } else {
        await goto('/home')
      }
    } catch (error: any) {
      authFailureKind = classifyAuthFailure(error?.message, error?.status)
      submitError = getLoginErrorMessage(authFailureKind)
      authState.setError(submitError)
    } finally {
      loading = false
      authState.setLoading(false)
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4 py-8">
  <button
    on:click={toggleLanguage}
    class="fixed top-4 right-4 z-50 flex items-center justify-center w-11 h-11 rounded-full bg-surface border border-border dark:border-white/6 hover:bg-surface-level-2 hover:border-primary/30 transition shadow-sm"
    aria-label="Toggle language"
  >
    <span class="text-lg">🌐</span>
  </button>

  <Card className="w-full max-w-md" variant="elevated">
    <div class="space-y-6">
      <div class="text-center space-y-2">
        <h1 class="text-2xl font-medium font-serif text-text">{$_('login.title')}</h1>
        <p class="text-text-secondary">{$_('login.subtitle')}</p>
      </div>

      {#if submitError}
        <div class="bg-danger-light border border-danger/30 rounded-xl p-4 text-danger" role="alert">
          <div class="flex items-start gap-3">
            <Icon name="alert-circle" size={20} className="text-danger flex-shrink-0 mt-0.5" />
            <div class="min-w-0 flex-1 space-y-3">
              <p class="font-medium text-sm">{submitError}</p>

              {#if authFailureKind === 'invalid_credentials'}
                <div class="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  <a href={`/forgot-password${authEmailQuery}`} class="font-semibold underline">{$_('login.forgot_password')}</a>
                  <a href={`/register${authEmailQuery}`} class="font-semibold underline">{$_('register.create_button')}</a>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <form on:submit|preventDefault={handleLogin} class="space-y-4">
        <TextField
          label={$_('login.email_label')}
          type="email"
          placeholder={$_('login.email_placeholder')}
          bind:value={email}
          error={errors.email}
          disabled={loading}
          required
        />

        <TextField
          label={$_('login.password_label')}
          type="password"
          placeholder={$_('login.password_placeholder')}
          bind:value={password}
          error={errors.password}
          disabled={loading}
          required
        />

        <Button type="submit" variant="primary" size="lg" {loading} className="w-full">{$_('login.sign_in')}</Button>
      </form>

      <div class="space-y-3 text-sm text-center">
        <div>
          <a href={`/forgot-password${authEmailQuery}`} class="text-primary hover:text-primary-hover font-medium">{$_('login.forgot_password')}</a>
        </div>
        <p class="text-text-secondary">
          {$_('login.no_account')}
          <a href={`/register${authEmailQuery}`} class="text-primary font-semibold hover:underline">{$_('login.create_account')}</a>
        </p>
      </div>
    </div>
  </Card>
</div>

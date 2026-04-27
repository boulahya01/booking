<script lang="ts">
  import Card from '$lib/components/Card.svelte'
  import Button from '$lib/components/Button.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { resetPasswordForEmail } from '$lib/auth'
  import { _ } from 'svelte-i18n'
  import { isValidEmail } from '$lib/utils/cn'

  let email = ''
  let error = ''
  let loading = false
  let emailSent = false

  // Rate limiting: max 3 attempts per 5 minutes
  const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
  const RATE_LIMIT_MAX_ATTEMPTS = 3
  let attemptTimestamps: number[] = []

  function checkRateLimit(): boolean {
    const now = Date.now()
    // Remove timestamps outside the window
    attemptTimestamps = attemptTimestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
    if (attemptTimestamps.length >= RATE_LIMIT_MAX_ATTEMPTS) {
      const oldestInWindow = attemptTimestamps[0]
      const remainingMs = RATE_LIMIT_WINDOW_MS - (now - oldestInWindow)
      const remainingMin = Math.ceil(remainingMs / 60000)
      error = `Too many attempts. Please try again in ${remainingMin} minute${remainingMin > 1 ? 's' : ''}.`
      return false
    }
    return true
  }

  function recordAttempt() {
    attemptTimestamps.push(Date.now())
  }

  function validateEmail(value: string) {
    if (!value) {
      error = $_('forgot_password.error_email_required')
      return false
    }
    if (!isValidEmail(value)) {
      error = $_('forgot_password.error_invalid_email')
      return false
    }
    return true
  }

  async function handleSubmit() {
    error = ''

    if (!validateEmail(email)) {
      return
    }

    if (!checkRateLimit()) {
      return
    }

    loading = true
    recordAttempt()
    const result = await resetPasswordForEmail(email)
    loading = false

    if (result.error) {
      error = result.error.message
    } else {
      emailSent = true
      email = ''
    }
  }

  function handleReset() {
    emailSent = false
    email = ''
    error = ''
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4 py-8">
  <Card className="w-full max-w-md" variant="elevated">
    <div class="space-y-6">
      {#if emailSent}
        <div class="text-center space-y-4">
          <div class="mx-auto w-14 h-14 rounded-full bg-success-light flex items-center justify-center text-success">
            <Icon name="check" size={28} />
          </div>
          <h1 class="text-2xl font-medium font-serif text-text">{$_('forgot_password.email_sent_title')}</h1>
          <p class="text-text-secondary">{$_('forgot_password.email_sent_subtitle')}</p>
          <div class="bg-success-light border border-success/20 text-success p-3 rounded-lg text-sm">
            {$_('forgot_password.email_sent_instruction')}
          </div>
          <Button variant="primary" className="w-full" on:click={handleReset}>
            {$_('forgot_password.send_another_email')}
          </Button>
          <p class="text-sm text-text-secondary">
            {$_('forgot_password.back_to_login')}
            <a href="/login" class="text-primary font-semibold hover:underline inline-flex items-center gap-1">
              {$_('forgot_password.login_here')}
              <Icon name="arrow-right" size={14} />
            </a>
          </p>
        </div>
      {:else}
        <div class="text-center space-y-2">
          <div class="mx-auto w-12 h-12 rounded-full bg-primary-light flex items-center justify-center text-primary mb-3">
            <Icon name="mail" size={24} />
          </div>
          <h1 class="text-2xl font-medium font-serif text-text">{$_('forgot_password.title')}</h1>
          <p class="text-text-secondary">{$_('forgot_password.subtitle')}</p>
        </div>

        {#if error}
          <div class="bg-danger-light border border-danger/20 text-danger p-3 rounded-lg text-sm">{error}</div>
        {/if}

        <form on:submit|preventDefault={handleSubmit} class="space-y-4">
          <TextField
            label={$_('forgot_password.email_label')}
            type="email"
            placeholder={$_('login.email_placeholder')}
            bind:value={email}
            disabled={loading}
            required
          />

          <Button type="submit" variant="primary" size="lg" {loading} className="w-full">
            {loading ? $_('common.loading') : $_('forgot_password.send_reset_link')}
          </Button>
        </form>

        <p class="text-sm text-center text-text-secondary">
          {$_('forgot_password.remember_password')}
          <a href="/login" class="text-primary font-semibold hover:underline inline-flex items-center gap-1">
            {$_('forgot_password.login_here')}
            <Icon name="arrow-right" size={14} />
          </a>
        </p>
      {/if}
    </div>
  </Card>
</div>

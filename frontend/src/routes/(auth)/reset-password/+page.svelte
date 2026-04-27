<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import Card from '$lib/components/Card.svelte'
  import Button from '$lib/components/Button.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import { resetPasswordForEmail, updatePassword } from '$lib/auth'
  import { uiState } from '$lib/stores/ui'
  import { _ } from 'svelte-i18n'
  import { isValidEmail, isValidPassword } from '$lib/utils/cn'

  let email = ''
  let newPassword = ''
  let confirmPassword = ''
  let mode: 'request' | 'reset' = 'request'
  let loading = false
  let error = ''
  let success = ''

  // Check for recovery mode in URL (supports both hash fragments and query params)
  $: {
    const hash = $page.url.hash
    const search = $page.url.search
    if (
      (hash && hash.includes('type=recovery')) ||
      (search && search.includes('type=recovery'))
    ) {
      mode = 'reset'
    }
  }

  async function handleRequest() {
    error = ''
    success = ''
    if (!email || !isValidEmail(email)) {
      error = $_('reset_password.error_invalid_email')
      return
    }
    loading = true
    const result = await resetPasswordForEmail(email)
    loading = false
    if (result.error) {
      error = result.error.message
    } else {
      success = $_('reset_password.success_sent')
      email = ''
    }
  }

  async function handleReset() {
    error = ''
    success = ''
    if (!newPassword || !confirmPassword) {
      error = $_('reset_password.error_required')
      return
    }
    if (newPassword !== confirmPassword) {
      error = $_('reset_password.error_mismatch')
      return
    }
    if (!isValidPassword(newPassword)) {
      error = $_('reset_password.error_password_invalid')
      return
    }
    loading = true
    const result = await updatePassword(newPassword)
    loading = false
    if (result.error) {
      error = result.error.message
    } else {
      success = $_('reset_password.success_updated')
      uiState.addToast(success, 'success')
      setTimeout(() => goto('/login'), 2000)
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4 py-8">
  <Card className="w-full max-w-md" variant="elevated">
    <div class="space-y-6">
      <div class="text-center">
        <h1 class="text-2xl font-medium font-serif text-text">{$_('reset_password.title')}</h1>
        <p class="text-text-secondary mt-2">
          {mode === 'request' ? $_('reset_password.subtitle_request') : $_('reset_password.subtitle_reset')}
        </p>
      </div>

      {#if success}
        <div class="bg-success-light border border-success/20 text-success p-3 rounded-lg text-sm">{success}</div>
      {/if}
      {#if error}
        <div class="bg-danger-light border border-danger/20 text-danger p-3 rounded-lg text-sm">{error}</div>
      {/if}

      {#if mode === 'request'}
        <form on:submit|preventDefault={handleRequest} class="space-y-4">
          <TextField
            label={$_('reset_password.email_label')}
            type="email"
            placeholder={$_('login.email_placeholder')}
            bind:value={email}
            disabled={loading || !!success}
          />
          <Button type="submit" variant="primary" size="lg" {loading} className="w-full">
            {loading ? $_('common.loading') : $_('reset_password.send_link')}
          </Button>
        </form>
      {:else}
        <form on:submit|preventDefault={handleReset} class="space-y-4">
          <TextField
            label={$_('reset_password.new_password_label')}
            type="password"
            placeholder={$_('register.password_placeholder')}
            bind:value={newPassword}
            disabled={loading}
          />
          <TextField
            label={$_('reset_password.confirm_password_label')}
            type="password"
            placeholder={$_('register.confirm_password_placeholder')}
            bind:value={confirmPassword}
            disabled={loading}
          />
          <Button type="submit" variant="primary" size="lg" {loading} className="w-full">
            {loading ? $_('reset_password.updating') : $_('reset_password.update_password')}
          </Button>
        </form>
      {/if}

      <div class="text-center">
        <a href="/login" class="text-primary font-semibold hover:underline">
          {$_('reset_password.back_to_login')}
        </a>
      </div>
    </div>
  </Card>
</div>

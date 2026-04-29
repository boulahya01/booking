<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { supabase } from '$lib/supabaseClient'
  import Card from '$lib/components/Card.svelte'
  import Button from '$lib/components/Button.svelte'
  import { uiState } from '$lib/stores/ui'
  import { authState } from '$lib/stores/auth'
  import { getUserProfile } from '$lib/auth'
  import { _ } from 'svelte-i18n'
  import Icon from '$lib/components/Icon.svelte'

  let status: 'waiting' | 'verifying' | 'success' | 'error' = 'waiting'
  let errorMessage = ''
  let resendLoading = false
  let resendError = ''

  function getErrorMessage(raw: string): string {
    const msg = raw.toLowerCase()
    if (msg.includes('expired') || msg.includes('token')) {
      return $_('verify_email.error_expired_token')
    }
    if (msg.includes('invalid')) {
      return $_('verify_email.error_invalid_link')
    }
    return $_('verify_email.error_generic')
  }

  onMount(async () => {
    const token = $page.url.searchParams.get('token')
    if (token) {
      status = 'verifying'
      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'email'
        })
        if (error) {
          status = 'error'
          errorMessage = getErrorMessage(error.message)
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const profile = await getUserProfile(user.id)
          if (profile) {
            authState.setUser({
              id: profile.id,
              email: user.email ?? undefined,
              student_id: profile.student_id,
              full_name: profile.full_name,
              role: profile.role === 'admin' ? 'admin' : 'user',
              status: profile.status as import('$lib/stores/auth').UserStatus
            })
          }
        }

        status = 'success'
        uiState.addToast($_('verify_email.verified_subtitle'), 'success')
        setTimeout(() => goto('/home'), 2000)
      } catch (err: any) {
        status = 'error'
        errorMessage = getErrorMessage(err.message || '')
      }
    }
  })

  async function resendEmail() {
    resendLoading = true
    resendError = ''
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        resendError = $_('verify_email.error_no_email')
        return
      }
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email
      })
      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('rate limit') || msg.includes('too many')) {
          resendError = $_('verify_email.resend_error_rate_limit')
        } else {
          resendError = $_('verify_email.resend_error_generic')
        }
        return
      }
      uiState.addToast($_('verify_email.resend_success'), 'success')
    } catch (err: any) {
      resendError = $_('verify_email.resend_error_generic')
    } finally {
      resendLoading = false
    }
  }

  function getErrorIcon(s: string) {
    if (s === 'error') return 'x-circle'
    if (s === 'success') return 'check-circle'
    if (s === 'verifying') return 'loader'
    return 'mail'
  }
</script>

<svelte:head>
  <title>{status === 'waiting' ? $_('verify_email.title') : status === 'success' ? $_('verify_email.verified_title') : status === 'error' ? $_('verify_email.error_title') : $_('verify_email.verifying')} - UnemBook</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 py-8">
  <Card className="w-full max-w-md" variant="elevated">
    <div class="text-center">
      {#if status === 'waiting'}
        <!-- WAITING state -->
        <div class="space-y-6">
          <div class="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style="background: var(--info-light);">
            <Icon name="mail" size={36} className="text-info" />
          </div>
          <div>
            <h1 class="text-2xl font-medium font-serif text-text">{$_('verify_email.title')}</h1>
            <p class="text-text-secondary mt-2">{$_('verify_email.subtitle')}</p>
          </div>

          <div class="rounded-xl p-4 text-sm" style="background: var(--surface-level-1);">
            <div class="flex items-start gap-3">
              <Icon name="info" size={18} className="text-info mt-0.5 flex-shrink-0" />
              <p class="text-text-secondary text-left">{$_('verify_email.spam_note')}</p>
            </div>
          </div>

          <Button
            on:click={resendEmail}
            loading={resendLoading}
            variant="secondary"
            className="w-full"
          >
            {$_('verify_email.resend')}
          </Button>

          <a href="/login" class="text-primary font-semibold hover:underline">
            {$_('login.sign_in')}
          </a>
        </div>

      {:else if status === 'verifying'}
        <!-- VERIFYING state -->
        <div class="space-y-6 py-8">
          <div class="w-20 h-20 mx-auto relative">
            <div class="absolute inset-0 rounded-full border-4" style="border-color: var(--border);"></div>
            <div class="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <Icon name="mail" size={28} className="text-primary" />
            </div>
          </div>
          <div>
            <h1 class="text-2xl font-medium font-serif text-text">{$_('verify_email.verifying')}</h1>
            <p class="text-text-secondary mt-2">{$_('verify_email.please_wait')}</p>
          </div>
        </div>

      {:else if status === 'success'}
        <!-- SUCCESS state -->
        <div class="space-y-6 py-4">
          <div class="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style="background: var(--success-light);">
            <Icon name="check-circle" size={36} className="text-success" />
          </div>
          <div>
            <h1 class="text-2xl font-medium font-serif text-success">{$_('verify_email.verified_title')}</h1>
            <p class="text-text-secondary mt-2">{$_('verify_email.verified_subtitle')}</p>
          </div>

          <div class="rounded-xl p-4" style="background: var(--surface-level-1);">
            <div class="flex items-center gap-3 justify-center">
              <div class="w-6 h-6 rounded-full flex items-center justify-center" style="background: var(--border);">
                <Icon name="clock" size={14} className="text-text-muted" />
              </div>
              <p class="text-sm text-text-muted">{$_('verify_email.verified_redirect')}</p>
            </div>
          </div>
        </div>

      {:else if status === 'error'}
        <!-- ERROR state -->
        <div class="space-y-6">
          <div class="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style="background: var(--danger-light);">
            <Icon name="x-circle" size={36} className="text-danger" />
          </div>
          <div>
            <h1 class="text-2xl font-medium font-serif text-danger">{$_('verify_email.error_title')}</h1>
            <p class="text-text-secondary mt-2">{$_('verify_email.error_subtitle')}</p>
          </div>

          {#if errorMessage}
            <div class="rounded-xl p-4 text-sm" style="background: var(--danger-light);">
              <div class="flex items-start gap-3 text-left">
                <Icon name="alert-triangle" size={18} className="text-danger mt-0.5 flex-shrink-0" />
                <p class="text-danger font-medium">{errorMessage}</p>
              </div>
            </div>
          {/if}

          {#if resendError}
            <div class="rounded-xl p-3 text-sm" style="background: var(--danger-light);">
              <div class="flex items-start gap-2 text-left">
                <Icon name="alert-circle" size={16} className="text-danger mt-0.5 flex-shrink-0" />
                <p class="text-danger">{resendError}</p>
              </div>
            </div>
          {/if}

          <div class="space-y-3">
            <Button
              on:click={resendEmail}
              loading={resendLoading}
              variant="primary"
              className="w-full"
            >
              {$_('verify_email.try_again')}
            </Button>
            <a href="/login" class="block">
              <Button variant="secondary" className="w-full">
                {$_('verify_email.back_to_login')}
              </Button>
            </a>
          </div>
        </div>
      {/if}
    </div>
  </Card>
</div>

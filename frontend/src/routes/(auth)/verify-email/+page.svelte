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
  let message = ''
  let resendLoading = false

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
          message = error.message
          return
        }

        // Email verified - now reload profile to get updated status from the trigger
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
        uiState.addToast('Email verified! Your account is now approved.', 'success')
        setTimeout(() => goto('/home'), 2000)
      } catch (err: any) {
        status = 'error'
        message = err.message || $_('verify_email.error_generic')
      }
    }
  })

  async function resendEmail() {
    resendLoading = true
    message = ''
    try {
      // Try to get user from current session first
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        // If no session, the user may need to check their email or try logging in
        message = $_('verify_email.error_no_email')
        resendLoading = false
        return
      }
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email
      })
      if (error) {
        message = error.message
        resendLoading = false
        return
      }
      uiState.addToast($_('verify_email.resend_success'), 'success')
    } catch (err: any) {
      message = err.message || $_('verify_email.error_generic')
    } finally {
      resendLoading = false
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4 py-8">
  <Card className="w-full max-w-md text-center" variant="elevated">
    {#if status === 'waiting'}
      <div class="space-y-4">
        <h1 class="text-2xl font-medium font-serif text-text">{$_('verify_email.title')}</h1>
        <p class="text-text-secondary">{$_('verify_email.subtitle')}</p>
        <div class="bg-info-light border border-primary/10 p-4 rounded-lg text-sm text-text-secondary">
          <p>{$_('verify_email.spam_note')}</p>
          <Button
            on:click={resendEmail}
            loading={resendLoading}
            variant="secondary"
            className="mt-3 w-full"
          >
            {$_('verify_email.resend')}
          </Button>
        </div>
        <a href="/login" class="inline-block text-primary hover:underline font-semibold mt-4">
          {$_('login.sign_in')}
        </a>
      </div>
    {:else if status === 'verifying'}
      <div class="space-y-4">
        <h1 class="text-2xl font-medium font-serif text-text">{$_('verify_email.verifying')}</h1>
        <p class="text-text-secondary">{$_('verify_email.please_wait')}</p>
      </div>
    {:else if status === 'success'}
      <div class="space-y-4">
        <h1 class="text-2xl font-medium font-serif text-success">{$_('verify_email.verified_title')}</h1>
        <p class="text-text-secondary">{$_('verify_email.verified_redirect')}</p>
      </div>
    {:else if status === 'error'}
      <div class="space-y-4">
        <h1 class="text-2xl font-medium font-serif text-danger">{$_('verify_email.error_title')}</h1>
        <p class="text-text-secondary">{message}</p>
        <div class="flex gap-3">
          <Button on:click={resendEmail} loading={resendLoading} className="flex-1">
            {$_('verify_email.try_again')}
          </Button>
          <a href="/login" class="flex-1">
            <Button variant="secondary" className="w-full">{$_('verify_email.back_to_login')}</Button>
          </a>
        </div>
      </div>
    {/if}
  </Card>
</div>

<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase, getSocialProviders, type SocialProvider } from '$lib/supabaseClient'
  import { emailConfirmationRedirectUrl, clearPasswordRecovery } from '$lib/authFlow'
  import { language } from '$lib/stores/ui'
  import Button from './Button.svelte'

  export let disabled = false
  export let busy = false

  let providers = { google: false }
  let loading = true
  let disposed = false
  let pending: SocialProvider | null = null
  let error = ''

  $: ar = $language === 'ar'

  onMount(() => {
    void getSocialProviders().then((value) => {
      if (!disposed) {
        providers = value
        loading = false
      }
    })

    return () => {
      disposed = true
    }
  })

  async function signIn(provider: SocialProvider) {
    if (pending || disabled || !providers[provider]) return

    pending = provider
    busy = true
    error = ''

    try {
      clearPasswordRecovery()
      const { error: failure } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: emailConfirmationRedirectUrl() }
      })
      if (failure) throw failure
    } catch {
      if (!disposed) {
        error = ar ? 'تعذر بدء تسجيل الدخول. حاول مجدداً.' : 'Couldn’t start sign-in. Try again.'
        pending = null
        busy = false
      }
    }
  }
</script>

<div class="social-sign-in" aria-busy={loading}>
  {#if loading || providers.google}
    <Button
      variant="secondary"
      fullWidth
      disabled={disabled || loading || !providers.google || pending !== null}
      loading={pending === 'google'}
      on:click={() => signIn('google')}
    >
      {ar ? 'المتابعة باستخدام Google' : 'Continue with Google'}
    </Button>

    <div class="auth-divider" aria-hidden="true">
      <span></span>
      <p>{ar ? 'أو بالبريد الإلكتروني' : 'or with email'}</p>
      <span></span>
    </div>
  {/if}

  {#if error}
    <p role="alert" class="mt-3 text-sm text-danger">{error}</p>
  {/if}
</div>

<style>
  .auth-divider {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 24px 0;
  }

  .auth-divider span {
    height: 1px;
    background: var(--border);
    flex: 1;
  }

  .auth-divider p {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }
</style>

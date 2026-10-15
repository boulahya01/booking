<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase, getSocialProviders, type SocialProvider, type SocialProviders } from '$lib/supabaseClient'
  import { emailConfirmationRedirectUrl, clearPasswordRecovery } from '$lib/authFlow'
  import { language } from '$lib/stores/ui'
  import Button from './Button.svelte'

  export let disabled = false
  export let busy = false

  let providers: SocialProviders = { google: null }
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
    if (pending || disabled || loading || providers[provider] === false) return

    pending = provider
    busy = true
    error = ''

    try {
      if (providers[provider] === null) {
        providers = await getSocialProviders()
        if (disposed) return
        if (providers[provider] !== true) throw new Error('provider_unavailable')
      }
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
  {#if loading || providers.google !== false}
    <Button
      variant="secondary"
      className="google-sign-in"
      fullWidth
      disabled={disabled || loading || pending !== null}
      loading={pending === 'google'}
      on:click={() => signIn('google')}
    >
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" class="google-mark">
        <path fill="#4285f4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4.1 6v5h6.6c3.9-3.6 6.1-8.8 6.1-14.7Z" />
        <path fill="#34a853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2C9.2 39.4 16.1 44 24 44Z" />
        <path fill="#fbbc05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z" />
        <path fill="#ea4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4 16.1 4 9.2 8.6 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z" />
      </svg>
      {ar ? 'المتابعة باستخدام Google' : 'Continue with Google'}
    </Button>

    {#if !loading && providers.google === null && !error}
      <p role="status" class="provider-status">{ar ? 'تعذر الاتصال بـ Google. اضغط للمحاولة مجدداً أو استخدم البريد الإلكتروني.' : 'Google couldn’t connect. Select it to retry, or use email.'}</p>
    {/if}

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
  .google-mark { flex-shrink: 0; }
  .social-sign-in :global(.google-sign-in) { min-height: 52px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; font-size: 15px; font-weight: 500; }
  .provider-status { margin: 12px 0 0; font-size: 13px; line-height: 1.5; color: var(--text-secondary); }
  .auth-divider {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 18px 0;
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

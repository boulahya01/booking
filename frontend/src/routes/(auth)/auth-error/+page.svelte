<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import { authState, bootstrapError } from '$lib/stores/auth'
  import { supabase } from '$lib/supabaseClient'
  import { getMySessionContextOrError } from '$lib/sessionApi'
  import { language } from '$lib/stores/ui'
  import Button from '$lib/components/Button.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import AuthShell from '$lib/components/AuthShell.svelte'
  import Icon from '$lib/components/Icon.svelte'

  let disposed = false
  let retrying = false

  $: ar = $language === 'ar'
  $: copy = ar
    ? {
        title: 'تعذر تحميل الحساب',
        profileNotFound: 'لم يتم العثور على ملف التعريف. قد تكون عملية التسجيل لم تكتمل.',
        networkError: 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.',
        databaseError: 'حدث خطأ في قاعدة البيانات. حاول مرة أخرى.',
        retry: 'إعادة المحاولة',
        signOut: 'تسجيل الخروج',
        help: 'المساعدة'
      }
    : {
        title: 'Unable to load account',
        profileNotFound: 'Profile not found. Registration may not have completed.',
        networkError: 'Could not connect to server. Check your internet connection.',
        databaseError: 'A database error occurred. Please try again.',
        retry: 'Retry',
        signOut: 'Sign out',
        help: 'Help'
      }
  $: errorType = $bootstrapError
  $: errorMessage = errorType === 'profile_not_found' ? copy.profileNotFound
    : errorType === 'network_error' ? copy.networkError
    : copy.databaseError

  async function handleRetry() {
    if (retrying || disposed) return
    retrying = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const result = await getMySessionContextOrError()
        if (!('error' in result)) {
          await goto('/launch')
          return
        }
      }
    } catch {
      // Ignore, keep error state
    } finally {
      retrying = false
    }
  }

  async function handleSignOut() {
    if (disposed) return
    await supabase.auth.signOut({ scope: 'local' })
    authState.clear()
    await goto('/login')
  }

  onMount(() => {
    return () => { disposed = true }
  })
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>

<AuthShell>
  <section class="w-full text-center" aria-live="polite">
    <div class="mb-8">
      <div class="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-light text-danger">
        <Icon name="alert-circle" size={21} />
      </div>
      <h1 class="auth-title">{copy.title}</h1>
      <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">{errorMessage}</p>
    </div>

    <div class="space-y-3">
      <Button on:click={handleRetry} loading={retrying} variant="primary" size="lg" className="w-full">
        <Icon name="refresh-cw" size={18} className="me-2" />
        {copy.retry}
      </Button>
      <Button on:click={handleSignOut} variant="secondary" size="lg" className="w-full">
        <Icon name="log-out" size={18} className="me-2" />
        {copy.signOut}
      </Button>
    </div>
  </section>

  <div slot="footer" class="text-center">
    <a href="/help" class="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm text-text-muted transition-colors hover:text-text"><Icon name="info" size={17} /><span>{copy.help}</span></a>
  </div>
</AuthShell>
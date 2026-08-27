<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { signOut } from '$lib/auth'
  import { authState } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'
  import AuthShell from '$lib/components/AuthShell.svelte'

  $: copy = $language === 'ar' ? { title: 'جاري تسجيل الخروج', body: 'لحظة واحدة…' } : { title: 'Signing out', body: 'One moment…' }

  onMount(async () => {
    await signOut()
    authState.clear()
    await goto('/login')
  })
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>

<AuthShell>
  <section class="flex min-h-[45vh] w-full flex-col items-center justify-center text-center" aria-live="polite">
    <span class="mb-5 h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-hidden="true"></span>
    <h1 class="text-xl font-semibold text-text">{copy.title}</h1>
    <p class="mt-2 text-sm text-text-secondary">{copy.body}</p>
  </section>
</AuthShell>

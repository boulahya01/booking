<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { signOut } from '$lib/auth'
  import { authState } from '$lib/stores/auth'
  import { _ } from 'svelte-i18n'

  onMount(async () => {
    await signOut()
    authState.clear()
    goto('/login')
  })
</script>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="text-center space-y-4">
    <div class="animate-spin text-4xl text-primary mx-auto">⟳</div>
    <p class="text-text-secondary">{$_('common.loading')}</p>
  </div>
</div>

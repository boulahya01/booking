<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/home', { replaceState: true });
  });
</script>

<svelte:head>
  <title>UNEEM</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center">
  <p class="text-text-muted">Redirecting...</p>
</div>

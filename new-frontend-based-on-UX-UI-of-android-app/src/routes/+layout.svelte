 <script lang="ts">
  import '$lib/styles/global.css'
  import TopBar from '$lib/components/TopBar.svelte'
  import BottomNav from '$lib/components/BottomNav.svelte'
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Booking App</title>
  <meta name="color-scheme" content="dark light" />
  <meta name="theme-color" content="#07080b" />
</svelte:head>

<div class="app-shell">
  <TopBar />
  <main class="app-content">
    <slot />
  </main>
  <BottomNav />
</div>

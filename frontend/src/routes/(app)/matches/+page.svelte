<script lang="ts">
  import HomeMatches from '$lib/components/HomeMatches.svelte'
  import { language } from '$lib/stores/ui'
</script>

<svelte:head><title>{$language === 'ar' ? 'المباريات المفتوحة' : 'Open matches'} · UNEEM</title></svelte:head>

<main class="uneem-page matches-page"><HomeMatches standalone /></main>

<style>
  .matches-page { max-width: 64rem; }
</style>
<script lang="ts">
  import { page } from '$app/stores'
  import { language } from '$lib/stores/ui'
  import CommunityThread from '$lib/components/CommunityThread.svelte'
</script>
<svelte:head><title>{$language === 'ar' ? 'ساحة المجتمع' : 'Community lobby'} · UNEEM</title></svelte:head>
<div class="uneem-page-narrow community-page"><header><h1 class="uneem-title">{$language === 'ar' ? 'لنلعب معاً' : 'Let’s play together'}</h1><p class="uneem-subtitle">{$language === 'ar' ? 'ابحث عن لاعبين، شارك مباراة، وخطط لموعدك القادم.' : 'Find players, share a match, and plan your next game.'}</p></header><CommunityThread shareId={$page.url.searchParams.get('share')} mention={$page.url.searchParams.get('to')} /></div>
<style>.community-page { max-width:760px; } header { margin-bottom:24px; }</style>

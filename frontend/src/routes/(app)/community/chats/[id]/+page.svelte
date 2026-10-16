<script lang="ts">
  import { page } from '$app/stores'
  import { language } from '$lib/stores/ui'
  import CommunityThread from '$lib/components/CommunityThread.svelte'
  import Icon from '$lib/components/Icon.svelte'
</script>
<svelte:head><title>{$language === 'ar' ? 'محادثة المباراة' : 'Match chat'} · UNEEM</title></svelte:head>
<div class="uneem-page-narrow conversation-page"><a class="uneem-text-action back" href="/community/chats"><Icon name={$language === 'ar' ? 'arrow-right' : 'arrow-left'} size={17}/>{$language === 'ar' ? 'المحادثات' : 'Chats'}</a><a class="uneem-text-action details" href={'/bookings/' + $page.params.id}>{$language === 'ar' ? 'تفاصيل المباراة' : 'Match details'}</a>{#key $page.params.id}<CommunityThread bookingId={$page.params.id}/>{/key}</div>
<style>.conversation-page { max-width:760px; }.back { margin-bottom:24px; }.details { float:inline-end; margin-bottom:24px; }</style>

<script lang="ts">
  import { hasFullAccess } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'
  import ActionLink from '$lib/components/ActionLink.svelte'
</script>
{#if $hasFullAccess}<slot />{:else}
  <section class="uneem-page-narrow"><h1 class="uneem-title">{$language === 'ar' ? 'المجتمع' : 'Community'}</h1><p class="uneem-subtitle">{$language === 'ar' ? 'تحقق من بطاقة الطالب للتواصل مع اللاعبين.' : 'Verify your student ID to connect with players.'}</p><ActionLink href="/verification" className="mt-6">{$language === 'ar' ? 'تحقق من هويتك' : 'Verify student ID'}</ActionLink></section>
{/if}

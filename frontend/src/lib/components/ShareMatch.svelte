<script lang="ts">
  import { language } from '$lib/stores/ui'
  import type { SharedMatch } from '$lib/communityApi'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'
  import ShareMatchModal from './ShareMatchModal.svelte'
  export let match: SharedMatch
  let open = false
</script>
<Button variant="secondary" fullWidth on:click={() => open = true}><Icon name="send" size={17}/>{$language === 'ar' ? 'مشاركة المباراة' : 'Share match'}</Button>
{#if open}<ShareMatchModal {match} onClose={() => open = false}/>{/if}

<script lang="ts">
  import Share2 from '@lucide/svelte/icons/share-2'
  import { locale } from 'svelte-i18n'
  import { uiState } from '$lib/stores/ui'
  import Button from './Button.svelte'
  import Modal from './Modal.svelte'

  export let bookingId: string
  export let title: string
  let sharing = false
  let showLink = false
  let url = ''
  $: ar = ($locale || 'en').startsWith('ar')

  async function share() {
    if (sharing) return
    sharing = true
    url = new URL(`/bookings/${encodeURIComponent(bookingId)}`, window.location.origin).href
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: `${title} · UNEEM`, text: ar ? 'انضم إلى المباراة على UNEEM' : 'Join this match on UNEEM', url })
          return
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return
        }
      }
      try {
        if (!navigator.clipboard) throw new Error('clipboard_unavailable')
        await navigator.clipboard.writeText(url)
        uiState.addToast(ar ? 'تم نسخ رابط المباراة' : 'Match link copied', 'success')
      } catch { showLink = true }
    } finally { sharing = false }
  }
</script>

<Button variant="secondary" fullWidth loading={sharing} on:click={share}><Share2 size={18} aria-hidden="true"/>{ar ? 'دعوة الأصدقاء' : 'Invite friends'}</Button>
<Modal bind:open={showLink} title={ar ? 'رابط المباراة' : 'Match link'} size="sm">
  <label for="share-match-link" class="mb-3 block text-sm text-text-secondary">{ar ? 'انسخ الرابط وأرسله لأصدقائك.' : 'Copy this link and send it to your friends.'}</label>
  <input id="share-match-link" class="uneem-field" type="url" value={url} readonly dir="ltr" on:focus={event => event.currentTarget.select()} />
</Modal>

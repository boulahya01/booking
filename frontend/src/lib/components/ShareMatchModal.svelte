<script lang="ts">
  import { goto } from '$app/navigation'
  import { language } from '$lib/stores/ui'
  import type { SharedMatch } from '$lib/communityApi'
  import Modal from './Modal.svelte'
  import Button from './Button.svelte'
  import SharedMatchCard from './SharedMatchCard.svelte'
  export let match: SharedMatch
  export let onClose: () => void
  let open = true, busy = false, copied = false, error = '', url = ''
  $: ar = $language === 'ar'
  async function shareLink() {
    if (busy) return
    busy = true; error = ''; url = new URL('/bookings/' + match.booking_id, window.location.origin).href
    try {
      if (navigator.share) {
        try { await navigator.share({ title: match.pitch_name, text: ar ? 'انضم إلى المباراة' : 'Join this match', url }); onClose(); return }
        catch (failure) { if (failure instanceof Error && failure.name === 'AbortError') return }
      }
      if (!navigator.clipboard) throw new Error('clipboard_unavailable')
      await navigator.clipboard.writeText(url); copied = true
    } catch (failure) {
      error = ar ? 'يمكنك نسخ الرابط أدناه.' : 'You can copy the link below.'
    } finally { busy = false }
  }
</script>
<Modal bind:open title={ar ? 'مشاركة المباراة' : 'Share match'} on:close={onClose}>
  <SharedMatchCard {match}/>
  <p class="share-copy">{ar ? 'المشاركة تدعو اللاعبين. يتم تأكيد الأماكن عند الانضمام.' : 'Share an invitation. Places are confirmed when players join.'}</p>
  <div class="share-actions"><Button fullWidth on:click={() => goto('/community?share=' + encodeURIComponent(match.booking_id))}>{ar ? 'المشاركة في ساحة المجتمع' : 'Share in lobby'}</Button><Button variant="secondary" fullWidth loading={busy} on:click={shareLink}>{copied ? (ar ? 'تم نسخ الرابط' : 'Link copied') : (ar ? 'مشاركة الرابط' : 'Share link')}</Button></div>
  {#if error}<p role="status" class="share-copy">{error}</p><label class="share-copy">{ar ? 'رابط المباراة' : 'Match link'}<input class="uneem-field" readonly value={url} on:focus={event => event.currentTarget.select()}/></label>{/if}
</Modal>
<style>.share-copy { display:block; font-size:14px; color:var(--text-secondary); line-height:1.6; margin-block:16px; }.share-actions { display:grid; gap:10px; }</style>

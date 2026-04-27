<script lang="ts">
  import Modal from './Modal.svelte'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'
  import { _ } from 'svelte-i18n'

  export let open = false
  export let photoUrl: string | null = null
  export let title = ''
  export let nextPhotoUrl: string | null = null

  const dispatch = () => {}

  function handleClose() {
    open = false
  }

  function handleNext() {
    if (nextPhotoUrl) {
      // This will be handled by the parent component
    }
  }
</script>

<Modal {open} {title} size="lg" on:close={handleClose}>
  {#if photoUrl}
    <div class="space-y-4">
      <div class="rounded-xl overflow-hidden bg-black relative min-h-[200px] flex items-center justify-center">
        <img
          src={photoUrl}
          alt={title}
          class="w-full max-h-[70vh] object-contain"
        />
      </div>
    </div>
  {:else}
    <div class="py-12 text-center text-text-muted">
      {#if open}
        <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="mt-3 text-sm">Loading photo...</p>
      {:else}
        <Icon name="image" size={40} />
        <p class="mt-2 text-sm">{$_('verification.no_photo_available')}</p>
      {/if}
    </div>
  {/if}
</Modal>

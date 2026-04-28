<script lang="ts">
  import Modal from './Modal.svelte'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'
  import { _ } from 'svelte-i18n'

  export let open = false
  export let photoUrl: string | null = null
  export let title = ''
  export let nextPhotoUrl: string | null = null
  export let loading = false
  export let error: string | null = null
  export let onRetry: (() => void) | null = null

  const dispatch = () => {}

  function handleClose() {
    open = false
  }

  function handleNext() {
    if (nextPhotoUrl) {
      // This will be handled by the parent component
    }
  }

  function handleRetry() {
    if (onRetry) {
      onRetry()
    }
  }
</script>

<Modal {open} {title} size="lg" on:close={handleClose}>
  {#if error}
    <!-- Error state -->
    <div class="py-12 text-center">
      <div class="w-14 h-14 bg-danger-light rounded-full flex items-center justify-center mx-auto mb-3">
        <Icon name="alert-triangle" size={24} className="text-danger" />
      </div>
      <p class="font-medium text-text mb-1">{$_('verification.photo_load_error')}</p>
      <p class="text-sm text-text-secondary mb-4">{error}</p>
      {#if onRetry}
        <Button variant="primary" size="md" on:click={handleRetry}>
          {$_('common.retry')}
        </Button>
      {/if}
    </div>
  {:else if loading}
    <!-- Loading state -->
    <div class="py-12 text-center">
      <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="mt-3 text-sm text-text-secondary">Loading photo...</p>
    </div>
  {:else if photoUrl}
    <!-- Success state -->
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
    <!-- No photo state -->
    <div class="py-12 text-center text-text-muted">
      <Icon name="image" size={40} />
      <p class="mt-2 text-sm">{$_('verification.no_photo_available')}</p>
    </div>
  {/if}
</Modal>


<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import Icon from './Icon.svelte'
  import { _ } from 'svelte-i18n'

  export let label = ''
  export let photoUrl: string | null = null
  export let uploading = false
  export let error = ''

  const dispatch = createEventDispatcher()

  let fileInput: HTMLInputElement

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    error = ''

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      error = $_('verification.invalid_file_type')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      error = $_('verification.file_too_large')
      return
    }

    dispatch('upload', file)
    // Reset input so same file can be re-selected
    target.value = ''
  }

  function triggerFileInput() {
    if (!uploading) {
      fileInput?.click()
    }
  }
</script>

<div class="space-y-3">
  {#if label}
    <label class="block text-sm font-medium text-text">{label}</label>
  {/if}

  {#if error}
    <div class="flex items-center gap-2 text-sm text-danger bg-danger-light border border-danger/20 rounded-lg p-2.5">
      <Icon name="alert-triangle" size={14} />
      {error}
    </div>
  {/if}

  <input
    type="file"
    accept="image/jpeg,image/png"
    bind:this={fileInput}
    on:change={handleFileChange}
    class="hidden"
  />

  {#if photoUrl}
    <!-- Preview state -->
    <div class="relative group">
      <img
        src={photoUrl}
        alt={label}
        class="w-full h-40 object-cover rounded-xl border border-border dark:border-white/8"
      />
      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
        <button
          type="button"
          on:click={triggerFileInput}
          disabled={uploading}
          class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-text text-sm font-medium hover:bg-surface-level-1 transition-colors disabled:opacity-50"
        >
          <Icon name="camera" size={14} />
          {$_('verification.re_upload')}
        </button>
      </div>
    </div>
  {:else}
    <!-- Upload state -->
    <button
      type="button"
      on:click={triggerFileInput}
      disabled={uploading}
      class="w-full border-2 border-dashed border-border dark:border-white/8 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-text-muted hover:border-primary hover:text-primary hover:bg-primary-light/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[120px]"
    >
      {#if uploading}
        <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span class="text-sm font-medium">{$_('verification.uploading')}</span>
      {:else}
        <Icon name="camera" size={28} />
        <span class="text-sm font-medium">{$_('verification.upload_prompt')}</span>
        <span class="text-xs text-text-muted">{$_('verification.upload_hint')}</span>
      {/if}
    </button>
  {/if}
</div>

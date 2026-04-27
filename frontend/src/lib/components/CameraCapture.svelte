<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import Icon from './Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { logger } from '$lib/logger'

  export let label = ''
  export let photoUrl: string | null = null
  export let capturing = false
  export let error = ''

  const dispatch = createEventDispatcher()

  let selectedFile: File | null = null
  let previewUrl: string | null = null
  let showPreview = false
  let fileInput: HTMLInputElement

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    logger.debug('[CameraCapture] File selected:', file.name, file.type, file.size)
    error = ''

    // Validate file type
    if (!file.type.startsWith('image/')) {
      error = $_('camera.error_generic')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      error = $_('verification.upload_error')
      return
    }

    // Store the file directly and show preview
    selectedFile = file
    previewUrl = URL.createObjectURL(file)
    showPreview = true
    logger.debug('[CameraCapture] Preview ready')
  }

  function acceptPhoto() {
    if (!selectedFile || capturing) {
      logger.debug('[CameraCapture] acceptPhoto blocked:', { hasFile: !!selectedFile, capturing })
      return
    }

    logger.debug('[CameraCapture] acceptPhoto called, dispatching upload event')
    // Dispatch the upload event - parent will handle and set capturing=true
    dispatch('upload', selectedFile)
    // Clear the file reference so user can't accept again
    // Keep previewUrl visible for the loading state
    selectedFile = null
  }

  function retakePhoto() {
    cleanup()
    // Open file picker again after cleanup
    setTimeout(() => {
      if (fileInput) fileInput.click()
    }, 100)
  }

  function cancelPreview() {
    cleanup()
  }

  function cleanup() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      previewUrl = null
    }
    selectedFile = null
    showPreview = false
    if (fileInput) fileInput.value = ''
  }
</script>

<div class="space-y-3">
  {#if label}
    <label class="block text-sm font-medium" style="color: var(--text);">{label}</label>
  {/if}

  {#if error}
    <div class="flex items-center gap-2 text-sm rounded-lg p-3"
         style="background: var(--danger-light/60); color: var(--danger); box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.12);">
      <Icon name="alert-circle" size={14} />
      {error}
    </div>
  {/if}

  <!-- Hidden file input -->
  <input
    type="file"
    accept="image/*"
    capture="user"
    bind:this={fileInput}
    on:change={handleFileSelect}
    disabled={capturing}
    class="hidden"
  />

  {#if photoUrl && !showPreview}
    <!-- Existing photo preview -->
    <div class="relative group">
      <img
        src={photoUrl}
        alt={label}
        class="w-full h-40 object-cover rounded-xl"
        style="border: 1px solid var(--border);"
      />
      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
        <button
          type="button"
          on:click={() => fileInput?.click()}
          disabled={capturing}
          class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style="background: var(--surface); color: var(--text);">
          <Icon name="camera" size={14} />
          {$_('camera.retake')}
        </button>
      </div>
    </div>
  {:else if showPreview}
    <!-- Preview captured photo -->
    <div class="space-y-3">
      <div class="relative">
        <img
          src={previewUrl}
          alt={$_('camera.preview')}
          class="w-full h-40 object-cover rounded-xl"
          style="border: 2px solid var(--primary);"
        />
        {#if capturing}
          <div class="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
            <div class="flex flex-col items-center gap-2">
              <div class="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              <span class="text-white text-sm font-medium">{$_('camera.uploading')}</span>
            </div>
          </div>
        {/if}
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          on:click={acceptPhoto}
          disabled={capturing}
          class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-white text-sm font-medium transition-all duration-200 disabled:opacity-50"
          style="background: var(--primary-gradient); box-shadow: 0 0 0 1px var(--primary);">
          <Icon name="check" size={14} />
          {$_('camera.accept')}
        </button>
        <button
          type="button"
          on:click={retakePhoto}
          disabled={capturing}
          class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style="background: var(--surface-level-1); color: var(--text);">
          <Icon name="camera" size={14} />
          {$_('camera.retake')}
        </button>
        <button
          type="button"
          on:click={cancelPreview}
          disabled={capturing}
          class="px-3 flex items-center justify-center py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style="background: var(--surface-level-1); color: var(--text-muted);">
          <Icon name="x" size={14} />
          {$_('common.cancel')}
        </button>
      </div>
    </div>
  {:else}
    <!-- Camera/file input button -->
    <button
      type="button"
      on:click={() => fileInput?.click()}
      disabled={capturing}
      class="w-full rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[120px]"
      style="background: var(--surface-level-1/40); border: 2px dashed var(--border); color: var(--text-muted);"
    >
      {#if capturing}
        <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span class="text-sm font-medium">{$_('camera.capturing')}</span>
      {:else}
        <Icon name="camera" size={28} />
        <span class="text-sm font-medium">{$_('camera.open_camera')}</span>
        <span class="text-xs" style="color: var(--text-muted);">{$_('camera.hint')}</span>
      {/if}
    </button>
  {/if}
</div>

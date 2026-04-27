<script lang="ts">
  import { cn } from '$lib/utils/cn'
  import Icon from './Icon.svelte'

  type ToastType = 'success' | 'error' | 'info' | 'warning'

  export let message = ''
  export let type: ToastType = 'info'
  export let duration = 4000
  export let id = ''

  let visible = true

  const iconMap: Record<ToastType, string> = {
    success: 'check',
    error: 'x',
    info: 'info',
    warning: 'alert-triangle'
  }

  const colors: Record<ToastType, string> = {
    success: 'bg-success text-white',
    error: 'bg-danger text-white',
    info: 'bg-primary text-white',
    warning: 'bg-warning text-text-inverse'
  }

  if (duration > 0) {
    setTimeout(() => {
      visible = false
    }, duration)
  }

  function close() {
    visible = false
  }
</script>

{#if visible}
  <div
    data-toast-id={id}
    class={cn(
      'fixed bottom-4 right-4 z-50 rounded-xl shadow-lg p-4 flex items-center gap-3',
      'animate-slide-up',
      colors[type],
      'max-w-xs'
    )}
    role="alert"
  >
    <span class="flex-shrink-0">
      <Icon name={iconMap[type]} size={18} strokeWidth={2.5} />
    </span>
    <span class="text-sm font-medium">{message}</span>
    <button
      on:click={close}
      class="ml-auto opacity-80 hover:opacity-100 transition"
      aria-label="Close"
    >
      <Icon name="x" size={16} />
    </button>
  </div>
{/if}

<style>
  @keyframes slideUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  :global(.animate-slide-up) {
    animation: slideUp 0.3s ease-out;
  }
</style>

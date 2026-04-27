<script lang="ts">
  import Icon from './Icon.svelte'
  import { _ } from 'svelte-i18n'

  export let photoUrl: string | null = null
  export let label = ''
  export let size: 'sm' | 'md' | 'lg' = 'md'

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32'
  }

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 32
  }
</script>

<div class="flex flex-col items-center gap-1.5">
  {#if photoUrl}
    <div class="relative group cursor-pointer {sizeClasses[size]} rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-colors">
      <img
        src={photoUrl}
        alt={label}
        class="w-full h-full object-cover"
      />
      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <Icon name="eye" size={iconSizes[size]} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  {:else}
    <div class="{sizeClasses[size]} rounded-xl bg-surface-level-2 border border-border flex flex-col items-center justify-center text-text-muted">
      <Icon name="image" size={iconSizes[size]} />
      {#if size !== 'sm'}
        <span class="text-[10px] mt-1 text-center leading-tight px-1">{$_('verification.not_uploaded')}</span>
      {/if}
    </div>
  {/if}
  {#if label}
    <span class="text-xs text-text-secondary font-medium">{label}</span>
  {/if}
</div>

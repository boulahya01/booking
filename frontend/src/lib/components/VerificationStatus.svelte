<script lang="ts">
  import Icon from './Icon.svelte'
  import { _ } from 'svelte-i18n'

  export let status: 'unsubmitted' | 'pending' | 'verified' | 'rejected' = 'unsubmitted'
  export let notes: string | null = null

  const statusConfig = {
    unsubmitted: {
      icon: 'id-card',
      color: 'text-text-muted',
      bg: 'bg-surface-level-1',
      border: 'border-border',
      title: 'verification.status_unsubmitted',
      description: 'verification.status_unsubmitted_desc'
    },
    pending: {
      icon: 'clock',
      color: 'text-warning',
      bg: 'bg-warning-light',
      border: 'border-warning/20',
      title: 'verification.status_pending',
      description: 'verification.status_pending_desc'
    },
    verified: {
      icon: 'check',
      color: 'text-success',
      bg: 'bg-success-light',
      border: 'border-success/20',
      title: 'verification.status_verified',
      description: 'verification.status_verified_desc'
    },
    rejected: {
      icon: 'x-circle',
      color: 'text-danger',
      bg: 'bg-danger-light',
      border: 'border-danger/20',
      title: 'verification.status_rejected',
      description: 'verification.status_rejected_desc'
    }
  }

  $: config = statusConfig[status]
</script>

<div class="border {config.border} {config.bg} rounded-xl p-4 space-y-2">
  <div class="flex items-center gap-2.5">
    <div class="w-8 h-8 rounded-full flex items-center justify-center {config.color} bg-white/60">
      <Icon name={config.icon} size={16} />
    </div>
    <span class="font-medium text-text">{$_(config.title)}</span>
  </div>
  <p class="text-sm text-text-secondary pl-10">{$_(config.description)}</p>

  {#if notes && status === 'rejected'}
    <div class="mt-2 pl-10">
      <div class="bg-white/60 rounded-lg p-3 text-sm">
        <span class="font-medium text-danger">{$_('verification.admin_notes')}:</span>
        <span class="text-text-secondary ml-1">{notes}</span>
      </div>
    </div>
  {/if}
</div>

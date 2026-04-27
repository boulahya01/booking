<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/supabaseClient'
  import { uiState } from '$lib/stores/ui'
  import Card from '$lib/components/Card.svelte'
  import Button from '$lib/components/Button.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Toggle from '$lib/components/Toggle.svelte'
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte'
  import { _ } from 'svelte-i18n'
  import { USE_MOCK, mockDelay } from '$lib/mock'

  interface Notification {
    key: string
    title_en: string
    title_ar: string
    message_en: string
    message_ar: string
    enabled: boolean
    created_at: string
    expires_at: string | null
    updated_at: string
  }

  let notifications: Notification[] = []
  let loading = true
  let showForm = false
  let editingKey: string | null = null
  let formData = {
    key: '',
    title_en: '',
    title_ar: '',
    message_en: '',
    message_ar: '',
    enabled: true,
    expires_at: ''
  }
  let error = ''

  onMount(async () => {
    await checkAdmin()
    await loadNotifications()
  })

  async function checkAdmin() {
    if (USE_MOCK) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      await goto('/login')
      return
    }
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') {
      await goto('/home')
    }
  }

  async function loadNotifications() {
    if (USE_MOCK) {
      notifications = []
      loading = false
      return
    }
    const { data, error: err } = await supabase
      .from('system_notifications')
      .select('*')
      .order('created_at', { ascending: false })

    if (!err && data) {
      notifications = data
    }
    loading = false
  }

  function openCreateForm() {
    editingKey = null
    formData = {
      key: '',
      title_en: '',
      title_ar: '',
      message_en: '',
      message_ar: '',
      enabled: true,
      expires_at: ''
    }
    showForm = true
  }

  function openEditForm(notification: Notification) {
    editingKey = notification.key
    formData = {
      key: notification.key,
      title_en: notification.title_en,
      title_ar: notification.title_ar,
      message_en: notification.message_en,
      message_ar: notification.message_ar,
      enabled: notification.enabled,
      expires_at: notification.expires_at ? notification.expires_at.substring(0, 16) : ''
    }
    showForm = true
  }

  async function saveNotification() {
    error = ''
    if (!formData.key || !formData.title_en || !formData.message_en) {
      error = $_('notifications.error_key_required')
      return
    }

    // Validate key format (alphanumeric + underscores only)
    if (!/^[a-z0-9_]+$/.test(formData.key)) {
      error = $_('notifications.error_key_unique')
      return
    }

    try {
      if (USE_MOCK) {
        await mockDelay()
        uiState.addToast(editingKey ? 'Notification updated!' : 'Notification created!', 'success')
        showForm = false
        return
      }

      const payload = {
        key: formData.key,
        title_en: formData.title_en,
        title_ar: formData.title_ar || formData.title_en,
        message_en: formData.message_en,
        message_ar: formData.message_ar || formData.message_en,
        enabled: formData.enabled,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null
      }

      if (editingKey) {
        const { error: err } = await supabase
          .from('system_notifications')
          .update(payload)
          .eq('key', editingKey)

        if (err) { error = 'Failed to update notification. Please try again.'; return }
        uiState.addToast($_('notifications.save_success'), 'success')
      } else {
        // Check if key already exists
        const { data: existing } = await supabase
          .from('system_notifications')
          .select('key')
          .eq('key', formData.key)
          .maybeSingle()

        if (existing) {
          error = $_('notifications.error_key_unique')
          return
        }

        const { error: err } = await supabase
          .from('system_notifications')
          .insert([payload])

        if (err) { error = 'Failed to create notification. Please try again.'; return }
        uiState.addToast($_('notifications.save_success'), 'success')
      }

      showForm = false
      await loadNotifications()
    } catch (e: any) {
      error = 'An error occurred. Please try again.'
    }
  }

  async function toggleNotification(key: string, currentEnabled: boolean) {
    if (USE_MOCK) {
      uiState.addToast('Notification toggled!', 'success')
      return
    }

    const { error: err } = await supabase
      .from('system_notifications')
      .update({ enabled: !currentEnabled })
      .eq('key', key)

    if (!err) {
      uiState.addToast(!currentEnabled ? $_('notifications.status_enabled') : $_('notifications.status_disabled'), 'success')
      await loadNotifications()
    } else {
      uiState.addToast(err.message, 'error')
    }
  }

  async function deleteNotification(key: string) {
    if (!confirm($_('notifications.delete_confirm'))) return

    if (USE_MOCK) {
      uiState.addToast('Notification deleted!', 'success')
      return
    }

    const { error: err } = await supabase
      .from('system_notifications')
      .delete()
      .eq('key', key)

    if (!err) {
      uiState.addToast('Notification deleted!', 'success')
      await loadNotifications()
    } else {
      uiState.addToast(err.message, 'error')
    }
  }
</script>

<div class="max-w-4xl mx-auto p-4">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-medium font-serif text-text">{$_('notifications.title')}</h1>
    {#if !showForm}
      <Button variant="primary" size="sm" on:click={openCreateForm}>{$_('notifications.add_new')}</Button>
    {/if}
  </div>

  {#if error}
    <div class="bg-danger-light border border-danger/20 text-danger p-3 rounded-lg mb-4 text-sm">{error}</div>
  {/if}

  {#if showForm}
    <Card variant="elevated" className="mb-5">
      <div class="space-y-4">
        <h2 class="text-base font-medium font-serif text-text">{editingKey ? $_('notifications.edit_notification') : $_('notifications.create_notification')}</h2>

        <TextField label={$_('notifications.key_label')} placeholder={$_('notifications.key_placeholder')} helperText={$_('notifications.key_helper')} bind:value={formData.key} disabled={editingKey !== null} />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <TextField label={$_('notifications.title_en_label')} bind:value={formData.title_en} />
          </div>
          <div>
            <TextField label={$_('notifications.title_ar_label')} bind:value={formData.title_ar} />
          </div>
        </div>

        <div>
          <label for="msg-en" class="block text-sm font-medium text-text-secondary mb-1">{$_('notifications.message_en_label')}</label>
          <textarea
            id="msg-en"
            class="w-full rounded-lg border border-border bg-surface-level-1 p-3 text-sm text-text placeholder:text-text-muted focus:border-info focus:outline-none focus:ring-1 focus:ring-info transition-colors min-h-[100px]"
            bind:value={formData.message_en}
          ></textarea>
        </div>

        <div>
          <label for="msg-ar" class="block text-sm font-medium text-text-secondary mb-1">{$_('notifications.message_ar_label')}</label>
          <textarea
            id="msg-ar"
            class="w-full rounded-lg border border-border bg-surface-level-1 p-3 text-sm text-text placeholder:text-text-muted focus:border-info focus:outline-none focus:ring-1 focus:ring-info transition-colors min-h-[100px]"
            bind:value={formData.message_ar}
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="expires-at" class="block text-sm font-medium text-text-secondary mb-1">{$_('notifications.expires_at_label')}</label>
            <input
              id="expires-at"
              type="datetime-local"
              class="w-full rounded-lg border border-border bg-surface-level-1 p-3 text-sm text-text focus:border-info focus:outline-none focus:ring-1 focus:ring-info transition-colors"
              bind:value={formData.expires_at}
            />
          </div>
          <div class="flex items-end">
            <Toggle
              checked={formData.enabled}
              onToggle={() => formData.enabled = !formData.enabled}
              label={$_('notifications.enabled_label')}
            />
          </div>
        </div>

        <div class="flex gap-3">
          <Button variant="primary" className="flex-1" on:click={saveNotification}>{$_('notifications.save')}</Button>
          <Button variant="secondary" className="flex-1" on:click={() => (showForm = false)}>{$_('common.cancel')}</Button>
        </div>
      </div>
    </Card>
  {/if}

  {#if loading}
    <div class="space-y-4">
      <LoadingSkeleton />
      <LoadingSkeleton />
    </div>
  {:else if notifications.length === 0}
    <Card variant="elevated" className="text-center py-12">
      <p class="text-text-secondary mb-4">{$_('notifications.no_notifications')}</p>
      <Button variant="primary" on:click={openCreateForm}>{$_('notifications.create_first')}</Button>
    </Card>
  {:else}
    <div class="space-y-3">
      {#each notifications as notification (notification.key)}
        <Card variant="elevated" className="p-4">
          <div class="flex justify-between items-start gap-4 flex-wrap">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="text-base font-semibold text-text">{notification.title_en}</h3>
                <span class="px-2 py-0.5 text-xs rounded-full {notification.enabled ? 'bg-success/20 text-success' : 'bg-text-muted/20 text-text-muted'}">
                  {notification.enabled ? $_('notifications.status_enabled') : $_('notifications.status_disabled')}
                </span>
              </div>
              <p class="text-text-secondary text-sm mb-1 line-clamp-2">{notification.message_en}</p>
              <p class="text-text-muted text-xs">
                {$_('notifications.key_label')}: <code class="bg-surface-level-2 px-1.5 py-0.5 rounded text-xs">{notification.key}</code>
                {#if notification.expires_at}
                  | {$_('notifications.expires')}: {new Date(notification.expires_at).toLocaleDateString()}
                {:else}
                  | {$_('notifications.never_expires')}
                {/if}
              </p>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <Button variant="ghost" size="sm" on:click={() => toggleNotification(notification.key, notification.enabled)}>
                {notification.enabled ? $_('notifications.enabled_off') : $_('notifications.enabled_on')}
              </Button>
              <Button variant="secondary" size="sm" on:click={() => openEditForm(notification)}>{$_('common.edit')}</Button>
              <Button variant="danger" size="sm" on:click={() => deleteNotification(notification.key)}>{$_('common.delete')}</Button>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

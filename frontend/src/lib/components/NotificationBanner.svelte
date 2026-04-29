<script lang="ts">
  import { onMount } from 'svelte'
  import { createEventDispatcher } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import { authState } from '$lib/stores/auth'
  import { uiState } from '$lib/stores/ui'
  import Icon from './Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { locale } from 'svelte-i18n'
  import { logger } from '$lib/logger'

  const dispatch = createEventDispatcher()

  // Auto-detect Arabic from language store
  $: isArabic = $locale === 'ar'

  interface Notification {
    key: string
    title_en: string
    title_ar: string
    message_en: string
    message_ar: string
    created_at: string
    expires_at: string | null
  }

  let notifications: Notification[] = []
  let loading = true

  onMount(async () => {
    await loadNotifications()
  })

  async function loadNotifications() {
    if (!$authState.user?.id) {
      loading = false
      return
    }

    // Use the RPC function to get active, non-dismissed notifications
    const { data, error } = await supabase
      .rpc('get_active_notifications_for_user', { p_user_id: $authState.user.id })

    if (error) {
      logger.error('Failed to load notifications:', error)
    } else {
      notifications = data || []
      uiState.setUnreadNotifications(notifications.length)
    }
    loading = false
  }

  async function dismissNotification(key: string) {
    if (!$authState.user?.id) return

    const { error } = await supabase
      .rpc('dismiss_notification_for_user', {
        p_notification_key: key,
        p_user_id: $authState.user.id
      })

    if (error) {
      logger.error('Failed to dismiss notification:', error)
    } else {
      // Remove from local list
      notifications = notifications.filter(n => n.key !== key)
      uiState.setUnreadNotifications(notifications.length)
      dispatch('dismissed', { key })
    }
  }
</script>

{#if loading}
  <div class="animate-pulse space-y-3">
    <div class="h-20 rounded-xl bg-surface-level-2"></div>
  </div>
{:else if notifications.length > 0}
  <div class="space-y-3">
    {#each notifications as notification (notification.key)}
      <div class="group relative overflow-hidden rounded-xl bg-surface shadow-sm p-4 pe-10 rtl:pe-4 rtl:ps-10 transition-all duration-300"
           style="border-left: 3px solid var(--primary);">
        <!-- Dismiss button -->
        <button
          class="absolute top-3 end-3 p-1.5 rounded-lg hover:bg-surface-level-1 transition-colors"
          on:click={() => dismissNotification(notification.key)}
          title={$_('notification_banner.dismiss')}
        >
          <Icon name="x" size={14} />
        </button>

        <!-- Content -->
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 mt-0.5">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center bg-primary-light/50 text-primary">
              <Icon name="bell" size={18} />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-text">
              {isArabic ? notification.title_ar : notification.title_en}
            </h3>
            <p class="text-sm mt-0.5 leading-relaxed whitespace-pre-wrap text-text-secondary">
              {isArabic ? notification.message_ar : notification.message_en}
            </p>
            <p class="text-xs mt-2 text-text-muted">
              {new Date(notification.created_at).toLocaleDateString(isArabic ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

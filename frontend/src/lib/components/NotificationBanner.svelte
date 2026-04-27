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
      <div class="relative rounded-xl p-4 pr-10 rtl:pr-4 rtl:pl-10 transition-all duration-300"
           style="background: var(--info-light/40); box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.12), inset 3px 0 0 var(--primary);">
        <!-- Dismiss button -->
        <button
          class="absolute top-3 end-3 p-1 rounded-full transition-colors"
          style="color: var(--info);"
          on:click={() => dismissNotification(notification.key)}
          title={$_('notification_banner.dismiss')}
        >
          <Icon name="x" size={16} />
        </button>

        <!-- Content -->
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 mt-0.5">
            <div class="w-8 h-8 rounded-full flex items-center justify-center"
                 style="background: var(--info-light/60); color: var(--info);">
              <Icon name="bell" size={16} />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold" style="color: var(--info);">
              {isArabic ? notification.title_ar : notification.title_en}
            </h3>
            <p class="text-sm mt-1 whitespace-pre-wrap" style="color: var(--text-secondary);">
              {isArabic ? notification.message_ar : notification.message_en}
            </p>
            <p class="text-xs mt-2" style="color: var(--text-muted);">
              {new Date(notification.created_at).toLocaleDateString(isArabic ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

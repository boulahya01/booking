<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import { authState } from '$lib/stores/auth'
  import { uiState } from '$lib/stores/ui'
  import Icon from './Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { locale } from 'svelte-i18n'
  import { logger } from '$lib/logger'

  const dispatch = createEventDispatcher()

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
  let loadError = false
  let currentUserId: string | null = null
  let requestVersion = 0

  onMount(() => {
    const unsubscribe = authState.subscribe((state) => {
      if (state.loading) {
        loading = true
        return
      }

      const userId = state.user?.id ?? null
      if (userId === currentUserId && !loadError) return

      currentUserId = userId
      requestVersion += 1

      if (!userId) {
        notifications = []
        loadError = false
        uiState.setUnreadNotifications(0)
        loading = false
        return
      }

      void loadNotifications(userId)
    })

    return unsubscribe
  })

  async function loadNotifications(userId: string) {
    const version = requestVersion
    loading = notifications.length === 0
    loadError = false

    try {
      const { data, error } = await supabase
        .rpc('get_active_notifications_for_user', { p_user_id: userId })

      if (version !== requestVersion || userId !== currentUserId) return
      if (error) throw error

      notifications = data || []
      uiState.setUnreadNotifications(notifications.length)
    } catch (error) {
      if (version !== requestVersion || userId !== currentUserId) return
      logger.error('Failed to load notifications:', error)
      loadError = true
      uiState.setUnreadNotifications(notifications.length)
    } finally {
      if (version === requestVersion && userId === currentUserId) {
        loading = false
      }
    }
  }

  function retry() {
    if (!currentUserId) return
    requestVersion += 1
    void loadNotifications(currentUserId)
  }

  async function dismissNotification(key: string) {
    const userId = currentUserId
    if (!userId) return

    const { error } = await supabase
      .rpc('dismiss_notification_for_user', {
        p_notification_key: key,
        p_user_id: userId
      })

    if (error) {
      logger.error('Failed to dismiss notification:', error)
      uiState.addToast($_('common.error'), 'error')
      return
    }

    notifications = notifications.filter(n => n.key !== key)
    uiState.setUnreadNotifications(notifications.length)
    dispatch('dismissed', { key })
  }
</script>

{#if loading}
  <div class="animate-pulse space-y-3" aria-busy="true">
    <div class="h-20 rounded-xl bg-surface-level-2"></div>
  </div>
{:else if loadError && notifications.length === 0}
  <div class="flex items-center gap-3 rounded-xl px-4 py-3 bg-surface border border-border" role="status">
    <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-danger-light text-danger">
      <Icon name="alert-triangle" size={17} />
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-text">{$_('common.error')}</p>
    </div>
    <button type="button" on:click={retry} class="text-sm font-semibold text-primary hover:underline">
      {$_('common.retry')}
    </button>
  </div>
{:else if notifications.length > 0}
  <div class="space-y-3">
    {#if loadError}
      <div class="flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-warning-light text-sm">
        <span class="text-text-secondary">{$_('common.error')}</span>
        <button type="button" on:click={retry} class="font-semibold text-primary hover:underline">
          {$_('common.retry')}
        </button>
      </div>
    {/if}

    {#each notifications as notification (notification.key)}
      <div class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-light/30 via-surface to-surface shadow-md hover:shadow-lg transition-all duration-300">
        <div class="absolute -top-4 -start-4 w-20 h-20 rounded-full bg-primary/10 blur-xl"></div>
        <div class="absolute inset-y-0 start-0 w-1 bg-gradient-to-b from-primary via-primary/80 to-primary/40"></div>

        <button
          class="absolute top-3 end-3 p-1.5 rounded-lg text-text-muted/60 hover:text-text hover:bg-surface-raised/60 transition-all duration-200"
          on:click={() => dismissNotification(notification.key)}
          title={$_('notification_banner.dismiss')}
        >
          <Icon name="x" size={14} />
        </button>

        <div class="relative flex items-start gap-3.5 p-4 ps-5 rtl:ps-4 rtl:pe-5">
          <div class="flex-shrink-0 mt-0.5">
            <div class="relative w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-sm">
              <span class="absolute inset-0 rounded-xl bg-primary/20 animate-ping opacity-40"></span>
              <Icon name="bell" size={18} />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-[15px] font-semibold text-text leading-snug">
              {isArabic ? notification.title_ar : notification.title_en}
            </h3>
            <p class="text-sm mt-1 leading-relaxed whitespace-pre-wrap text-text-secondary">
              {isArabic ? notification.message_ar : notification.message_en}
            </p>
            <div class="flex items-center gap-1.5 mt-2.5">
              <div class="w-1 h-1 rounded-full bg-primary/40"></div>
              <time class="text-xs text-text-muted">
                {new Date(notification.created_at).toLocaleDateString(isArabic ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
              </time>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

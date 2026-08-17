<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import { authState } from '$lib/stores/auth'
  import { uiState } from '$lib/stores/ui'
  import Icon from './Icon.svelte'
  import { _ , locale } from 'svelte-i18n'
  import { logger } from '$lib/logger'

  const dispatch = createEventDispatcher()
  $: isArabic = $locale === 'ar'

  interface Announcement {
    id: string
    title_en: string
    title_ar: string
    body_en: string
    body_ar: string
    published_at: string
    expires_at: string | null
  }

  let notifications: Announcement[] = []
  let loading = true
  let loadError = false
  let currentUserId: string | null = null
  let requestVersion = 0

  function reportCount() {
    uiState.setUnreadNotifications(notifications.length)
    dispatch('count', { count: notifications.length })
  }

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
        reportCount()
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
      const now = new Date().toISOString()
      const [announcementsResult, dismissalsResult] = await Promise.all([
        supabase
          .from('announcements')
          .select('id,title_en,title_ar,body_en,body_ar,published_at,expires_at')
          .eq('is_active', true)
          .lte('published_at', now)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('published_at', { ascending: false }),
        supabase
          .from('announcement_dismissals')
          .select('announcement_id')
          .eq('user_id', userId)
      ])

      if (version !== requestVersion || userId !== currentUserId) return
      if (announcementsResult.error) throw announcementsResult.error
      if (dismissalsResult.error) throw dismissalsResult.error

      const dismissed = new Set((dismissalsResult.data || []).map((row: any) => row.announcement_id))
      notifications = (announcementsResult.data || []).filter((announcement: any) => !dismissed.has(announcement.id))
      reportCount()
    } catch (error) {
      if (version !== requestVersion || userId !== currentUserId) return
      logger.error('Failed to load announcements:', error)
      loadError = true
      uiState.setUnreadNotifications(notifications.length)
    } finally {
      if (version === requestVersion && userId === currentUserId) loading = false
    }
  }

  function retry() {
    if (!currentUserId) return
    requestVersion += 1
    void loadNotifications(currentUserId)
  }

  async function dismissNotification(announcementId: string) {
    const userId = currentUserId
    if (!userId) return

    const { error } = await supabase.from('announcement_dismissals').insert({ user_id: userId, announcement_id: announcementId })

    if (error) {
      logger.error('Failed to dismiss announcement:', error)
      uiState.addToast($_('common.error'), 'error')
      return
    }

    notifications = notifications.filter((notification) => notification.id !== announcementId)
    reportCount()
    dispatch('dismissed', { id: announcementId, remaining: notifications.length })
  }
</script>

{#if loading}
  <div class="h-20 animate-pulse rounded-[22px] bg-surface-level-1" aria-busy="true"></div>
{:else if loadError && notifications.length === 0}
  <div class="uneem-card flex items-center gap-3" role="status">
    <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-danger-light text-danger"><Icon name="alert-triangle" size={18} /></div>
    <div class="min-w-0 flex-1"><p class="text-sm font-semibold text-text">{$_('common.error')}</p></div>
    <button type="button" on:click={retry} class="min-h-10 text-sm font-bold text-primary">{$_('common.retry')}</button>
  </div>
{:else if notifications.length > 0}
  <div class="space-y-2.5">
    {#if loadError}
      <div class="flex items-center justify-between gap-3 rounded-2xl bg-warning-light px-4 py-3 text-sm text-warning">
        <span>{$_('common.error')}</span>
        <button type="button" on:click={retry} class="font-bold">{$_('common.retry')}</button>
      </div>
    {/if}

    {#each notifications as notification (notification.id)}
      <article class="uneem-card relative pe-12">
        <button class="absolute end-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full text-text-muted hover:bg-surface-level-1 hover:text-text" on:click={() => dismissNotification(notification.id)} title={$_('notification_banner.dismiss')}>
          <Icon name="x" size={15} />
        </button>
        <div class="flex items-start gap-3">
          <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary"><Icon name="bell" size={18} /></div>
          <div class="min-w-0 flex-1">
            <h3 class="text-sm font-bold leading-5 text-text">{isArabic ? notification.title_ar : notification.title_en}</h3>
            <p class="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{isArabic ? notification.body_ar : notification.body_en}</p>
            <time class="mt-2 block text-xs text-text-muted">{new Date(notification.published_at).toLocaleDateString(isArabic ? 'ar-MA' : 'en', { month: 'short', day: 'numeric' })}</time>
          </div>
        </div>
      </article>
    {/each}
  </div>
{/if}

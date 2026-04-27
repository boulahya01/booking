<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/supabaseClient'
  import { uiState } from '$lib/stores/ui'
  import Card from '$lib/components/Card.svelte'
  import Button from '$lib/components/Button.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte'
  import PhotoThumbnail from '$lib/components/PhotoThumbnail.svelte'
  import PhotoViewerModal from '$lib/components/PhotoViewerModal.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { USE_MOCK, mockUsers, mockDelay } from '$lib/mock'

  let pendingUsers: any[] = []
  let loading = true
  let rejectingId: string | null = null
  let rejectReason = ''
  let error = ''

  // Photo viewer state
  let showPhotoViewer = false
  let viewerTitle = ''
  let viewerUrl: string | null = null
  let viewerNextUrl: string | null = null

  function openPhotoViewer(title: string, url: string | null, nextUrl: string | null = null) {
    if (!url) return
    viewerTitle = title
    viewerUrl = url
    viewerNextUrl = nextUrl
    showPhotoViewer = true
  }

  onMount(async () => {
    await checkAdmin()
    await loadPendingUsers()
  })

  async function checkAdmin() {
    if (USE_MOCK) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      await goto('/login')
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (data?.role !== 'admin') {
      await goto('/home')
    }
  }

  async function loadPendingUsers() {
    if (USE_MOCK) {
      pendingUsers = mockUsers.filter(u => u.status === 'pending')
      loading = false
      return
    }
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (!err && data) {
      pendingUsers = data
    }
    loading = false
  }

  async function approveUser(userId: string) {
    if (!confirm($_('admin.approve_confirm'))) return

    if (USE_MOCK) {
      await mockDelay()
      const u = mockUsers.find(x => x.id === userId)
      if (u) {
        u.status = 'approved'
        u.verification_status = 'verified'
      }
      pendingUsers = mockUsers.filter(u => u.status === 'pending')
      uiState.addToast($_('admin.user_approved'), 'success')
      return
    }

    const { error: err } = await supabase
      .from('profiles')
      .update({ status: 'approved', verification_status: 'verified' })
      .eq('id', userId)

    if (!err) {
      uiState.addToast($_('admin.user_approved'), 'success')
    } else {
      uiState.addToast(err.message, 'error')
    }
  }

  async function rejectUser() {
    if (!rejectingId || !rejectReason) return

    if (USE_MOCK) {
      await mockDelay()
      const u = mockUsers.find(x => x.id === rejectingId)
      if (u) {
        u.status = 'rejected'
        u.verification_status = 'rejected'
        u.verification_notes = rejectReason
      }
      pendingUsers = mockUsers.filter(u => u.status === 'pending')
      uiState.addToast($_('admin.user_rejected'), 'success')
      rejectingId = null
      rejectReason = ''
      return
    }

    const { error: err } = await supabase
      .from('profiles')
      .update({ status: 'rejected', verification_status: 'rejected', verification_notes: rejectReason })
      .eq('id', rejectingId)

    if (!err) {
      uiState.addToast($_('admin.user_rejected'), 'success')
      rejectingId = null
      rejectReason = ''
      await loadPendingUsers()
    } else {
      uiState.addToast(err.message, 'error')
    }
  }
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-2xl font-medium font-serif text-text mb-6">{$_('admin.users_title')}</h1>

  {#if loading}
    <div class="space-y-4">
      <LoadingSkeleton />
      <LoadingSkeleton />
    </div>
  {:else if pendingUsers.length === 0}
    <Card variant="elevated" className="text-center py-12">
      <p class="text-text-secondary">{$_('admin.no_pending_users')}</p>
    </Card>
  {:else}
    <div class="space-y-3">
      {#each pendingUsers as user (user.id)}
        <Card variant="elevated" className="p-4">
          <div class="flex justify-between items-start gap-4 flex-wrap">
            <div class="flex-1">
              <h3 class="text-base font-semibold text-text mb-1">{user.full_name}</h3>
              <p class="text-text-secondary text-sm mb-1">{user.email}</p>
              <p class="text-text-muted text-sm">{user.student_id}</p>

              <!-- Photo Thumbnails -->
              <div class="flex gap-4 mt-3">
                <button
                  type="button"
                  on:click={() => openPhotoViewer($_('admin.view_id_photo'), user.id_photo_url, user.selfie_url)}
                  class="hover:opacity-80 transition-opacity cursor-pointer"
                  aria-label={$_('admin.view_id_photo')}
                >
                  <PhotoThumbnail photoUrl={user.id_photo_url} label={$_('admin.view_id_photo')} size="sm" />
                </button>
                <button
                  type="button"
                  on:click={() => openPhotoViewer($_('admin.view_selfie'), user.selfie_url, user.id_photo_url)}
                  class="hover:opacity-80 transition-opacity cursor-pointer"
                  aria-label={$_('admin.view_selfie')}
                >
                  <PhotoThumbnail photoUrl={user.selfie_url} label={$_('admin.view_selfie')} size="sm" />
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              {#if rejectingId === user.id}
                <div class="space-y-2">
                  <TextField label={$_('admin.rejection_reason_label')} bind:value={rejectReason} />
                  <div class="flex gap-2">
                    <Button variant="primary" size="sm" on:click={rejectUser}>{$_('common.confirm')}</Button>
                    <Button variant="secondary" size="sm" on:click={() => { rejectingId = null; rejectReason = '' }}>{$_('common.cancel')}</Button>
                  </div>
                </div>
              {:else}
                <div class="flex gap-2">
                  <Button variant="primary" size="sm" on:click={() => approveUser(user.id)}>{$_('admin.approve')}</Button>
                  <Button variant="secondary" size="sm" on:click={() => { rejectingId = user.id; rejectReason = '' }}>{$_('admin.reject')}</Button>
                </div>
              {/if}
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<PhotoViewerModal
  open={showPhotoViewer}
  title={viewerTitle}
  photoUrl={viewerUrl}
  nextPhotoUrl={viewerNextUrl}
  on:close={() => (showPhotoViewer = false)}
/>

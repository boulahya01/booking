<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/supabaseClient'
  import { uiState } from '$lib/stores/ui'
  import Card from '$lib/components/Card.svelte'
  import Button from '$lib/components/Button.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { USE_MOCK, mockUsers, mockDelay } from '$lib/mock'
  import { logger } from '$lib/logger'

  let pendingUsers: any[] = []
  let loading = true
  let rejectingId: string | null = null
  let rejectReason = ''
  let error = ''

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
      pendingUsers = mockUsers.filter(u => u.status === 'pending' || u.status === 'rejected')
      loading = false
      return
    }
    // Show users who are pending or rejected
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .in('status', ['pending', 'rejected'])
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
      }
      pendingUsers = mockUsers.filter(u => u.status === 'pending' || u.status === 'rejected')
      uiState.addToast($_('admin.user_approved'), 'success')
      return
    }

    const { error: err } = await supabase
      .from('profiles')
      .update({ status: 'approved' })
      .eq('id', userId)

    if (!err) {
      uiState.addToast($_('admin.user_approved'), 'success')
      await loadPendingUsers()
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
        u.rejection_reason = rejectReason
      }
      pendingUsers = mockUsers.filter(u => u.status === 'pending' || u.status === 'rejected')
      uiState.addToast($_('admin.user_rejected'), 'success')
      rejectingId = null
      rejectReason = ''
      return
    }

    const { error: err } = await supabase
      .from('profiles')
      .update({ status: 'rejected', rejection_reason: rejectReason })
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
              <div class="flex items-center gap-2 mb-1">
                <h3 class="text-base font-semibold text-text">{user.full_name}</h3>
                {#if user.rejection_reason && user.status === 'pending'}
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium" style="background: var(--info-light); color: var(--info);">
                    <Icon name="refresh-cw" size={12} />
                    Resubmitted
                  </span>
                {/if}
              </div>
              <p class="text-text-secondary text-sm mb-1">{user.email}</p>
              <p class="text-text-muted text-sm">{user.student_id}</p>

              {#if user.rejection_reason}
                <div class="mt-2 rounded-lg p-3" style="background: var(--danger-light);">
                  <div class="flex items-start gap-2">
                    <Icon name="alert-triangle" size={16} className="text-danger mt-0.5 flex-shrink-0" />
                    <div>
                      <p class="text-xs font-medium text-danger mb-0.5">Previously rejected</p>
                      <p class="text-xs text-text-secondary">{user.rejection_reason}</p>
                    </div>
                  </div>
                </div>
              {/if}
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

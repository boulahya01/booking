<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/supabaseClient'
  import { uiState } from '$lib/stores/ui'
  import Card from '$lib/components/Card.svelte'
  import Button from '$lib/components/Button.svelte'
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte'
  import { _ } from 'svelte-i18n'
  import { USE_MOCK, mockUsers, mockDelay } from '$lib/mock'

  let users: any[] = []
  let loading = true
  let editingId: string | null = null
  let editingRole = ''

  onMount(async () => {
    await checkAdmin()
    await loadUsers()
  })

  async function checkAdmin() {
    if (USE_MOCK) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { await goto('/login'); return }
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') { await goto('/home') }
  }

  async function loadUsers() {
    if (USE_MOCK) {
      users = mockUsers
      loading = false
      return
    }
    const { data, error: err } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (!err && data) users = data
    loading = false
  }

  async function updateRole(userId: string, newRole: string) {
    if (USE_MOCK) {
      await mockDelay()
      const u = mockUsers.find(x => x.id === userId)
      if (u) u.role = newRole
      users = [...mockUsers]
      uiState.addToast('Role updated!', 'success')
      editingId = null
      return
    }
    const { error: err } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (!err) {
      uiState.addToast('Role updated!', 'success')
      editingId = null
      await loadUsers()
    } else {
      uiState.addToast(err.message, 'error')
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm('Delete this user?')) return

    if (USE_MOCK) {
      await mockDelay()
      const idx = mockUsers.findIndex(x => x.id === userId)
      if (idx !== -1) mockUsers.splice(idx, 1)
      users = [...mockUsers]
      uiState.addToast('User deleted!', 'success')
      return
    }

    const { error: err } = await supabase.from('profiles').delete().eq('id', userId)
    if (!err) {
      uiState.addToast('User deleted!', 'success')
      await loadUsers()
    } else {
      uiState.addToast(err.message, 'error')
    }
  }

  async function toggleSuspend(user: any) {
    const newStatus = user.status === 'suspended' ? 'approved' : 'suspended'

    if (USE_MOCK) {
      await mockDelay()
      const u = mockUsers.find(x => x.id === user.id)
      if (u) u.status = newStatus
      users = [...mockUsers]
      uiState.addToast(newStatus === 'suspended' ? 'User suspended' : 'User unsuspended', 'success')
      return
    }

    const { error: err } = await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id)
    if (!err) {
      uiState.addToast(newStatus === 'suspended' ? 'User suspended' : 'User unsuspended', 'success')
      await loadUsers()
    } else {
      uiState.addToast(err.message, 'error')
    }
  }
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-2xl font-medium font-serif text-text mb-6">{$_('admin.manage_users_title')}</h1>

  {#if loading}
    <div class="space-y-4">
      <LoadingSkeleton />
      <LoadingSkeleton />
    </div>
  {:else if users.length === 0}
    <Card variant="elevated" className="text-center py-12">
      <p class="text-text-secondary">No users found</p>
    </Card>
  {:else}
    <div class="space-y-3">
      {#each users as user (user.id)}
        <Card variant="elevated" className="p-4">
          <div class="flex justify-between items-start gap-4 flex-wrap">
            <div class="flex-1">
              <h3 class="text-base font-semibold text-text mb-1">{user.full_name}</h3>
              <p class="text-text-secondary text-sm mb-1">{user.email || '-'}</p>
              <p class="text-text-muted text-sm mb-2">{user.student_id}</p>
              <div class="flex gap-2 flex-wrap">
                <span class="inline-block px-2 py-0.5 rounded-md text-xs font-semibold {user.role === 'admin' ? 'bg-primary-light text-primary' : 'bg-surface-level-2 text-text-secondary'}">
                  {user.role}
                </span>
                <span class="inline-block px-2 py-0.5 rounded-md text-xs font-semibold {user.status === 'approved' ? 'bg-success-light text-success' : user.status === 'suspended' ? 'bg-danger-light text-danger' : 'bg-primary-light text-primary'}">
                  {user.status}
                </span>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              {#if editingId === user.id}
                <select bind:value={editingRole} class="px-3 py-2 border border-border rounded-lg bg-surface text-text focus:ring-2 focus:ring-info-light focus:border-info transition-all">
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
                <div class="flex gap-2">
                  <Button variant="primary" size="sm" on:click={() => updateRole(user.id, editingRole)}>Save</Button>
                  <Button variant="secondary" size="sm" on:click={() => (editingId = null)}>Cancel</Button>
                </div>
              {:else}
                <Button variant="secondary" size="sm" on:click={() => { editingId = user.id; editingRole = user.role }}>Edit Role</Button>
                <Button variant="secondary" size="sm" on:click={() => toggleSuspend(user)}>
                  {user.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                </Button>
                <Button variant="danger" size="sm" on:click={() => deleteUser(user.id)}>Delete</Button>
              {/if}
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/supabaseClient'
  import { signOut, updatePassword } from '$lib/auth'
  import { uiState } from '$lib/stores/ui'
  import { authState } from '$lib/stores/auth'
  import Card from '$lib/components/Card.svelte'
  import Button from '$lib/components/Button.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { USE_MOCK, mockProfile, mockDelay } from '$lib/mock'
  import { sanitizeName } from '$lib/validation'
  import { logger } from '$lib/logger'

  let profile: any = null
  let loading = true
  let editing = false
  let editingPassword = false
  let fullName = ''
  let email = ''
  let studentId = ''
  let newPassword = ''
  let confirmPassword = ''
  let error = ''
  let message = ''
  let saving = false

  onMount(async () => {
    await loadProfile()
  })

  async function loadProfile() {
    if (USE_MOCK) {
      profile = mockProfile
      fullName = profile.full_name
      email = profile.email
      studentId = profile.student_id
      loading = false
      return
    }
    try {
      logger.debug('[loadProfile] Starting profile load')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        logger.warn('[loadProfile] No authenticated user, redirecting to login')
        await goto('/login')
        return
      }

      logger.debug('[loadProfile] Fetching profile for user:', user.id)
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError || !data) {
        logger.error('[loadProfile] Profile fetch error:', profileError)
        uiState.addToast('Failed to load profile', 'error')
        loading = false
        return
      }

      logger.debug('[loadProfile] Profile loaded successfully')
      profile = data
      fullName = profile?.full_name || ''
      email = user.email || ''
      studentId = profile?.student_id || ''
    } catch (e: any) {
      logger.error('[loadProfile] Exception:', e)
      uiState.addToast('Failed to load profile', 'error')
    } finally {
      loading = false
    }
  }

  async function saveProfile() {
    error = ''
    message = ''
    const cleanName = sanitizeName(fullName)
    if (!cleanName) {
      error = $_('profile.error_name_required')
      return
    }

    saving = true

    const saveTimeout = 30000
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Save timed out after 30 seconds')), saveTimeout)
    })

    const savePromise = (async () => {
      try {
        if (USE_MOCK) {
          await mockDelay()
          profile.full_name = cleanName
          mockProfile.full_name = cleanName
          if (profile.status === 'pending' || profile.status === 'rejected') {
            profile.student_id = studentId
            mockProfile.student_id = studentId
          }
          message = $_('profile.success_updated')
          uiState.addToast(message, 'success')
          editing = false
          saving = false
          return
        }

        const updateData: any = { full_name: cleanName }

        if (profile.status === 'pending' || profile.status === 'rejected') {
          updateData.student_id = studentId
        }

        logger.debug('[saveProfile] Updating profile with data:', updateData)

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          logger.error('[saveProfile] Auth error during save:', authError)
          error = 'Authentication error. Please log in again.'
          return
        }

        logger.debug('[saveProfile] Authenticated user:', user.id)

        const { error: err } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id)

        if (err) {
          logger.error('[saveProfile] Update error:', err)
          if (err.code === '23505') {
            error = $_('profile.error_student_id_exists')
          } else if (err.code === '42501') {
            error = 'Permission denied. You may not have rights to update this profile.'
          } else {
            error = `Update failed: ${err.message}`
          }
          return
        }

        message = $_('profile.success_updated')
        uiState.addToast(message, 'success')

        editing = false
        await loadProfile()
      } catch (err: any) {
        logger.error('[saveProfile] Exception:', err)
        error = $_('profile.error_update_failed')
      } finally {
        saving = false
      }
    })()

    try {
      await Promise.race([savePromise, timeoutPromise])
    } catch (timeoutErr) {
      logger.error('[saveProfile] Timeout error:', timeoutErr)
      error = 'Request timed out. Please try again.'
      saving = false
    }
  }

  async function changePassword() {
    error = ''
    message = ''

    if (!newPassword || !confirmPassword) {
      error = $_('profile.error_password_required')
      return
    }
    if (newPassword !== confirmPassword) {
      error = $_('profile.error_password_mismatch')
      return
    }
    if (newPassword.length < 8) {
      error = $_('profile.error_password_short')
      return
    }

    saving = true
    try {
      const result = await updatePassword(newPassword)
      if (result.error) {
        error = result.error.message
        return
      }

      message = $_('profile.success_password_changed')
      uiState.addToast(message, 'success')
      editingPassword = false
      newPassword = ''
      confirmPassword = ''
    } catch (err: any) {
      error = $_('profile.error_password_failed')
    } finally {
      saving = false
    }
  }

  async function logout() {
    await signOut()
    await goto('/login')
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  $: statusStyle = profile?.status === 'approved'
    ? 'background: var(--success-light/60); color: var(--success); border-color: rgba(5, 150, 105, 0.15);'
    : profile?.status === 'pending'
    ? 'background: var(--warning-light/60); color: var(--warning); border-color: rgba(217, 119, 6, 0.15);'
    : profile?.status === 'rejected'
    ? 'background: var(--danger-light/60); color: var(--danger); border-color: rgba(220, 38, 38, 0.15);'
    : 'background: var(--surface-level-1); color: var(--text-muted); border-color: var(--border);'
</script>

<div class="max-w-2xl mx-auto px-4 py-6 min-h-screen" style="background: var(--bg);">
  {#if loading}
    <!-- Profile loading skeleton -->
    <div class="space-y-4">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-xl animate-pulse" style="background: var(--surface-level-1);"></div>
        <div class="flex-1 space-y-2">
          <div class="h-7 w-40 rounded animate-pulse" style="background: var(--surface-level-1);"></div>
          <div class="h-4 w-56 rounded animate-pulse" style="background: var(--surface-level-1);"></div>
          <div class="flex gap-2 mt-2">
            <div class="h-5 w-16 rounded-full animate-pulse" style="background: var(--surface-level-1);"></div>
            <div class="h-5 w-16 rounded-full animate-pulse" style="background: var(--surface-level-1);"></div>
          </div>
        </div>
      </div>
      <div class="rounded-xl p-4 animate-pulse space-y-3" style="background: var(--surface); border: 1px solid var(--border);">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg" style="background: var(--surface-level-1);"></div>
            <div class="h-5 w-28 rounded" style="background: var(--surface-level-1);"></div>
          </div>
          <div class="h-8 w-14 rounded" style="background: var(--surface-level-1);"></div>
        </div>
        <div class="space-y-3 pt-3">
          <div class="h-4 w-full rounded" style="background: var(--surface-level-1);"></div>
          <div class="h-4 w-3/4 rounded" style="background: var(--surface-level-1);"></div>
          <div class="h-4 w-1/2 rounded" style="background: var(--surface-level-1);"></div>
        </div>
      </div>
      <div class="rounded-xl p-4 animate-pulse space-y-3" style="background: var(--surface); border: 1px solid var(--border);">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg" style="background: var(--surface-level-1);"></div>
          <div class="h-5 w-24 rounded" style="background: var(--surface-level-1);"></div>
        </div>
        <div class="h-32 rounded-lg" style="background: var(--surface-level-1);"></div>
      </div>
    </div>
  {:else if profile}
    <!-- Profile Header -->
    <div class="flex items-center gap-4 mb-6">
      <div class="w-14 h-14 rounded-xl flex items-center justify-center text-primary text-lg font-bold flex-shrink-0"
           style="background: var(--primary-light); box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.1);">
        {getInitials(profile.full_name)}
      </div>
      <div>
        <h1 class="text-2xl font-serif font-medium" style="color: var(--text);">{profile.full_name}</h1>
        <p class="text-sm" style="color: var(--text-secondary);">{email}</p>
        <div class="flex items-center gap-2 mt-1.5">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold border" style={statusStyle}>
            {profile.status === 'approved' ? 'Approved' : profile.status === 'pending' ? 'Pending' : profile.status === 'rejected' ? 'Rejected' : profile.status}
          </span>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style="background: var(--primary-light/60); color: var(--primary); box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.1);">
            {profile.role === 'admin' ? $_('profile.admin') : $_('profile.student')}
          </span>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <!-- Personal Info Card -->
      <Card variant="elevated" className="overflow-hidden">
        <div class="p-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <Icon name="user" size={16} className="text-primary" />
              <h2 class="text-base font-medium font-serif text-text">{$_('profile.subtitle')}</h2>
            </div>
            {#if !editing}
              <button
                on:click={() => (editing = true)}
                class="flex items-center gap-1 text-sm text-primary font-medium hover:underline"
              >
                <Icon name="pencil" size={14} />
                {$_('common.edit')}
              </button>
            {/if}
          </div>

          {#if message}
            <div class="bg-success-light border border-success/20 text-success p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
              <Icon name="check" size={16} />
              {message}
            </div>
          {/if}
          {#if error && !editingPassword}
            <div class="bg-danger-light border border-danger/20 text-danger p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
              <Icon name="x" size={16} />
              {error}
            </div>
          {/if}

          {#if editing}
            <div class="space-y-4">
              <TextField label={$_('profile.full_name_label')} bind:value={fullName} disabled={saving} />
              <TextField label={$_('profile.email_label')} bind:value={email} disabled={true} />
              <div>
                <TextField label={$_('profile.student_id_label')} bind:value={studentId} disabled={saving || profile.status === 'approved'} />
                {#if profile.status === 'pending' || profile.status === 'rejected'}
                  <p class="text-xs mt-1" style="color: var(--text-muted);">You can update your student ID while your account is pending.</p>
                {/if}
              </div>
              <div class="flex gap-3 pt-1">
                <Button variant="primary" size="md" loading={saving} className="flex-1" on:click={saveProfile}>
                  {saving ? $_('profile.saving') : $_('common.save')}
                </Button>
                <Button variant="secondary" size="md" disabled={saving} className="flex-1" on:click={() => (editing = false)}>
                  {$_('common.cancel')}
                </Button>
              </div>
            </div>
          {:else}
            <div class="space-y-0">
              <div class="flex justify-between items-center py-2.5" style="border-bottom: 1px solid var(--border);">
                <span class="text-sm" style="color: var(--text-muted);">{$_('profile.full_name_label')}</span>
                <span class="font-medium" style="color: var(--text);">{profile.full_name}</span>
              </div>
              <div class="flex justify-between items-center py-2.5" style="border-bottom: 1px solid var(--border);">
                <span class="text-sm" style="color: var(--text-muted);">{$_('profile.email_label')}</span>
                <span class="font-medium" style="color: var(--text);">{email}</span>
              </div>
              <div class="flex justify-between items-center py-2.5" style="border-bottom: 1px solid var(--border);">
                <span class="text-sm" style="color: var(--text-muted);">{$_('profile.student_id_label')}</span>
                <span class="font-medium" style="color: var(--text);">{profile.student_id}</span>
              </div>
              <div class="flex justify-between items-center py-2.5">
                <span class="text-sm" style="color: var(--text-muted);">{$_('profile.role')}</span>
                <span class="font-medium" style="color: var(--text);">{profile.role === 'admin' ? $_('profile.admin') : $_('profile.student')}</span>
              </div>
            </div>
          {/if}
        </div>
      </Card>

      <!-- Security Card -->
      <Card variant="elevated" className="overflow-hidden">
        <div class="p-4">
          <div class="flex items-center gap-2 mb-4">
            <Icon name="lock" size={16} className="text-primary" />
            <h2 class="text-base font-medium font-serif text-text">{$_('profile.change_password')}</h2>
          </div>

          {#if editingPassword}
            {#if error && editingPassword}
              <div class="bg-danger-light border border-danger/20 text-danger p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                <Icon name="x" size={16} />
                {error}
              </div>
            {/if}
            <div class="space-y-4">
              <TextField label={$_('reset_password.new_password_label')} type="password" bind:value={newPassword} disabled={saving} />
              <TextField label={$_('reset_password.confirm_password_label')} type="password" bind:value={confirmPassword} disabled={saving} />
              <div class="flex gap-3 pt-1">
                <Button variant="primary" size="md" loading={saving} className="flex-1" on:click={changePassword}>
                  {saving ? $_('profile.update_password_saving') : $_('common.save')}
                </Button>
                <Button variant="secondary" size="md" disabled={saving} className="flex-1" on:click={() => { editingPassword = false; error = '' }}>
                  {$_('common.cancel')}
                </Button>
              </div>
            </div>
          {:else}
            <p class="text-text-secondary text-sm mb-4">{$_('profile.password_hint')}</p>
            <Button variant="secondary" size="md" className="w-full" on:click={() => (editingPassword = true)}>
              {$_('profile.change_password')}
            </Button>
          {/if}
        </div>
      </Card>

      <!-- Logout -->
      <button
        on:click={logout}
        class="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5"
        style="color: var(--danger); background: var(--danger-light/30); box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.12);">
        <Icon name="log-out" size={18} />
        {$_('nav.logout')}
      </button>
    </div>
  {/if}
</div>

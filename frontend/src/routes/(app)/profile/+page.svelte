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
  import Icon from '$lib/components/Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { USE_MOCK, mockProfile, mockDelay } from '$lib/mock'
  import { sanitizeName } from '$lib/validation'

  let profile: any = null
  let loading = true
  let editing = false
  let editingPassword = false
  let fullName = ''
  let email = ''
  let newPassword = ''
  let confirmPassword = ''
  let error = ''
  let message = ''
  let saving = false
  let showPasswordHints = false

  $: passwordLength = newPassword.length >= 8
  $: passwordNumber = /\d/.test(newPassword)
  $: passwordSpecial = /[!@#$%^&*()-+]/.test(newPassword)
  $: passwordUppercase = /[A-Z]/.test(newPassword)
  $: passwordAllMet = passwordLength && passwordNumber && passwordSpecial && passwordUppercase

  onMount(() => void loadProfile())

  async function loadProfile() {
    loading = true
    error = ''

    if (USE_MOCK) {
      profile = mockProfile
      fullName = profile.full_name
      email = profile.email
      loading = false
      return
    }

    const currentUser = $authState.user
    if (!currentUser?.id) {
      loading = false
      await goto('/login')
      return
    }

    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id,student_id,full_name,role,status,created_at,updated_at')
        .eq('id', currentUser.id)
        .single()

      if (profileError || !data) throw profileError || new Error('profile_not_found')

      profile = data
      fullName = data.full_name
      email = currentUser.email || ''
    } catch {
      error = $_('common.error')
    } finally {
      loading = false
    }
  }

  async function saveProfile() {
    error = ''
    message = ''
    const cleanName = sanitizeName(fullName)

    if (!cleanName || cleanName.length < 2) {
      error = $_('profile.error_name_required')
      return
    }

    saving = true
    try {
      if (USE_MOCK) {
        await mockDelay()
        profile = { ...profile, full_name: cleanName }
        mockProfile.full_name = cleanName
      } else {
        const { data, error: updateError } = await supabase.rpc('update_my_profile', {
          p_full_name: cleanName
        })

        if (updateError) throw updateError
        const updated = Array.isArray(data) ? data[0] : data
        profile = updated || { ...profile, full_name: cleanName }

        if ($authState.user) {
          authState.setUser({ ...$authState.user, full_name: profile.full_name })
        }
      }

      message = $_('profile.success_updated')
      uiState.addToast(message, 'success')
      editing = false
    } catch {
      error = $_('profile.error_update_failed')
    } finally {
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
    if (!passwordAllMet) {
      error = $_('profile.error_password_short')
      return
    }

    saving = true
    try {
      const result = await updatePassword(newPassword)
      if (result.error) throw new Error(result.error.message)

      message = $_('profile.success_password_changed')
      uiState.addToast(message, 'success')
      editingPassword = false
      newPassword = ''
      confirmPassword = ''
      showPasswordHints = false
    } catch {
      error = $_('profile.error_password_failed')
    } finally {
      saving = false
    }
  }

  async function logout() {
    await signOut()
    authState.clear()
    await goto('/login')
  }

  function getInitials(name: string) {
    return name?.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function checkMark(valid: boolean) {
    return valid ? 'text-success' : 'text-text-muted'
  }

  $: statusStyle = profile?.status === 'approved'
    ? 'background: var(--success-light/60); color: var(--success); border-color: rgba(5, 150, 105, 0.15);'
    : profile?.status === 'pending'
      ? 'background: var(--warning-light/60); color: var(--warning); border-color: rgba(217, 119, 6, 0.15);'
      : 'background: var(--surface-level-1); color: var(--text-muted); border-color: var(--border);'
</script>

<div class="max-w-2xl mx-auto px-4 py-6 min-h-screen" style="background: var(--bg);">
  {#if loading}
    <div class="space-y-4" aria-busy="true">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-xl animate-pulse" style="background: var(--surface-level-1);"></div>
        <div class="flex-1 space-y-2">
          <div class="h-7 w-40 rounded animate-pulse" style="background: var(--surface-level-1);"></div>
          <div class="h-4 w-56 rounded animate-pulse" style="background: var(--surface-level-1);"></div>
        </div>
      </div>
      <div class="h-56 rounded-xl animate-pulse" style="background: var(--surface-level-1);"></div>
    </div>
  {:else if error && !profile}
    <div class="rounded-xl p-5 text-center" style="background: var(--danger-light); color: var(--danger);">
      <Icon name="alert-triangle" size={28} className="mx-auto mb-3" />
      <p class="font-medium">{error}</p>
      <button on:click={loadProfile} class="mt-3 text-sm font-semibold text-primary hover:underline">{$_('common.retry')}</button>
    </div>
  {:else if profile}
    <div class="flex items-center gap-4 mb-6">
      <div class="w-14 h-14 rounded-xl flex items-center justify-center text-primary text-lg font-bold flex-shrink-0"
           style="background: var(--primary-light); box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.1);">
        {getInitials(profile.full_name)}
      </div>
      <div class="min-w-0">
        <h1 class="text-2xl font-serif font-medium truncate" style="color: var(--text);">{profile.full_name}</h1>
        <p class="text-sm break-all" style="color: var(--text-secondary);">{email}</p>
        <div class="flex items-center gap-2 mt-1.5">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold border" style={statusStyle}>
            {profile.status === 'approved' ? 'Approved' : profile.status === 'pending' ? 'Pending' : profile.status}
          </span>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style="background: var(--primary-light/60); color: var(--primary); box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.1);">
            {profile.role === 'admin' ? $_('profile.admin') : $_('profile.student')}
          </span>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <Card variant="elevated" className="overflow-hidden">
        <div class="p-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <Icon name="user" size={16} className="text-primary" />
              <h2 class="text-base font-medium font-serif text-text">{$_('profile.subtitle')}</h2>
            </div>
            {#if !editing}
              <button on:click={() => { editing = true; error = ''; message = '' }} class="flex items-center gap-1 text-sm text-primary font-medium hover:underline">
                <Icon name="pencil" size={14} />
                {$_('common.edit')}
              </button>
            {/if}
          </div>

          {#if message}
            <div class="bg-success-light border border-success/20 text-success p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
              <Icon name="check" size={16} />{message}
            </div>
          {/if}
          {#if error && !editingPassword}
            <div class="bg-danger-light border border-danger/20 text-danger p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
              <Icon name="x" size={16} />{error}
            </div>
          {/if}

          {#if editing}
            <div class="space-y-4">
              <TextField label={$_('profile.full_name_label')} bind:value={fullName} disabled={saving} />
              <TextField label={$_('profile.email_label')} bind:value={email} disabled={true} />
              <TextField label={$_('profile.student_id_label')} value={profile.student_id} disabled={true} />
              <p class="text-xs" style="color: var(--text-muted);">Student ID is part of your verified university identity and cannot be changed here.</p>
              <div class="flex gap-3 pt-1">
                <Button variant="primary" size="md" loading={saving} className="flex-1" on:click={saveProfile}>
                  {saving ? $_('profile.saving') : $_('common.save')}
                </Button>
                <Button variant="secondary" size="md" disabled={saving} className="flex-1" on:click={() => { editing = false; fullName = profile.full_name; error = '' }}>
                  {$_('common.cancel')}
                </Button>
              </div>
            </div>
          {:else}
            <div class="space-y-0">
              <div class="flex justify-between items-center py-2.5 border-b border-border">
                <span class="text-sm text-text-muted">{$_('profile.full_name_label')}</span>
                <span class="font-medium max-w-[180px] truncate text-text">{profile.full_name}</span>
              </div>
              <div class="flex justify-between items-center py-2.5 border-b border-border">
                <span class="text-sm text-text-muted">{$_('profile.email_label')}</span>
                <span class="font-medium max-w-[180px] truncate text-text">{email}</span>
              </div>
              <div class="flex justify-between items-center py-2.5 border-b border-border">
                <span class="text-sm text-text-muted">{$_('profile.student_id_label')}</span>
                <span class="font-medium text-text">{profile.student_id}</span>
              </div>
              <div class="flex justify-between items-center py-2.5">
                <span class="text-sm text-text-muted">{$_('profile.role')}</span>
                <span class="font-medium text-text">{profile.role === 'admin' ? $_('profile.admin') : $_('profile.student')}</span>
              </div>
            </div>
          {/if}
        </div>
      </Card>

      <Card variant="elevated" className="overflow-hidden">
        <div class="p-4">
          <div class="flex items-center gap-2 mb-4">
            <Icon name="lock" size={16} className="text-primary" />
            <h2 class="text-base font-medium font-serif text-text">{$_('profile.change_password')}</h2>
          </div>

          {#if editingPassword}
            {#if error}
              <div class="bg-danger-light border border-danger/20 text-danger p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                <Icon name="x" size={16} />{error}
              </div>
            {/if}
            <div class="space-y-4">
              <TextField
                label={$_('reset_password.new_password_label')}
                type="password"
                bind:value={newPassword}
                disabled={saving}
                on:focus={() => showPasswordHints = true}
              />
              {#if showPasswordHints}
                <div class="bg-surface-level-1/50 rounded-lg p-3 space-y-1.5">
                  <p class="text-xs font-medium text-text-secondary mb-2">{$_('register.password_requirements')}</p>
                  <div class="flex items-center gap-2 text-xs"><Icon name={passwordLength ? 'check' : 'x'} size={14} className={checkMark(passwordLength)} /><span>{$_('register.hint_password_length')}</span></div>
                  <div class="flex items-center gap-2 text-xs"><Icon name={passwordUppercase ? 'check' : 'x'} size={14} className={checkMark(passwordUppercase)} /><span>{$_('register.hint_password_uppercase')}</span></div>
                  <div class="flex items-center gap-2 text-xs"><Icon name={passwordNumber ? 'check' : 'x'} size={14} className={checkMark(passwordNumber)} /><span>{$_('register.hint_password_number')}</span></div>
                  <div class="flex items-center gap-2 text-xs"><Icon name={passwordSpecial ? 'check' : 'x'} size={14} className={checkMark(passwordSpecial)} /><span>{$_('register.hint_password_special')}</span></div>
                </div>
              {/if}
              <TextField label={$_('reset_password.confirm_password_label')} type="password" bind:value={confirmPassword} disabled={saving} />
              <div class="flex gap-3 pt-1">
                <Button variant="primary" size="md" loading={saving} className="flex-1" on:click={changePassword}>{$_('common.save')}</Button>
                <Button variant="secondary" size="md" disabled={saving} className="flex-1" on:click={() => { editingPassword = false; error = ''; newPassword = ''; confirmPassword = ''; showPasswordHints = false }}>{$_('common.cancel')}</Button>
              </div>
            </div>
          {:else}
            <p class="text-text-secondary text-sm mb-4">{$_('profile.password_hint')}</p>
            <Button variant="secondary" size="md" className="w-full" on:click={() => { editingPassword = true; error = ''; message = '' }}>
              {$_('profile.change_password')}
            </Button>
          {/if}
        </div>
      </Card>

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

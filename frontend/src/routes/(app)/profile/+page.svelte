<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/supabaseClient'
  import { signOut, updatePassword } from '$lib/auth'
  import { uiState, language } from '$lib/stores/ui'
  import { authState } from '$lib/stores/auth'
  import Button from '$lib/components/Button.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { USE_MOCK, mockProfile, mockDelay } from '$lib/mock'
  import { sanitizeName } from '$lib/validation'
  import { isValidPassword } from '$lib/utils/cn'

  type FieldState = 'idle' | 'valid' | 'invalid'

  let profile: any = null
  let loading = true
  let editing = false
  let editingPassword = false
  let fullName = ''
  let email = ''
  let newPassword = ''
  let confirmPassword = ''
  let error = ''
  let saving = false
  let profileAttempted = false
  let passwordAttempted = false

  $: ar = $language === 'ar'
  $: account = $authState.account
  $: cleanName = sanitizeName(fullName)
  $: nameValid = cleanName.length >= 2
  $: nameState = fieldState(fullName.length > 0 || profileAttempted, nameValid)
  $: passwordLength = newPassword.length >= 8
  $: passwordNumber = /\d/.test(newPassword)
  $: passwordSymbol = /[!@#$%^&*()\-+]/.test(newPassword)
  $: passwordValid = isValidPassword(newPassword)
  $: confirmValid = confirmPassword.length > 0 && confirmPassword === newPassword
  $: passwordState = fieldState(newPassword.length > 0 || passwordAttempted, passwordValid)
  $: confirmState = fieldState(confirmPassword.length > 0 || passwordAttempted, confirmValid)

  $: copy = ar ? {
    title:'حسابي', edit:'تعديل', done:'تم', profile:'الملف', security:'الأمان', account:'الحساب',
    fullName:'الاسم الكامل', namePlaceholder:'Mehdi El Amrani', invalidName:'اكتب الاسم الكامل.', nameReady:'الاسم جاهز',
    email:'البريد', username:'اسم المستخدم', studentId:'رقم الطالب', role:'الدور', student:'طالب', admin:'مشرف',
    status:'الحالة', approved:'مسموح', pending:'قيد المراجعة', suspended:'موقوف',
    identity:'توثيق الطالب', verified:'موثّق', required:'مطلوب', reviewing:'قيد المراجعة', rejected:'يحتاج تصحيح', conflict:'يحتاج مراجعة', verify:'أكمل التوثيق', statusAction:'شوف حالة الحساب',
    save:'حفظ', cancel:'إلغاء', changePassword:'تغيير كلمة المرور', passwordHint:'حدّث كلمة المرور عند الحاجة.',
    newPassword:'كلمة المرور الجديدة', confirmPassword:'تأكيد كلمة المرور', requiredPassword:'أنشئ كلمة مرور.', ready:'جاهزة', match:'متطابقة', mismatch:'غير متطابقة',
    ruleLength:'8+ أحرف', ruleNumber:'رقم', ruleSymbol:'رمز', updatePassword:'تحديث كلمة المرور', signOut:'تسجيل الخروج',
    profileError:'تعذر تحميل الحساب.', saveError:'تعذر حفظ التغييرات.', passwordError:'تعذر تحديث كلمة المرور.', saved:'تم حفظ التغييرات.', passwordSaved:'تم تحديث كلمة المرور.'
  } : {
    title:'Profile', edit:'Edit', done:'Done', profile:'Profile', security:'Security', account:'Account',
    fullName:'Full name', namePlaceholder:'Mehdi El Amrani', invalidName:'Enter your full name.', nameReady:'Looks good',
    email:'Email', username:'Username', studentId:'Student ID', role:'Role', student:'Student', admin:'Admin',
    status:'Status', approved:'Active', pending:'Pending', suspended:'Suspended',
    identity:'Student verification', verified:'Verified', required:'Required', reviewing:'In review', rejected:'Needs correction', conflict:'Needs review', verify:'Finish verification', statusAction:'Account status',
    save:'Save', cancel:'Cancel', changePassword:'Change password', passwordHint:'Update your password when you need to.',
    newPassword:'New password', confirmPassword:'Confirm password', requiredPassword:'Create a password.', ready:'Ready', match:'Passwords match', mismatch:'Doesn’t match',
    ruleLength:'8+ chars', ruleNumber:'1 number', ruleSymbol:'1 symbol', updatePassword:'Update password', signOut:'Sign out',
    profileError:'Couldn’t load your profile.', saveError:'Couldn’t save changes.', passwordError:'Couldn’t update your password.', saved:'Profile updated.', passwordSaved:'Password updated.'
  }

  onMount(() => void loadProfile())

  function fieldState(active: boolean, valid: boolean): FieldState {
    if (!active) return 'idle'
    return valid ? 'valid' : 'invalid'
  }

  function getInitials(name: string) {
    return name?.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U'
  }

  function statusLabel(value: string) {
    if (value === 'approved') return copy.approved
    if (value === 'suspended') return copy.suspended
    return copy.pending
  }

  function identityLabel(value?: string) {
    if (value === 'verified') return copy.verified
    if (value === 'pending') return copy.reviewing
    if (value === 'rejected') return copy.rejected
    if (value === 'conflict') return copy.conflict
    return copy.required
  }

  function identityTone(value?: string) {
    if (value === 'verified') return 'bg-success-light text-success'
    if (value === 'rejected' || value === 'conflict') return 'bg-danger-light text-danger'
    return 'bg-warning-light text-warning'
  }

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
        .select('id,student_id,full_name,username,role,status,email_kind,identity_status,created_at,updated_at')
        .eq('id', currentUser.id)
        .single()

      if (profileError || !data) throw profileError || new Error('profile_not_found')
      profile = data
      fullName = data.full_name
      email = currentUser.email || ''
    } catch {
      error = copy.profileError
    } finally {
      loading = false
    }
  }

  async function saveProfile() {
    error = ''
    profileAttempted = true
    if (!nameValid) return

    saving = true
    try {
      if (USE_MOCK) {
        await mockDelay()
        profile = { ...profile, full_name: cleanName }
        mockProfile.full_name = cleanName
      } else {
        const { data, error: updateError } = await supabase.rpc('update_my_profile', { p_full_name: cleanName })
        if (updateError) throw updateError
        const updated = Array.isArray(data) ? data[0] : data
        profile = updated ? { ...profile, ...updated } : { ...profile, full_name: cleanName }
        if ($authState.user) authState.setUser({ ...$authState.user, full_name: profile.full_name })
      }
      uiState.addToast(copy.saved, 'success')
      editing = false
      profileAttempted = false
    } catch {
      error = copy.saveError
    } finally {
      saving = false
    }
  }

  async function changePassword() {
    error = ''
    passwordAttempted = true
    if (!passwordValid || !confirmValid) return

    saving = true
    try {
      const result = await updatePassword(newPassword)
      if (result.error) throw new Error(result.error.message)
      uiState.addToast(copy.passwordSaved, 'success')
      editingPassword = false
      newPassword = ''
      confirmPassword = ''
      passwordAttempted = false
    } catch {
      error = copy.passwordError
    } finally {
      saving = false
    }
  }

  async function logout() {
    await signOut()
    authState.clear()
    await goto('/login')
  }
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>

<main class="uneem-page-narrow">
  {#if loading}
    <div class="space-y-4" aria-busy="true">
      <div class="flex items-center gap-4"><div class="h-16 w-16 animate-pulse rounded-full bg-surface-level-1"></div><div class="flex-1 space-y-2"><div class="h-6 w-36 animate-pulse rounded-full bg-surface-level-1"></div><div class="h-4 w-28 animate-pulse rounded-full bg-surface-level-1"></div></div></div>
      <div class="h-64 animate-pulse rounded-[22px] bg-surface-level-1"></div>
    </div>
  {:else if error && !profile}
    <div class="uneem-card text-center">
      <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger-light text-danger"><Icon name="alert-triangle" size={22}/></div>
      <p class="mt-3 font-semibold text-danger">{error}</p>
      <button on:click={loadProfile} class="mt-3 min-h-10 text-sm font-bold text-primary">Retry</button>
    </div>
  {:else if profile}
    <header class="mb-6 flex items-center gap-4">
      <div class="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary-light text-lg font-extrabold text-primary">{getInitials(profile.full_name)}</div>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-2xl font-extrabold tracking-[-0.03em] text-text">{profile.full_name}</h1>
        {#if profile.username}<p class="mt-0.5 truncate text-sm font-semibold text-primary">@{profile.username}</p>{/if}
        <p class="mt-1 truncate text-sm text-text-muted">{email}</p>
      </div>
    </header>

    {#if error}<div class="mb-4 rounded-2xl bg-danger-light px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</div>{/if}

    {#if account?.identity_status !== 'verified' || account?.access_status !== 'approved'}
      <a href={account?.access_status === 'approved' ? '/verification' : '/pending-approval'} class="mb-5 flex items-center gap-3 rounded-[22px] bg-warning-light p-4 text-warning">
        <div class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface/70"><Icon name="shield" size={20}/></div>
        <div class="min-w-0 flex-1"><p class="font-bold">{account?.access_status === 'suspended' ? copy.statusAction : copy.identity}</p><p class="mt-0.5 text-sm opacity-80">{account?.access_status === 'suspended' ? copy.suspended : identityLabel(account?.identity_status)}</p></div>
        <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18}/>
      </a>
    {/if}

    <section class="uneem-panel overflow-hidden">
      <div class="flex min-h-14 items-center justify-between border-b border-border-light px-4">
        <h2 class="font-bold text-text">{copy.profile}</h2>
        {#if !editing}<button on:click={() => { editing = true; error = '' }} class="min-h-10 text-sm font-bold text-primary">{copy.edit}</button>{/if}
      </div>

      {#if editing}
        <div class="space-y-4 p-4">
          <TextField label={copy.fullName} placeholder={copy.namePlaceholder} icon="user" autocomplete="name" bind:value={fullName} validation={nameState} hint={nameState === 'invalid' ? copy.invalidName : ''} validHint={copy.nameReady} disabled={saving}/>
          <div class="flex gap-3"><Button size="lg" className="flex-1" loading={saving} on:click={saveProfile}>{copy.save}</Button><Button variant="secondary" size="lg" className="flex-1" disabled={saving} on:click={() => { editing = false; fullName = profile.full_name; error = ''; profileAttempted = false }}>{copy.cancel}</Button></div>
        </div>
      {:else}
        <div class="px-4">
          <div class="uneem-list-row"><span class="flex-1 text-sm text-text-muted">{copy.username}</span><span class="max-w-[60%] truncate text-sm font-bold text-text">{profile.username ? `@${profile.username}` : '—'}</span></div>
          <div class="uneem-list-row"><span class="flex-1 text-sm text-text-muted">{copy.email}</span><span class="max-w-[60%] truncate text-sm font-semibold text-text">{email}</span></div>
          <div class="uneem-list-row"><span class="flex-1 text-sm text-text-muted">{copy.studentId}</span><span class="text-sm font-semibold text-text">{profile.student_id || '—'}</span></div>
          <div class="uneem-list-row"><span class="flex-1 text-sm text-text-muted">{copy.status}</span><span class="rounded-full bg-surface-level-1 px-2.5 py-1 text-xs font-bold text-text-secondary">{statusLabel(account?.access_status || profile.status)}</span></div>
          <div class="uneem-list-row"><span class="flex-1 text-sm text-text-muted">{copy.identity}</span><span class={`rounded-full px-2.5 py-1 text-xs font-bold ${identityTone(account?.identity_status || profile.identity_status)}`}>{identityLabel(account?.identity_status || profile.identity_status)}</span></div>
          <div class="uneem-list-row"><span class="flex-1 text-sm text-text-muted">{copy.role}</span><span class="text-sm font-semibold text-text">{profile.role === 'admin' ? copy.admin : copy.student}</span></div>
        </div>
      {/if}
    </section>

    <section class="mt-4 uneem-panel overflow-hidden">
      <div class="flex min-h-14 items-center justify-between border-b border-border-light px-4">
        <div><h2 class="font-bold text-text">{copy.security}</h2>{#if !editingPassword}<p class="mt-0.5 text-xs text-text-muted">{copy.passwordHint}</p>{/if}</div>
        {#if !editingPassword}<button on:click={() => { editingPassword = true; error = '' }} class="min-h-10 text-sm font-bold text-primary">{copy.changePassword}</button>{/if}
      </div>

      {#if editingPassword}
        <div class="space-y-4 p-4">
          <TextField label={copy.newPassword} type="password" placeholder="8+ characters" icon="lock" autocomplete="new-password" bind:value={newPassword} validation={passwordState} hint={passwordState === 'invalid' && passwordAttempted && !newPassword ? copy.requiredPassword : ''} validHint={copy.ready} disabled={saving}/>
          <div class="grid grid-cols-3 gap-2 px-1 text-xs font-semibold" aria-live="polite">
            {#each [{label:copy.ruleLength,passed:passwordLength},{label:copy.ruleNumber,passed:passwordNumber},{label:copy.ruleSymbol,passed:passwordSymbol}] as rule}
              <div class={`flex items-center gap-1.5 ${!newPassword ? 'text-text-muted' : rule.passed ? 'text-success' : 'text-danger'}`}><Icon name={rule.passed ? 'check' : 'x'} size={12}/><span>{rule.label}</span></div>
            {/each}
          </div>
          <TextField label={copy.confirmPassword} type="password" placeholder={copy.confirmPassword} icon="lock" autocomplete="new-password" bind:value={confirmPassword} validation={confirmState} hint={confirmState === 'invalid' ? copy.mismatch : ''} validHint={copy.match} disabled={saving}/>
          <div class="flex gap-3"><Button size="lg" className="flex-1" loading={saving} on:click={changePassword}>{copy.updatePassword}</Button><Button variant="secondary" size="lg" className="flex-1" disabled={saving} on:click={() => { editingPassword=false; newPassword=''; confirmPassword=''; error=''; passwordAttempted=false }}>{copy.cancel}</Button></div>
        </div>
      {/if}
    </section>

    <div class="mt-5 grid gap-2.5 sm:grid-cols-2">
      <a href="/help" class="uneem-secondary-action"><Icon name="mail" size={17}/>{ar ? 'المساعدة' : 'Help & support'}</a>
      <button on:click={logout} class="flex min-h-[50px] items-center justify-center gap-2 rounded-[18px] bg-danger-light px-4 font-bold text-danger"><Icon name="log-out" size={17}/>{copy.signOut}</button>
    </div>
  {/if}
</main>

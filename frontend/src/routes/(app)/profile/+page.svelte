<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import { updatePassword } from '$lib/auth'
  import { emailConfirmationRedirectUrl } from '$lib/authFlow'
  import { clearRequestCache } from '$lib/requestCache'
  import { uiState, language } from '$lib/stores/ui'
  import { authState } from '$lib/stores/auth'
  import { sanitizeName } from '$lib/validation'
  import { isValidEmail, isValidPassword, isValidUsername } from '$lib/utils/cn'
  import Button from '$lib/components/Button.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import PasswordRequirements from '$lib/components/PasswordRequirements.svelte'

  type Profile = { id:string; full_name:string; username:string|null; student_id:string|null; identity_status:string }
  type Editor = 'details'|'email'|'password'
  let profile: Profile | null = null
  let loading = true, saving = false, attempted = false, editorOpen = false, disposed = false
  let editor: Editor | null = null
  let loadError = '', error = '', fullName = '', username = '', nextEmail = '', currentPassword = '', newPassword = '', confirmPassword = '', pendingEmail = ''
  $: ar = $language === 'ar'
  $: account = $authState.account
  $: email = $authState.user?.email || ''
  $: verified = profile?.identity_status === 'verified' || account?.identity_status === 'verified'
  $: currentId = account?.student_id || profile?.student_id || ''
  $: identityStatus = verified ? (ar?'موثّق':'Verified') : account?.identity_status === 'pending' ? (ar?'قيد المراجعة':'Under review') : ['rejected','conflict'].includes(account?.identity_status || '') ? (ar?'يحتاج تصحيحاً':'Needs correction') : (ar?'مطلوب':'Required')
  $: cleanName = sanitizeName(fullName)
  $: cleanUsername = username.trim().toLowerCase()
  $: nameValid = cleanName.length >= 2 && cleanName.length <= 120
  $: usernameValid = isValidUsername(cleanUsername)
  $: emailValid = isValidEmail(nextEmail.trim())
  $: passwordValid = isValidPassword(newPassword) && newPassword.length <= 128
  $: editorTitle = editor === 'details' ? (ar?'تعديل الملف الشخصي':'Edit profile') : editor === 'email' ? (ar?'تغيير البريد الإلكتروني':'Change email') : editor === 'password' ? (ar?'تغيير كلمة المرور':'Change password') : (ar?'تعديل رقم الطالب':'Edit Student ID')

  onMount(() => { void load(); return () => { disposed = true } })

  async function load() {
    const uid = $authState.user?.id
    if (!uid) { loading = false; return }
    loading = true; loadError = ''
    const {data,error:failure} = await supabase.from('profiles').select('id,full_name,username,student_id,identity_status').eq('id',uid).single()
    if (disposed || $authState.user?.id !== uid) return
    if (failure || !data) loadError = ar?'تعذر تحميل الملف الشخصي.':'Couldn’t load your profile.'
    else profile = data
    loading = false
  }

  function edit(value: Editor) {
    if (saving || !profile) return
    editor=value; error=''; attempted=false
    fullName=profile.full_name; username=profile.username || ''; nextEmail=email
    currentPassword=''; newPassword=''; confirmPassword=''; editorOpen=true
  }
  function closeEditor() {
    editorOpen=false; editor=null; error=''; attempted=false
    currentPassword=''; newPassword=''; confirmPassword=''
  }
  async function save() {
    if (saving || !editor || !profile) return
    attempted=true; error=''
    if (editor==='details' && (!nameValid || !usernameValid)) return
    if (editor==='email' && (!emailValid || nextEmail.trim().toLowerCase()===email.toLowerCase())) return
    if (editor==='password' && (!currentPassword || !passwordValid || newPassword!==confirmPassword)) return
    const uid=profile.id, action=editor
    saving=true
    try {
      if (action==='details') {
        const {data,error:failure}=await supabase.rpc('update_my_profile',{p_full_name:cleanName,p_username:cleanUsername})
        if (failure) throw failure
        const updated=Array.isArray(data)?data[0]:data
        if (!updated || updated.id!==uid) throw new Error('invalid_profile_response')
        if (disposed || $authState.user?.id!==uid) return
        profile=updated
        authState.setUser({...$authState.user,full_name:updated.full_name,username:updated.username})
        clearRequestCache()
      } else if (action==='email') {
        const {error:failure}=await supabase.auth.updateUser({email:nextEmail.trim().toLowerCase()},{emailRedirectTo:emailConfirmationRedirectUrl()})
        if (failure) throw failure
        if (disposed || $authState.user?.id!==uid) return
        pendingEmail=nextEmail.trim().toLowerCase()
      } else {
        const result=await updatePassword(newPassword,currentPassword)
        if (result.error) throw new Error(result.error.message)
      }
      if (disposed || $authState.user?.id!==uid) return
      uiState.addToast(action==='email' ? (ar?'راجع بريدك لتأكيد التغيير.':'Check your email to confirm the change.') : (ar?'تم حفظ التغييرات.':'Changes saved.'),'success')
      editorOpen=false
    } catch (failure) {
      if (disposed || $authState.user?.id!==uid) return
      const code=String((failure as {message?:string})?.message || '')
      if (code.includes('username_taken')) error=ar?'اسم المستخدم مستعمل. اختر اسماً آخر.':'That username is taken. Choose another.'
      else if (code.includes('current_password_invalid')) error=ar?'كلمة المرور الحالية غير صحيحة.':'Current password is incorrect.'
      else error=ar?'تعذر حفظ التغيير. حاول مجدداً.':'Couldn’t save this change. Try again.'
    } finally { saving=false }
  }
</script>

<svelte:head><title>{ar?'الملف الشخصي':'Profile'} · UNEEM</title></svelte:head>
<div class="uneem-page-narrow profile-page">
  <a href="/menu" class="uneem-text-action"><Icon name={ar?'arrow-right':'arrow-left'} size={18}/>{ar?'القائمة':'Menu'}</a>
  <h1 class="uneem-title">{ar?'الملف الشخصي':'Profile'}</h1>
  {#if loading}
    <div class="space-y-4 animate-pulse" aria-busy="true">{#each [1,2,3] as _}<div class="h-36 rounded-[22px] bg-surface-level-1"></div>{/each}</div>
  {:else if loadError}
    <div class="profile-section"><p role="alert">{loadError}</p><Button variant="secondary" fullWidth on:click={load}>{ar?'حاول مجدداً':'Try again'}</Button></div>
  {:else if profile}
    <section class="profile-section" aria-label={ar?'المعلومات الشخصية':'Personal details'}>
      <div class="profile-person"><span class="profile-avatar" aria-hidden="true">{profile.full_name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()}</span><div><h2>{profile.full_name}</h2><p dir="ltr">@{profile.username}</p></div></div>
      <Button variant="secondary" fullWidth on:click={()=>edit('details')}>{ar?'تعديل الملف الشخصي':'Edit profile'}</Button>
    </section>
    <section class="profile-section" aria-labelledby="student-identity">
      <div class="profile-heading"><h2 id="student-identity">{ar?'رقم الطالب':'Student ID'}</h2><span class="identity-status" class:is-verified={verified}>{#if verified}<Icon name="lock" size={13}/>{/if}{identityStatus}</span></div>
      <p class="student-id" dir="ltr">{currentId || '—'}</p>
      {#if !verified}<ActionLink href="/verification" variant="secondary" fullWidth>{ar?'عرض التحقق':'View verification'}</ActionLink>{/if}
    </section>
    <section class="profile-section" aria-labelledby="profile-security">
      <h2 id="profile-security">{ar?'الأمان':'Security'}</h2>
      <div class="security-row"><div><p>{ar?'البريد الإلكتروني':'Email'}</p><span>{email}</span></div><button class="uneem-icon-button" on:click={()=>edit('email')} aria-label={ar?'تغيير البريد الإلكتروني':'Change email'}><Icon name="pencil" size={18}/></button></div>
      {#if pendingEmail}<p class="pending-email" role="status">{ar?'بانتظار تأكيد':'Waiting for confirmation:'} <bdi>{pendingEmail}</bdi></p>{/if}
      <div class="security-row"><div><p>{ar?'كلمة المرور':'Password'}</p></div><button class="change-password" on:click={()=>edit('password')}>{ar?'تغيير':'Change password'}</button></div>
    </section>
  {/if}
</div>

<Modal bind:open={editorOpen} title={editorTitle} closeDisabled={saving} on:close={closeEditor}>
  <form id="profile-editor" on:submit|preventDefault={save} class="grid min-w-0 grid-cols-1 gap-5" novalidate>
    {#if error}<p class="rounded-2xl bg-danger-light p-4 text-sm text-danger" role="alert">{error}</p>{/if}
    {#if editor==='details'}
      <TextField label={ar?'الاسم الكامل':'Full name'} autocomplete="name" maxlength={120} bind:value={fullName} disabled={saving} error={attempted&&!nameValid?(ar?'استخدم من حرفين إلى 120 حرفاً.':'Use 2–120 characters.') : ''}/>
      <TextField label={ar?'اسم المستخدم':'Username'} autocomplete="username" autocapitalize="none" spellcheck={false} maxlength={24} bind:value={username} disabled={saving} error={attempted&&!usernameValid?(ar?'استخدم 3–24 حرفاً إنجليزياً أو رقماً أو شرطة سفلية.':'Use 3–24 letters, numbers or underscores.') : ''}/>
    {:else if editor==='email'}
      <TextField label={ar?'البريد الإلكتروني الجديد':'New email'} type="email" autocomplete="email" inputmode="email" autocapitalize="none" bind:value={nextEmail} disabled={saving} error={attempted&&!emailValid?(ar?'أدخل بريداً صحيحاً.':'Enter a valid email.') : ''}/>
      <p class="text-sm leading-6 text-text-secondary">{ar?'سيتغير بريد تسجيل الدخول بعد التأكيد.':'Your sign-in email changes after confirmation.'}</p>
    {:else if editor==='password'}
      <TextField label={ar?'كلمة المرور الحالية':'Current password'} type="password" autocomplete="current-password" bind:value={currentPassword} disabled={saving} error={attempted&&!currentPassword?(ar?'أدخل كلمة المرور الحالية.':'Enter your current password.') : ''}/>
      <TextField label={ar?'كلمة المرور الجديدة':'New password'} type="password" autocomplete="new-password" maxlength={128} bind:value={newPassword} disabled={saving} error={attempted&&!passwordValid?(ar?'استخدم 8 أحرف على الأقل مع رقم أو رمز.':'Use 8+ characters with a number or symbol.') : ''}/>
      <PasswordRequirements password={newPassword} lengthLabel={ar?'8 أحرف على الأقل':'8 characters minimum'} numberOrSymbolLabel={ar?'رقم أو رمز':'1 number or symbol'}/>
      <TextField label={ar?'تأكيد كلمة المرور':'Confirm password'} type="password" autocomplete="new-password" maxlength={128} bind:value={confirmPassword} disabled={saving} error={attempted&&newPassword!==confirmPassword?(ar?'كلمتا المرور غير متطابقتين.':'Passwords don’t match.') : ''}/>
    {/if}
  </form>
  <svelte:fragment slot="footer"><Button variant="secondary" fullWidth disabled={saving} on:click={()=>editorOpen=false}>{ar?'إلغاء':'Cancel'}</Button><Button type="submit" form="profile-editor" fullWidth loading={saving} disabled={editor==='email'&&nextEmail.trim().toLowerCase()===email.toLowerCase()}>{editor==='email'?(ar?'إرسال رابط التأكيد':'Send confirmation'):(ar?'حفظ':'Save')}</Button></svelte:fragment>
</Modal>

<style>
  .profile-page { display:flex; flex-direction:column; gap:24px; max-width:620px; }
  .profile-section { display:flex; flex-direction:column; gap:18px; padding:20px; border-radius:var(--radius-xl); background:var(--surface); }
  .profile-section h2 { font-size:16px; font-weight:600; letter-spacing:-.02em; overflow-wrap:anywhere; }
  .profile-person { display:flex; align-items:center; gap:16px; min-width:0; padding-bottom:4px; }
  .profile-person > div { min-width:0; }
  .profile-person h2 { font-size:20px; }
  .profile-person p { margin-top:5px; color:var(--text-secondary); font-size:14px; overflow-wrap:anywhere; }
  .profile-avatar { display:grid; place-items:center; width:56px; height:56px; flex-shrink:0; border-radius:19px; background:var(--primary-light); color:var(--primary); font-size:19px; font-weight:600; }
  .profile-heading { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; }
  .identity-status { display:inline-flex; align-items:center; gap:5px; border-radius:99px; padding:5px 9px; color:var(--warning); background:var(--warning-light); font-size:12px; }
  .identity-status.is-verified { color:var(--success); background:var(--success-light); }
  .student-id { font-size:22px; font-weight:600; text-align:start; overflow-wrap:anywhere; }
  .security-row { display:flex; align-items:center; gap:12px; min-height:44px; }
  .security-row > div { min-width:0; flex:1; }
  .security-row p { font-size:14px; font-weight:550; }
  .security-row span { display:block; margin-top:6px; font-size:14px; color:var(--text-secondary); overflow-wrap:anywhere; }
  .security-row :global(button) { flex-shrink:0; }
  .change-password { min-height:44px; padding:8px; border-radius:12px; color:var(--primary); font-size:13px; font-weight:550; }
  .pending-email { padding:12px; border-radius:12px; background:var(--primary-light); color:var(--text-secondary); font-size:13px; line-height:1.5; overflow-wrap:anywhere; }
</style>

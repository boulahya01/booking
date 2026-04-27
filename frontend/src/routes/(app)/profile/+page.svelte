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
  import PhotoUpload from '$lib/components/PhotoUpload.svelte'
  import CameraCapture from '$lib/components/CameraCapture.svelte'
  import VerificationStatus from '$lib/components/VerificationStatus.svelte'
  import PhotoViewerModal from '$lib/components/PhotoViewerModal.svelte'
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
  let newPassword = ''
  let confirmPassword = ''
  let error = ''
  let message = ''
  let saving = false

  // Verification state
  let idPhotoUploading = false
  let idPhotoCapturing = false
  let idPhotoError = ''
  let showPhotoViewer = false
  let viewerTitle = ''
  let viewerUrl: string | null = null

  onMount(async () => {
    await loadProfile()
  })

  async function loadProfile() {
    if (USE_MOCK) {
      profile = mockProfile
      fullName = profile.full_name
      email = profile.email
      loading = false
      return
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        await goto('/login')
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError || !data) {
        uiState.addToast('Failed to load profile', 'error')
        loading = false
        return
      }

      profile = data
      fullName = profile?.full_name || ''
      email = user.email || ''
    } catch (e: any) {
      logger.error('[loadProfile] Error:', e)
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
    try {
      if (USE_MOCK) {
        await mockDelay()
        profile.full_name = cleanName
        mockProfile.full_name = cleanName
        message = $_('profile.success_updated')
        uiState.addToast(message, 'success')
        editing = false
        saving = false
        return
      }

      const updateData: any = { full_name: cleanName }

      const { error: err } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)

      if (err) {
        error = $_('profile.error_update_failed')
        return
      }

      message = $_('profile.success_updated')
      uiState.addToast(message, 'success')
      editing = false
      await loadProfile()
    } catch (err: any) {
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

  async function compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      img.onload = () => {
        URL.revokeObjectURL(img.src)

        // Target max dimensions and quality
        const MAX_WIDTH = 1200
        const MAX_HEIGHT = 1200
        let width = img.width
        let height = img.height

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width
          width = MAX_WIDTH
        }
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height
          height = MAX_HEIGHT
        }

        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now()
              })
              logger.debug('[compressImage] Original:', file.size, 'Compressed:', compressed.size)
              resolve(compressed)
            } else {
              reject(new Error('Failed to compress image'))
            }
          },
          'image/jpeg',
          0.8
        )
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  async function uploadPhoto(file: File, bucket: string, profileField: string) {
    if (USE_MOCK) {
      await mockDelay(500)
      const mockUrl = URL.createObjectURL(uploadFile)
      profile[profileField] = mockUrl
      uiState.addToast($_('verification.upload_success'), 'success')
      await loadProfile()
      return
    }

    logger.debug('[uploadPhoto] Starting upload, file:', file.name, 'size:', file.size)

    // Compress image before upload (reduces mobile photo size from 3-10MB to ~200KB)
    let uploadFile = file
    try {
      uploadFile = await compressImage(file)
    } catch (e) {
      logger.error('[uploadPhoto] Compression failed, using original:', e)
      // Continue with original file if compression fails
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.error('[uploadPhoto] Auth error:', authError)
      throw new Error(authError?.message || 'Authentication required')
    }
    logger.debug('[uploadPhoto] Authenticated as:', user.id)

    const timestamp = Date.now()
    const ext = uploadFile.name.split('.').pop()
    const path = `${user.id}/${bucket}_${timestamp}.${ext}`
    logger.debug('[uploadPhoto] Upload path:', path)

    // Upload to storage using Supabase client first, fallback to XHR
    logger.debug('[uploadPhoto] Calling supabase.storage.from().upload...')

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(path, uploadFile, { cacheControl: '3600', upsert: true })

    logger.debug('[uploadPhoto] Upload result:', { data: uploadData, error: uploadErr })

    if (uploadErr) {
      logger.error('[uploadPhoto] Supabase upload failed, trying XHR fallback...')
      // Get session for XHR auth
      const { data: session } = await supabase.auth.getSession()
      const accessToken = session?.session?.access_token
      if (!accessToken) {
        throw new Error('No auth session available for XHR fallback')
      }

      // Fallback to XHR
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`

      const xhr = new XMLHttpRequest()
      const uploadTimeout = 60000 // 60 seconds

      const xhrResult = await new Promise<{ error: any }>((resolve) => {
        const timeoutId = setTimeout(() => {
          xhr.abort()
          resolve({ error: { message: 'Upload timed out after 60s' } })
        }, uploadTimeout)

        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
        xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY)
        xhr.setRequestHeader('Content-Type', uploadFile.type || 'image/jpeg')
        xhr.setRequestHeader('x-upsert', 'true')

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            logger.debug('[uploadPhoto] XHR upload progress:', Math.round((e.loaded / e.total) * 100) + '%')
          }
        }

        xhr.onload = () => {
          clearTimeout(timeoutId)
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ error: null })
          } else {
            try {
              const errBody = JSON.parse(xhr.responseText)
              resolve({ error: { message: errBody.message || `XHR upload failed (${xhr.status})` } })
            } catch {
              resolve({ error: { message: `XHR upload failed (${xhr.status})` } })
            }
          }
        }

        xhr.onerror = () => {
          clearTimeout(timeoutId)
          resolve({ error: { message: 'Network error during XHR upload' } })
        }

        xhr.onabort = () => {
          clearTimeout(timeoutId)
          resolve({ error: { message: 'XHR upload timed out. Please try again.' } })
        }

        xhr.send(uploadFile)
      })

      const xhrErr = xhrResult.error
      if (xhrErr) {
        logger.error('[uploadPhoto] XHR upload also failed:', xhrErr)
        throw new Error(xhrErr.message || 'Failed to upload photo')
      }

      logger.debug('[uploadPhoto] XHR upload succeeded')
    }

    // Store the path for private bucket access
    const photoPath = path
    logger.debug('[uploadPhoto] Storing photo path:', photoPath)

    const { data: updateResult, error: updateErr } = await supabase
      .from('profiles')
      .update({ [profileField]: photoPath })
      .eq('id', user.id)
      .select()

    logger.debug('[uploadPhoto] Profile update result:', { data: updateResult, error: updateErr })

    if (updateErr) {
      logger.error('[uploadPhoto] Profile update error:', updateErr)
      throw new Error(updateErr.message || 'Failed to update profile')
    }

    // Update local profile state immediately
    profile[profileField] = photoPath

    uiState.addToast($_('verification.upload_success'), 'success')

    // Auto-submit for review if photo is now present and status was unsubmitted
    const currentStatus = profile.verification_status
    if (currentStatus === 'unsubmitted' && photoPath) {
      await supabase
        .from('profiles')
        .update({ verification_status: 'pending' })
        .eq('id', user.id)
      uiState.addToast($_('verification.auto_submitted'), 'info')
    }

    // Refresh profile from server
    await loadProfile()
  }

  async function handleIdPhotoCapture(event: CustomEvent) {
    const file = event.detail
    logger.debug('[handleIdPhotoCapture] Received file:', file?.name, file?.size)
    idPhotoCapturing = true
    idPhotoError = ''
    try {
      await uploadPhoto(file, 'id-photos', 'id_photo_url')
      logger.debug('[handleIdPhotoCapture] Upload completed successfully')
    } catch (e: any) {
      logger.error('[handleIdPhotoCapture] Upload failed:', e)
      idPhotoError = e.message || $_('verification.upload_error')
    } finally {
      logger.debug('[handleIdPhotoCapture] Resetting capturing state')
      idPhotoCapturing = false
    }
  }

  async function handleIdPhotoUpload(event: CustomEvent) {
    const file = event.detail
    logger.debug('[handleIdPhotoUpload] Received file:', file?.name, file?.size)
    idPhotoUploading = true
    idPhotoError = ''
    try {
      await uploadPhoto(file, 'id-photos', 'id_photo_url')
    } catch (e: any) {
      logger.error('[handleIdPhotoUpload] Upload failed:', e)
      idPhotoError = e.message || $_('verification.upload_error')
    } finally {
      logger.debug('[handleIdPhotoUpload] Resetting uploading state')
      idPhotoUploading = false
    }
  }

  async function getSignedUrl(photoPath: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from('id-photos')
        .createSignedUrl(photoPath, 3600) // 1 hour expiry

      if (error) {
        logger.error('[getSignedUrl] Error:', error)
        return null
      }
      return data?.signedUrl || null
    } catch (e) {
      logger.error('[getSignedUrl] Exception:', e)
      return null
    }
  }

  async function openPhotoViewer(title: string, url: string | null) {
    viewerTitle = title
    showPhotoViewer = true

    // If url looks like a storage path (contains user-id/), generate signed URL
    if (url && url.includes('/id-photos_')) {
      viewerUrl = null // Show loading first
      const signedUrl = await getSignedUrl(url)
      viewerUrl = signedUrl
      if (!signedUrl) {
        uiState.addToast('Failed to load photo: ' + url, 'error')
      }
    } else {
      viewerUrl = url
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
      <!-- Header skeleton -->
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
      <!-- Card skeletons -->
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
    <!-- Profile Header — Claude-style: clean, no harsh borders -->
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
            {profile.status}
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
              <TextField label={$_('profile.email_label')} bind:value={email} disabled={saving} />
              <TextField label={$_('profile.student_id_label')} value={profile.student_id} disabled />
              <div class="flex gap-3 pt-1">
                <Button variant="primary" size="md" {saving} className="flex-1" on:click={saveProfile}>
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

      <!-- Verification Card -->
      <Card variant="elevated" className="overflow-hidden">
        <div class="p-4">
          <div class="flex items-center gap-2 mb-4">
            <Icon name="id-card" size={16} className="text-primary" />
            <h2 class="text-base font-medium font-serif text-text">{$_('verification.title')}</h2>
          </div>

          <!-- Verification Status Badge -->
          <div class="mb-4">
            <VerificationStatus
              status={profile.verification_status || 'unsubmitted'}
              notes={profile.verification_notes}
            />
          </div>

          <!-- Photo Uploads -->
          <div class="max-w-sm mx-auto">
            {#if profile.status === 'pending' || profile.status === 'rejected'}
              <!-- Camera capture for pending/rejected users -->
              <CameraCapture
                label={$_('verification.id_photo_label')}
                photoUrl={profile.id_photo_url}
                capturing={idPhotoCapturing}
                error={idPhotoError}
                on:upload={handleIdPhotoCapture}
              />
            {:else}
              <!-- File upload for approved users -->
              <PhotoUpload
                label={$_('verification.id_photo_label')}
                photoUrl={profile.id_photo_url}
                uploading={idPhotoUploading}
                error={idPhotoError}
                on:upload={handleIdPhotoUpload}
              />
            {/if}
          </div>

          <!-- View full size button -->
          {#if profile.id_photo_url}
            <div class="mt-4 pt-4" style="border-top: 1px solid var(--border);">
              <Button variant="secondary" size="sm" className="w-full" on:click={() => openPhotoViewer($_('verification.id_photo_label'), profile.id_photo_url)}>
                <span class="flex items-center gap-1.5">
                  <Icon name="eye" size={14} />
                  {$_('verification.view_full')}
                </span>
              </Button>
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
                <Button variant="primary" size="md" {saving} className="flex-1" on:click={changePassword}>
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

      <!-- Logout — Claude-style: subtle ring shadow, no harsh borders -->
      <button
        on:click={logout}
        class="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5"
        style="color: var(--danger); background: var(--danger-light/30); box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.12);">
        <Icon name="log-out" size={18} />
        {$_('nav.logout')}
      </button>
    </div>
  {/if}

  <PhotoViewerModal
    open={showPhotoViewer}
    title={viewerTitle}
    photoUrl={viewerUrl}
    on:close={() => (showPhotoViewer = false)}
  />
</div>

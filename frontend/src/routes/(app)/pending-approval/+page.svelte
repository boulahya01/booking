<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/supabaseClient'
  import { signOut } from '$lib/auth'
  import { uiState } from '$lib/stores/ui'
  import Button from '$lib/components/Button.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { USE_MOCK, mockProfile, mockDelay } from '$lib/mock'
  import { sanitizeInput } from '$lib/validation'

  let profile: any = null
  let status = 'pending'
  let rejectionReason = ''
  let loading = true

  // Appeal state
  let showAppealModal = false
  let appealNotes = ''
  let submittingAppeal = false

  onMount(async () => {
    if (USE_MOCK) {
      profile = mockProfile
      status = profile.status
      rejectionReason = profile.rejection_reason || ''
      if (status === 'approved') {
        await goto('/home')
      }
      loading = false
      return
    }
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      await goto('/login')
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    profile = data
    status = profile?.status || 'pending'
    rejectionReason = profile?.rejection_reason || ''

    if (status === 'approved') {
      await goto('/home')
    }

    loading = false
  })

  async function logout() {
    await signOut()
    await goto('/login')
  }

  async function submitAppeal() {
    submittingAppeal = true

    try {
      if (USE_MOCK) {
        await mockDelay()
        profile.status = 'pending'
        status = 'pending'
        uiState.addToast($_('pending.appeal_success'), 'success')
        showAppealModal = false
        appealNotes = ''
        return
      }

      const updateData: any = {
        status: 'pending',
        verification_status: 'pending'
      }

      if (appealNotes) updateData.verification_notes = sanitizeInput(appealNotes)
      
      const { error: err } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)

      if (err) {
        uiState.addToast(err.message, 'error')
        return
      }

      profile.status = 'pending'
      status = 'pending'
      uiState.addToast($_('pending.appeal_success'), 'success')
      showAppealModal = false
      appealNotes = ''
    } catch (e: any) {
      uiState.addToast(e.message || $_('pending.appeal_error'), 'error')
    } finally {
      submittingAppeal = false
    }
  }
</script>

<svelte:head>
  <title>{status === 'pending' ? $_('pending.title') : $_('pending.rejection_message')} - UnemBook</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-surface-level-1/50 to-surface p-6 flex items-center justify-center">
  {#if loading}
    <!-- Loading State -->
    <div class="text-center">
      <div class="w-16 h-16 mx-auto mb-4 relative">
        <div class="absolute inset-0 rounded-full border-4 border-border dark:border-white/6"></div>
        <div class="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
      <p class="text-text-secondary animate-pulse">{$_('common.loading')}</p>
    </div>
  {:else if status === 'pending'}
    <!-- Pending State -->
    <div class="w-full max-w-lg">
      <!-- Header Card -->
      <div class="bg-surface dark:bg-surface rounded-2xl shadow-sm p-6 mb-4">
        <div class="text-center mb-6">
          <!-- Animated Clock Icon -->
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-warning-light/50 flex items-center justify-center relative">
            <div class="absolute inset-0 rounded-full bg-warning-light/30 animate-ping opacity-75"></div>
            <Icon name="clock" size={36} className="text-warning relative" />
          </div>
          <h1 class="text-2xl font-semibold font-serif text-text mb-2">{$_('pending.title')}</h1>
          <p class="text-text-secondary">{$_('pending.message')}</p>
        </div>

        <!-- Progress Steps -->
        <div class="bg-surface-level-1 dark:bg-surface-level-1/50 rounded-xl p-4 mb-4">
          <div class="flex items-center justify-between">
            <!-- Step 1: Complete -->
            <div class="flex flex-col items-center flex-1">
              <div class="w-8 h-8 rounded-full bg-success text-white flex items-center justify-center mb-2">
                <Icon name="check" size={16} />
              </div>
              <span class="text-xs text-text-secondary text-center">{$_('pending.step_register')}</span>
            </div>
            
            <!-- Connector -->
            <div class="flex-1 h-0.5 bg-border dark:bg-white/6 mx-2"></div>
            
            <!-- Step 2: In Progress -->
            <div class="flex flex-col items-center flex-1">
              <div class="w-8 h-8 rounded-full bg-warning text-white flex items-center justify-center mb-2 animate-pulse">
                <Icon name="clock" size={16} />
              </div>
              <span class="text-xs text-warning font-medium text-center">{$_('pending.step_review')}</span>
            </div>
            
            <!-- Connector -->
            <div class="flex-1 h-0.5 bg-border dark:bg-white/6 mx-2"></div>
            
            <!-- Step 3: Pending -->
            <div class="flex flex-col items-center flex-1">
              <div class="w-8 h-8 rounded-full bg-surface-level-2 dark:bg-surface-level-2 text-text-muted flex items-center justify-center mb-2">
                <Icon name="shield" size={16} />
              </div>
              <span class="text-xs text-text-muted text-center">{$_('pending.step_approve')}</span>
            </div>
          </div>
        </div>

        <!-- User Info Summary -->
        <div class="bg-surface-level-1 dark:bg-surface-level-1/50 rounded-xl p-4 space-y-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-semibold">
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-text truncate">{profile?.full_name}</p>
              <p class="text-sm text-text-muted">{profile?.student_id}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Verification CTA Card -->
      <a href="/profile" class="block bg-surface dark:bg-surface rounded-2xl shadow-sm hover:shadow-md transition-all p-5 mb-4 group">
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-xl bg-primary-light/50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-light transition-colors">
            <Icon name="camera" size={24} className="text-primary" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-text mb-1">{$_('pending.verify_banner_title')}</h3>
            <p class="text-sm text-text-secondary mb-3">{$_('pending.verify_banner_desc')}</p>
            <div class="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              {$_('pending.verify_banner_cta')}
              <Icon name="arrow-right" size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p class="text-xs text-text-muted mt-2">{$_('pending.verify_optional')}</p>
          </div>
        </div>
      </a>

      <!-- Logout Button -->
      <button
        on:click={logout}
        class="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl text-text-secondary hover:text-danger hover:bg-danger-light/50 transition-colors"
      >
        <Icon name="log-out" size={18} />
        {$_('nav.logout')}
      </button>
    </div>
  {:else if status === 'rejected'}
    <!-- Rejected State -->
    <div class="w-full max-w-lg">
      <!-- Header Card -->
      <div class="bg-surface dark:bg-surface rounded-2xl shadow-sm p-6 mb-4">
        <div class="text-center mb-6">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-danger-light/50 flex items-center justify-center">
            <Icon name="x-circle" size={36} className="text-danger" />
          </div>
          <h1 class="text-2xl font-semibold font-serif text-text mb-2">{$_('pending.rejection_message')}</h1>
          <p class="text-text-secondary">{$_('pending.rejection_subtitle')}</p>
        </div>

        <!-- Rejection Reason -->
        <div class="bg-danger-light/30 dark:bg-danger-light/20 rounded-xl p-4 mb-4">
          <div class="flex items-start gap-3">
            <Icon name="alert-triangle" size={20} className="text-danger mt-0.5 flex-shrink-0" />
            <div>
              <p class="font-medium text-text mb-1">{$_('pending.rejection_reason_label')}</p>
              <p class="text-sm text-text-secondary">{rejectionReason || $_('common.error')}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Cards -->
      <!-- Verify CTA -->
      <a href="/profile" class="block bg-surface dark:bg-surface rounded-2xl shadow-sm hover:shadow-md transition-all p-5 mb-4 group">
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-xl bg-primary-light/50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-light transition-colors">
            <Icon name="camera" size={24} className="text-primary" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-text mb-1">{$_('pending.verify_banner_title')}</h3>
            <p class="text-sm text-text-secondary mb-3">{$_('pending.verify_banner_desc')}</p>
            <div class="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              {$_('pending.verify_banner_cta')}
              <Icon name="arrow-right" size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </a>

      <!-- Appeal Button -->
      <button
        on:click={() => showAppealModal = true}
        class="w-full bg-surface dark:bg-surface rounded-2xl shadow-sm hover:shadow-md transition-all p-5 mb-4 text-left group"
      >
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-xl bg-info-light/50 flex items-center justify-center flex-shrink-0 group-hover:bg-info-light transition-colors">
            <Icon name="mail" size={24} className="text-info" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-text mb-1">{$_('pending.appeal_title')}</h3>
            <p class="text-sm text-text-secondary">{$_('pending.appeal_subtitle')}</p>
          </div>
        </div>
      </button>

      <!-- Logout Button -->
      <button
        on:click={logout}
        class="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl text-text-secondary hover:text-danger hover:bg-danger-light/50 transition-colors"
      >
        <Icon name="log-out" size={18} />
        {$_('nav.logout')}
      </button>
    </div>
  {/if}
</div>

<!-- Appeal Modal -->
<Modal open={showAppealModal} size="lg" on:close={() => showAppealModal = false}>
  <div slot="header" class="flex items-center gap-3">
    <div class="w-10 h-10 rounded-lg bg-info-light flex items-center justify-center">
      <Icon name="mail" size={20} className="text-info" />
    </div>
    <div>
      <h2 class="text-lg font-semibold text-text">{$_('pending.appeal_title')}</h2>
      <p class="text-sm text-text-secondary">{$_('pending.appeal_subtitle')}</p>
    </div>
  </div>
  <div slot="body" class="space-y-5">
    <!-- Current Information -->
    <div class="bg-surface-level-1 dark:bg-surface-level-1/50 rounded-xl p-4">
      <p class="text-sm font-medium text-text mb-3">{$_('pending.current_info')}</p>
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-sm">
          <Icon name="user" size={15} className="text-text-muted" />
          <span class="text-text-muted">{$_('profile.full_name_label')}:</span>
          <span class="font-medium text-text">{profile?.full_name || '-'}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <Icon name="mail" size={15} className="text-text-muted" />
          <span class="text-text-muted">{$_('profile.email_label')}:</span>
          <span class="font-medium text-text">{profile?.email || '-'}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <Icon name="id-card" size={15} className="text-text-muted" />
          <span class="text-text-muted">{$_('profile.student_id_label')}:</span>
          <span class="font-medium text-text">{profile?.student_id || '-'}</span>
        </div>
      </div>
    </div>

    <!-- Additional Notes -->
    <div>
      <label for="appeal-notes" class="block text-sm font-medium text-text-secondary mb-2">
        {$_('pending.additional_notes')}
      </label>
      <textarea
        id="appeal-notes"
        class="w-full rounded-xl border border-border dark:border-white/8 bg-surface-level-1 p-3 text-sm text-text placeholder:text-text-muted focus:border-info focus:outline-none focus:ring-2 focus:ring-info/20 transition-all min-h-[100px] resize-none"
        placeholder={$_('pending.additional_notes_placeholder')}
        bind:value={appealNotes}
      ></textarea>
    </div>

    <!-- Verification Reminder -->
    <div class="bg-info-light/30 dark:bg-info-light/20 rounded-xl p-4">
      <div class="flex items-start gap-3">
        <Icon name="info" size={18} className="text-info mt-0.5 flex-shrink-0" />
        <div>
          <p class="text-sm font-medium text-text mb-1">{$_('pending.verify_reminder_title')}</p>
          <p class="text-sm text-text-secondary">
            {$_('pending.verify_reminder_desc')}
            <a href="/profile" class="text-info underline font-medium">{$_('pending.verify_banner_cta')}</a>
          </p>
        </div>
      </div>
    </div>
  </div>
  <div slot="footer" class="flex gap-3">
    <Button
      variant="primary"
      className="flex-1"
      loading={submittingAppeal}
      on:click={submitAppeal}
    >
      {$_('pending.appeal_submitting')}
    </Button>
    <Button variant="secondary" className="flex-1" on:click={() => showAppealModal = false}>
      {$_('common.cancel')}
    </Button>
  </div>
</Modal>

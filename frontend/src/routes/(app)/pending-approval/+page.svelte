<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/supabaseClient'
  import { signOut } from '$lib/auth'
  import { uiState } from '$lib/stores/ui'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { _ } from 'svelte-i18n'
  import { USE_MOCK, mockProfile, mockDelay } from '$lib/mock'

  let profile: any = null
  let status = 'pending'
  let rejectionReason = ''
  let loading = true

  // Appeal state
  let showAppealModal = false
  let submittingAppeal = false
  let appealMessage = ''

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
        return
      }

      const updateData: any = {
        status: 'pending',
        verification_notes: appealMessage || null
      }

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
      appealMessage = ''
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
    <!-- Loading state -->
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
      <div class="rounded-2xl p-6 mb-4" style="background: var(--surface); border: 1px solid var(--border);">
        <div class="text-center mb-6">
          <!-- Animated Clock Icon -->
          <div class="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center relative" style="background: var(--warning-light);">
            <div class="absolute inset-0 rounded-full animate-ping opacity-75" style="background: var(--warning-light);"></div>
            <Icon name="clock" size={36} className="text-warning relative" />
          </div>
          <h1 class="text-2xl font-medium font-serif text-text mb-2">{$_('pending.title')}</h1>
          <p class="text-text-secondary">{$_('pending.message')}</p>
        </div>

        <!-- Progress Steps -->
        <div class="rounded-xl p-4 mb-4" style="background: var(--surface-level-1);">
          <div class="flex items-center justify-between">
            <!-- Step 1: Complete -->
            <div class="flex flex-col items-center flex-1">
              <div class="w-8 h-8 rounded-full bg-success text-white flex items-center justify-center mb-2">
                <Icon name="check" size={16} />
              </div>
              <span class="text-xs text-text-secondary text-center">{$_('pending.step_register')}</span>
            </div>

            <!-- Connector -->
            <div class="flex-1 h-0.5 mx-2" style="background: var(--border);"></div>

            <!-- Step 2: In Progress -->
            <div class="flex flex-col items-center flex-1">
              <div class="w-8 h-8 rounded-full bg-warning text-white flex items-center justify-center mb-2 animate-pulse">
                <Icon name="clock" size={16} />
              </div>
              <span class="text-xs text-warning font-medium text-center">{$_('pending.step_review')}</span>
            </div>

            <!-- Connector -->
            <div class="flex-1 h-0.5 mx-2" style="background: var(--border);"></div>

            <!-- Step 3: Pending -->
            <div class="flex flex-col items-center flex-1">
              <div class="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style="background: var(--surface-level-2); color: var(--text-muted);">
                <Icon name="shield" size={16} />
              </div>
              <span class="text-xs text-text-muted text-center">{$_('pending.step_approve')}</span>
            </div>
          </div>
        </div>

        <!-- User Info Summary -->
        <div class="rounded-xl p-4 space-y-3" style="background: var(--surface-level-1);">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-primary font-semibold" style="background: var(--primary-light);">
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-text truncate">{profile?.full_name}</p>
              <p class="text-sm text-text-muted">{profile?.student_id}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Info Card -->
      <div class="rounded-xl p-5" style="background: var(--surface); border: 1px solid var(--border);">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background: var(--info-light);">
            <Icon name="info" size={20} className="text-info" />
          </div>
          <div>
            <h3 class="font-semibold text-text mb-1">{$_('pending.info_title')}</h3>
            <p class="text-sm text-text-secondary">{$_('pending.info_message')}</p>
          </div>
        </div>
      </div>

      <!-- Logout Button -->
      <button
        on:click={logout}
        class="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl text-text-secondary hover:text-danger transition-colors mt-4"
        style="background: transparent;"
      >
        <Icon name="log-out" size={18} />
        {$_('nav.logout')}
      </button>
    </div>
  {:else if status === 'rejected'}
    <!-- Rejected State -->
    <div class="w-full max-w-lg">
      <!-- Header Card -->
      <div class="rounded-2xl p-6 mb-4" style="background: var(--surface); border: 1px solid var(--border);">
        <div class="text-center mb-4">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style="background: var(--danger-light);">
            <Icon name="x-circle" size={36} className="text-danger" />
          </div>
          <h1 class="text-2xl font-medium font-serif text-text mb-2">{$_('pending.rejection_message')}</h1>
          <p class="text-text-secondary">{$_('pending.rejection_subtitle')}</p>
        </div>

        <!-- Rejection Reason -->
        <div class="rounded-xl p-4" style="background: var(--danger-light);">
          <div class="flex items-start gap-3">
            <Icon name="alert-triangle" size={20} className="text-danger mt-0.5 flex-shrink-0" />
            <div class="flex-1">
              <p class="font-medium text-text mb-1">Reason</p>
              <p class="text-sm text-text-secondary">{rejectionReason || $_('common.error')}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="space-y-3 mb-4">
        <!-- Edit Info -->
        <a href="/profile" class="block rounded-xl p-5 transition-all hover:-translate-y-0.5 group" style="background: var(--surface); border: 1px solid var(--border);">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background: var(--primary-light);">
              <Icon name="pencil" size={24} className="text-primary" />
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-text">Edit Your Information</h3>
              <p class="text-sm text-text-secondary">Update your details to match the requirements</p>
            </div>
            <Icon name="arrow-right" size={20} className="text-text-muted group-hover:translate-x-0.5 transition-transform" />
          </div>
        </a>

        <!-- Submit Appeal -->
        <button
          on:click={() => showAppealModal = true}
          class="w-full block rounded-xl p-5 text-left transition-all hover:-translate-y-0.5 group"
          style="background: var(--surface); border: 1px solid var(--border);"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background: var(--info-light);">
              <Icon name="mail" size={24} className="text-info" />
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-text">Submit an Appeal</h3>
              <p class="text-sm text-text-secondary">Send a message to admin for review</p>
            </div>
            <Icon name="arrow-right" size={20} className="text-text-muted group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>
      </div>

      <!-- Logout -->
      <button
        on:click={logout}
        class="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl text-text-secondary hover:text-danger transition-colors"
        style="background: transparent;"
      >
        <Icon name="log-out" size={18} />
        {$_('nav.logout')}
      </button>
    </div>
  {/if}
</div>

<!-- Appeal Modal -->
{#if showAppealModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.5);">
    <div class="w-full max-w-md rounded-2xl p-6" style="background: var(--surface);">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: var(--info-light);">
          <Icon name="mail" size={20} className="text-info" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-text">Submit an Appeal</h2>
          <p class="text-sm text-text-secondary">This will resubmit your account for admin review</p>
        </div>
      </div>

      <textarea
        bind:value={appealMessage}
        placeholder="Explain why your account should be approved..."
        class="w-full p-3 rounded-lg border mb-4 min-h-[120px] resize-none"
        style="background: var(--surface-level-1); border-color: var(--border); color: var(--text);"
      ></textarea>

      <div class="flex gap-3">
        <Button
          variant="primary"
          className="flex-1"
          loading={submittingAppeal}
          on:click={submitAppeal}
        >
          {$_('pending.appeal_submitting')}
        </Button>
        <Button variant="secondary" className="flex-1" on:click={() => { showAppealModal = false; appealMessage = '' }}>
          {$_('common.cancel')}
        </Button>
      </div>
    </div>
  </div>
{/if}

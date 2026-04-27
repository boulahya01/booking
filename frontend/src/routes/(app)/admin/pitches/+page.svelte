<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/supabaseClient'
  import { uiState } from '$lib/stores/ui'
  import Card from '$lib/components/Card.svelte'
  import Button from '$lib/components/Button.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Toggle from '$lib/components/Toggle.svelte'
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte'
  import { _ } from 'svelte-i18n'
  import { USE_MOCK, mockPitches, mockDelay } from '$lib/mock'

  let pitches: any[] = []
  let loading = true
  let showForm = false
  let editingId: string | null = null
  let formData = { name: '', location: '', sport_type: '', capacity: 10, open_time: '08:00', close_time: '18:00', sort_order: 0, booking_frequency_enabled: false, booking_frequency_days: 7 }
  let error = ''

  onMount(async () => {
    await checkAdmin()
    await loadPitches()
  })

  async function checkAdmin() {
    if (USE_MOCK) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      await goto('/login')
      return
    }
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') {
      await goto('/home')
    }
  }

  async function loadPitches() {
    if (USE_MOCK) {
      pitches = mockPitches
      loading = false
      return
    }
    const { data, error: err } = await supabase.from('pitches').select('*').order('sort_order', { ascending: true })
    if (!err && data) pitches = data
    loading = false
  }

  function openCreateForm() {
    editingId = null
    formData = { name: '', location: '', sport_type: '', capacity: 10, open_time: '08:00', close_time: '18:00', sort_order: pitches.length, booking_frequency_enabled: false, booking_frequency_days: 7 }
    showForm = true
  }

  function openEditForm(pitch: any) {
    editingId = pitch.id
    formData = { ...pitch }
    showForm = true
  }

  async function savePitch() {
    error = ''
    if (!formData.name || !formData.location) {
      error = $_('admin.name_location_required')
      return
    }

    try {
      if (USE_MOCK) {
        await mockDelay()
        if (editingId) {
          const p = mockPitches.find(x => x.id === editingId)
          if (p) Object.assign(p, formData)
          uiState.addToast($_('admin.pitch_updated'), 'success')
        } else {
          const newPitch = { ...formData, id: 'mock-pitch-' + Date.now(), created_at: new Date().toISOString() }
          mockPitches.push(newPitch)
          uiState.addToast($_('admin.pitch_created'), 'success')
        }
        pitches = [...mockPitches]
        showForm = false
        return
      }

      if (editingId) {
        const { error: err } = await supabase.from('pitches').update(formData).eq('id', editingId)
        if (err) { error = $_('admin.pitch_update_failed'); return }
        uiState.addToast($_('admin.pitch_updated'), 'success')
      } else {
        const { error: err } = await supabase.from('pitches').insert([formData])
        if (err) { error = $_('admin.pitch_create_failed'); return }
        uiState.addToast($_('admin.pitch_created'), 'success')
      }
      showForm = false
      await loadPitches()
    } catch (e: any) {
      error = $_('common.error')
    }
  }

  async function deletePitch(id: string) {
    if (!confirm($_('admin.delete_confirm_pitch'))) return

    if (USE_MOCK) {
      await mockDelay()
      const idx = mockPitches.findIndex(x => x.id === id)
      if (idx !== -1) mockPitches.splice(idx, 1)
      pitches = [...mockPitches]
      uiState.addToast($_('admin.pitch_deleted'), 'success')
      return
    }

    const { error: err } = await supabase.from('pitches').delete().eq('id', id)
    if (!err) {
      uiState.addToast($_('admin.pitch_deleted'), 'success')
      await loadPitches()
    } else {
      uiState.addToast($_('admin.pitch_delete_failed'), 'error')
    }
  }
</script>

<div class="max-w-4xl mx-auto p-4">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-medium font-serif text-text">{$_('admin.pitches_title')}</h1>
    {#if !showForm}
      <Button variant="primary" size="sm" on:click={openCreateForm}>{$_('admin.add_pitch')}</Button>
    {/if}
  </div>

  {#if error}
    <div class="bg-danger-light border border-danger/20 text-danger p-3 rounded-lg mb-4 text-sm">{error}</div>
  {/if}

  {#if showForm}
    <Card variant="elevated" className="mb-5">
      <div class="space-y-4">
        <h2 class="text-base font-medium font-serif text-text">{editingId ? $_('admin.edit_pitch') : $_('admin.create_pitch')}</h2>
        <TextField label={$_('admin.pitch_name_label')} bind:value={formData.name} />
        <TextField label={$_('admin.location_label')} bind:value={formData.location} />
        <TextField label={$_('pitch.sport_type_label')} placeholder={$_('pitch.sport_type_placeholder')} bind:value={formData.sport_type} />
        <div class="grid grid-cols-2 gap-4">
          <TextField label={$_('admin.opening_time')} type="time" bind:value={formData.open_time} />
          <TextField label={$_('admin.closing_time')} type="time" bind:value={formData.close_time} />
        </div>
        <TextField label={$_('admin.capacity_label')} type="number" bind:value={formData.capacity} />
        <TextField label={$_('admin.sort_order')} type="number" bind:value={formData.sort_order} />

        <!-- Booking Frequency Settings -->
        <Card variant="outlined" className="p-4">
          <div class="space-y-3">
            <Toggle
              checked={formData.booking_frequency_enabled}
              onToggle={() => formData.booking_frequency_enabled = !formData.booking_frequency_enabled}
              label={$_('admin.booking_frequency_enabled_label')}
            />
            {#if formData.booking_frequency_enabled}
              <div>
                <label for="freq-days" class="block text-sm font-medium text-text-secondary mb-1">{$_('admin.booking_frequency_days')}</label>
                <input
                  id="freq-days"
                  type="number"
                  min="1"
                  class="w-full rounded-lg border border-border bg-surface-level-1 p-3 text-sm text-text focus:border-info focus:outline-none focus:ring-1 focus:ring-info transition-colors"
                  bind:value={formData.booking_frequency_days}
                />
                <p class="text-xs text-text-muted mt-1">{$_('admin.booking_frequency_helper', { days: formData.booking_frequency_days })}</p>
              </div>
            {/if}
          </div>
        </Card>

        <div class="flex gap-3">
          <Button variant="primary" className="flex-1" on:click={savePitch}>{$_('common.save')}</Button>
          <Button variant="secondary" className="flex-1" on:click={() => (showForm = false)}>{$_('common.cancel')}</Button>
        </div>
      </div>
    </Card>
  {/if}

  {#if loading}
    <div class="space-y-4">
      <LoadingSkeleton />
      <LoadingSkeleton />
    </div>
  {:else if pitches.length === 0}
    <Card variant="elevated" className="text-center py-12">
      <p class="text-text-secondary mb-4">{$_('admin.no_pitches')}</p>
      <Button variant="primary" on:click={openCreateForm}>{$_('admin.create_first_pitch')}</Button>
    </Card>
  {:else}
    <div class="space-y-3">
      {#each pitches as pitch (pitch.id)}
        <Card variant="elevated" className="p-4">
          <div class="flex justify-between items-start gap-4 flex-wrap">
            <div class="flex-1">
              <h3 class="text-base font-semibold text-text mb-1">{pitch.name}</h3>
              <p class="text-text-secondary text-sm mb-1">{pitch.location}</p>
              <p class="text-text-muted text-sm">
                {#if pitch.sport_type}
                  <span class="inline-flex items-center gap-1">
                    {pitch.sport_type}
                  </span>
                  |
                {/if}
                {pitch.open_time} - {pitch.close_time} | {$_('admin.capacity_label')}: {pitch.capacity}
              </p>
              {#if pitch.booking_frequency_enabled}
                <p class="text-xs text-text-muted mt-1">
                  {$_('admin.frequency_enabled', { days: pitch.booking_frequency_days || 7 })}
                </p>
              {:else}
                <p class="text-xs text-text-muted mt-1">{$_('admin.frequency_disabled')}</p>
              {/if}
            </div>
            <div class="flex gap-2">
              <Button variant="secondary" size="sm" on:click={() => openEditForm(pitch)}>{$_('common.edit')}</Button>
              <Button variant="danger" size="sm" on:click={() => deletePitch(pitch.id)}>{$_('common.delete')}</Button>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

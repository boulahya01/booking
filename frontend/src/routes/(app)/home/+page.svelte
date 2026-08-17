<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import PitchCard from '$lib/components/PitchCard.svelte'
  import NextBookingCard from '$lib/components/NextBookingCard.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import NotificationBanner from '$lib/components/NotificationBanner.svelte'
  import { _ } from 'svelte-i18n'
  import { USE_MOCK, mockPitches } from '$lib/mock'
  import { authState } from '$lib/stores/auth'
  import { logger } from '$lib/logger'

  let pitches: any[] = []
  let pitchesLoading = true
  let pitchesError = false

  async function fetchPitches() {
    pitchesLoading = pitches.length === 0
    pitchesError = false

    if (USE_MOCK) {
      pitches = mockPitches
      pitchesLoading = false
      return
    }

    try {
      const { data, error } = await supabase
        .from('pitches')
        .select('id,name,location,open_time,close_time,capacity,sport_type')
        .order('sort_order', { ascending: true })

      if (error) throw error
      pitches = data ?? []
    } catch (error) {
      logger.error('[Home Page] Failed to load pitches:', error)
      pitchesError = true
    } finally {
      pitchesLoading = false
    }
  }

  onMount(() => {
    void fetchPitches()
  })
</script>

<div class="min-h-screen" style="background: var(--bg);">
  <div class="max-w-5xl mx-auto px-4 py-6 space-y-6">
    <NotificationBanner />

    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
           style="background: var(--primary-light);">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div>
        <h1 class="text-2xl font-serif font-medium" style="color: var(--text);">
          {$_('home.title')}
        </h1>
        {#if $authState.user?.full_name}
          <p class="text-sm" style="color: var(--text-secondary);">
            {$_('home.welcome_back')}, {$authState.user.full_name.replace(/\b\w/g, (c: string) => c.toUpperCase())}
          </p>
        {/if}
      </div>
    </div>

    <NextBookingCard />

    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-serif font-medium" style="color: var(--text);">{$_('home.available_pitches')}</h2>
        {#if !pitchesLoading && !pitchesError}
          <span class="text-xs text-text-muted">{pitches.length} {$_('home.pitches_count')}</span>
        {/if}
      </div>

      {#if pitchesLoading}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-busy="true" aria-label={$_('common.loading')}>
          {#each Array(3) as _}
            <div class="rounded-xl p-4 animate-pulse" style="background: var(--surface); border: 1px solid var(--border);">
              <div class="flex items-start gap-3">
                <div class="w-12 h-12 rounded-lg" style="background: var(--surface-level-1);"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-5 w-3/4 rounded" style="background: var(--surface-level-1);"></div>
                  <div class="h-4 w-1/2 rounded" style="background: var(--surface-level-1);"></div>
                </div>
              </div>
              <div class="mt-4 space-y-2">
                <div class="h-4 w-full rounded" style="background: var(--surface-level-1);"></div>
                <div class="h-4 w-2/3 rounded" style="background: var(--surface-level-1);"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else if pitchesError}
        <div class="text-center py-12 rounded-xl" style="background: var(--danger-light); border: 1px solid color-mix(in srgb, var(--danger) 20%, transparent);" role="alert">
          <div class="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center" style="background: var(--surface); color: var(--danger);">
            <Icon name="alert-triangle" size={28} />
          </div>
          <p class="font-medium" style="color: var(--text);">{$_('common.error')}</p>
          <button
            type="button"
            on:click={() => void fetchPitches()}
            class="mt-4 px-4 py-2 rounded-lg text-sm font-semibold transition hover:-translate-y-0.5"
            style="background: var(--primary); color: white;"
          >
            {$_('common.retry')}
          </button>
        </div>
      {:else if pitches.length === 0}
        <div class="text-center py-12 rounded-xl" style="background: var(--surface-level-1/50); border: 1px dashed var(--border);">
          <div class="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center" style="background: var(--surface-level-2); color: var(--text-muted);">
            <Icon name="map-pin" size={28} />
          </div>
          <p class="font-medium" style="color: var(--text-secondary);">{$_('home.no_pitches_found')}</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {#each pitches as pitch (pitch.id)}
            <PitchCard {pitch} />
          {/each}
        </div>
      {/if}
    </section>
  </div>
</div>

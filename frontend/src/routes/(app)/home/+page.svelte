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
  <div class="max-w-5xl mx-auto px-4 py-5 sm:py-6 space-y-6">
    <header class="space-y-1">
      {#if $authState.user?.full_name}
        <p class="text-sm font-medium" style="color: var(--text-secondary);">
          {$_('home.welcome_back')}, {$authState.user.full_name.replace(/\b\w/g, (c: string) => c.toUpperCase())}
        </p>
      {/if}
      <h1 class="text-2xl sm:text-[1.7rem] font-serif font-medium tracking-tight" style="color: var(--text);">
        {$_('home.title')}
      </h1>
    </header>

    <NextBookingCard />

    <NotificationBanner />

    <section aria-labelledby="facilities-heading">
      <div class="flex items-end justify-between gap-4 mb-3">
        <div>
          <h2 id="facilities-heading" class="text-lg font-serif font-medium" style="color: var(--text);">
            {$_('home.available_pitches')}
          </h2>
          {#if !pitchesLoading && !pitchesError && pitches.length > 0}
            <p class="mt-0.5 text-xs text-text-muted">{pitches.length} {$_('home.pitches_count')}</p>
          {/if}
        </div>
      </div>

      {#if pitchesLoading}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-busy="true" aria-label={$_('common.loading')}>
          {#each Array(3) as _}
            <div class="rounded-xl p-4 animate-pulse" style="background: var(--surface); border: 1px solid var(--border);">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-lg" style="background: var(--surface-level-1);"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-5 w-3/4 rounded" style="background: var(--surface-level-1);"></div>
                  <div class="h-4 w-1/2 rounded" style="background: var(--surface-level-1);"></div>
                </div>
              </div>
              <div class="mt-4 h-4 w-2/3 rounded" style="background: var(--surface-level-1);"></div>
            </div>
          {/each}
        </div>
      {:else if pitchesError}
        <div class="rounded-xl px-4 py-5" style="background: var(--surface); border: 1px solid var(--border);" role="alert">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style="background: var(--danger-light); color: var(--danger);">
              <Icon name="alert-triangle" size={18} />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium" style="color: var(--text);">{$_('common.error')}</p>
              <button
                type="button"
                on:click={() => void fetchPitches()}
                class="mt-2 text-sm font-semibold hover:underline"
                style="color: var(--primary);"
              >
                {$_('common.retry')}
              </button>
            </div>
          </div>
        </div>
      {:else if pitches.length === 0}
        <div class="text-center py-10 rounded-xl" style="background: var(--surface-level-1); border: 1px dashed var(--border);">
          <div class="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center" style="background: var(--surface-level-2); color: var(--text-muted);">
            <Icon name="map-pin" size={24} />
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

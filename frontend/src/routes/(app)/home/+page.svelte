<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import PitchCard from '$lib/components/PitchCard.svelte'
  import NextBookingCard from '$lib/components/NextBookingCard.svelte'
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import NotificationBanner from '$lib/components/NotificationBanner.svelte'
  import { _ } from 'svelte-i18n'
  import { USE_MOCK, mockPitches } from '$lib/mock'
  import { authState } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'
  import { logger } from '$lib/logger'

  let pitches: any[] = []
  let pitchesLoading = true

  onMount(async () => {
    if (USE_MOCK) {
      pitches = mockPitches
      pitchesLoading = false
      return
    }
    try {
      const { data, error } = await supabase.from('pitches').select('id,name,location,open_time,close_time,capacity,sport_type').order('sort_order', { ascending: true })
      logger.debug('[Home Page] Pitches query result:', { data, error })
      if (error) {
        logger.error('[Home Page] Supabase error:', error)
      }
      if (!error && data) {
        pitches = data
      }
    } catch (e) {
      logger.error('[Home Page] Exception fetching pitches:', e)
    }
    pitchesLoading = false
  })
</script>

<div class="min-h-screen" style="background: var(--bg);">
  <div class="max-w-5xl mx-auto px-4 py-6 space-y-6">
    <!-- Notifications -->
    <NotificationBanner />

    <!-- Welcome Header — Claude-style: clean, serif heading -->
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
            {$_('home.welcome_back')}, {$authState.user.full_name}
          </p>
        {/if}
      </div>
    </div>

    <!-- Next Booking -->
    <NextBookingCard />

    <!-- Pitches Grid -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-serif font-medium" style="color: var(--text);">{$_('home.available_pitches')}</h2>
        {#if !pitchesLoading}
          <span class="text-xs font-medium uppercase tracking-wider" style="color: var(--text-muted);">{pitches.length} {$_('home.pitches_count')}</span>
        {/if}
      </div>

      {#if pitchesLoading}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {#each Array(3) as _, i}
            <div class="rounded-xl p-4 animate-pulse" style="background: var(--surface); border: 1px solid var(--border);">
              <div class="flex items-start gap-3">
                <div class="w-12 h-12 rounded-lg" style="background: var(--surface-level-1);"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-5 w-3/4 rounded animate-pulse" style="background: var(--surface-level-1);"></div>
                  <div class="h-4 w-1/2 rounded animate-pulse" style="background: var(--surface-level-1);"></div>
                </div>
              </div>
              <div class="mt-4 space-y-2">
                <div class="h-4 w-full rounded animate-pulse" style="background: var(--surface-level-1);"></div>
                <div class="h-4 w-2/3 rounded animate-pulse" style="background: var(--surface-level-1);"></div>
              </div>
            </div>
          {/each}
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

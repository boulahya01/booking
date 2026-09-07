<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import PitchCard from '$lib/components/PitchCard.svelte'
  import NextBookingCard from '$lib/components/NextBookingCard.svelte'
  import SegmentedControl from '$lib/components/SegmentedControl.svelte'
  import { _, locale } from 'svelte-i18n'
  import { USE_MOCK, mockPitches } from '$lib/mock'
  import { authState } from '$lib/stores/auth'
  import { logger } from '$lib/logger'

  let pitches: any[] = []
  let pitchesLoading = true
  let pitchesError = false
  let selectedSport = 'all'

  $: sports = Array.from(new Set(pitches.map((pitch) => String(pitch.sport_type || '').trim().toLowerCase()).filter(Boolean))).sort()
  $: filteredPitches = selectedSport === 'all' ? pitches : pitches.filter((pitch) => String(pitch.sport_type || '').trim().toLowerCase() === selectedSport)
  $: firstName = $authState.user?.full_name?.trim().split(/\s+/)[0] || ''
  $: isArabic = ($locale || 'en').startsWith('ar')
  $: sportOptions = [
    { value: 'all', label: isArabic ? 'الكل' : 'All' },
    ...sports.map((sport) => ({ value: sport, label: sportLabel(sport) }))
  ]

  function sportLabel(value: string) {
    if (!isArabic) return value.charAt(0).toUpperCase() + value.slice(1)
    if (value === 'football') return 'كرة القدم'
    if (value === 'basketball') return 'كرة السلة'
    if (value === 'volleyball') return 'الكرة الطائرة'
    if (value === 'tennis') return 'التنس'
    return value
  }

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
        .eq('is_active', true)
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

  onMount(() => void fetchPitches())
</script>

<svelte:head><title>UNEEM</title></svelte:head>

<main class="uneem-page-narrow">
  <header class="mb-6">
    {#if firstName}<p class="text-sm font-semibold text-text-secondary">{isArabic ? `مرحبا ${firstName}` : `Hi ${firstName}`}</p>{/if}
    <h1 class="uneem-title">{isArabic ? 'العب اليوم' : 'Play today'}</h1>
  </header>

  <NextBookingCard />

  <section aria-labelledby="facilities-heading" class="mt-7">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 id="facilities-heading" class="text-lg font-bold tracking-[-0.02em] text-text">{isArabic ? 'المرافق' : 'Facilities'}</h2>
    </div>

    {#if sports.length > 1}
      <div class="-mx-4 mb-4 px-4 sm:mx-0 sm:px-0">
        <SegmentedControl
          options={sportOptions}
          value={selectedSport}
          ariaLabel={isArabic ? 'تصفية حسب الرياضة' : 'Filter by sport'}
          scrollable
          onChange={(value) => (selectedSport = value)}
        />
      </div>
    {/if}

    {#if pitchesLoading}
      <div class="space-y-2" aria-busy="true" aria-label={$_('common.loading')}>
        {#each Array(3) as _}<div class="h-20 animate-pulse rounded-[18px] bg-surface-level-1"></div>{/each}
      </div>
    {:else if pitchesError}
      <div class="flex items-center justify-between gap-3 py-4" role="alert">
        <p class="text-sm font-semibold text-danger">{isArabic ? 'تعذر تحميل المرافق' : 'Couldn’t load facilities'}</p>
        <button type="button" on:click={() => void fetchPitches()} class="min-h-10 text-sm font-bold text-primary">{$_('common.retry')}</button>
      </div>
    {:else if pitches.length === 0}
      <div class="uneem-empty"><p class="font-semibold text-text-muted">{isArabic ? 'ما كاين حتى مرفق دابا' : 'No facilities yet'}</p></div>
    {:else if filteredPitches.length === 0}
      <div class="uneem-empty">
        <p class="font-semibold text-text-muted">{isArabic ? 'ما كاين حتى مرفق بهاد الرياضة' : 'No facility for this sport'}</p>
        <button type="button" on:click={() => (selectedSport = 'all')} class="mt-2 min-h-10 text-sm font-bold text-primary">{isArabic ? 'شوف الكل' : 'Show all'}</button>
      </div>
    {:else}
      <div class="space-y-2">
        {#each filteredPitches as pitch (pitch.id)}<PitchCard {pitch} />{/each}
      </div>
    {/if}
  </section>
</main>

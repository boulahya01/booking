<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import PitchCard from '$lib/components/PitchCard.svelte'
  import NextBookingCard from '$lib/components/NextBookingCard.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import NotificationBanner from '$lib/components/NotificationBanner.svelte'
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

  function sportLabel(value: string) {
    if (!isArabic) return value
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

<main class="uneem-page">
  <header class="uneem-page-header">
    <div class="min-w-0">
      <p class="text-sm font-semibold text-text-secondary">
        {#if firstName}{isArabic ? `مرحبا ${firstName}` : `Hi ${firstName}`}{:else}UNEEM{/if}
      </p>
      <h1 class="uneem-title">{isArabic ? 'العب اليوم' : 'Play today'}</h1>
      <p class="uneem-subtitle">{isArabic ? 'احجز مرفق أو انضم لمباراة.' : 'Book a facility or join a match.'}</p>
    </div>
  </header>

  <div class="mb-5 grid grid-cols-2 gap-2.5 sm:max-w-md">
    <a href="/matches" class="flex min-h-[54px] items-center gap-3 rounded-[18px] bg-primary px-4 font-bold text-white dark:text-[#101214]">
      <Icon name="users" size={19} />
      <span class="text-sm">{isArabic ? 'المباريات' : 'Open matches'}</span>
    </a>
    <a href="/bookings" class="flex min-h-[54px] items-center gap-3 rounded-[18px] border border-border-light bg-surface px-4 font-bold text-text">
      <Icon name="calendar-days" size={19} className="text-primary" />
      <span class="text-sm">{isArabic ? 'رياضتي' : 'My Sports'}</span>
    </a>
  </div>

  <div class="space-y-3">
    <NextBookingCard />
    <NotificationBanner />
  </div>

  <section aria-labelledby="facilities-heading" class="mt-8">
    <div class="mb-4 flex items-end justify-between gap-4">
      <div>
        <p class="uneem-kicker">{isArabic ? 'المرافق' : 'Facilities'}</p>
        <h2 id="facilities-heading" class="mt-1 text-xl font-bold tracking-[-0.025em] text-text">{isArabic ? 'اختار فين تلعب' : 'Choose where to play'}</h2>
      </div>
      {#if !pitchesLoading && !pitchesError && pitches.length > 0}<span class="text-xs font-semibold text-text-muted">{filteredPitches.length}/{pitches.length}</span>{/if}
    </div>

    {#if sports.length > 1}
      <div class="-mx-4 mb-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label={isArabic ? 'تصفية حسب الرياضة' : 'Filter by sport'}>
        <div class="flex min-w-max gap-2">
          <button type="button" on:click={() => (selectedSport = 'all')} class="uneem-chip" class:is-active={selectedSport === 'all'} aria-pressed={selectedSport === 'all'}>{isArabic ? 'الكل' : 'All'}</button>
          {#each sports as sport}
            <button type="button" on:click={() => (selectedSport = sport)} class="uneem-chip capitalize" class:is-active={selectedSport === sport} aria-pressed={selectedSport === sport}>{sportLabel(sport)}</button>
          {/each}
        </div>
      </div>
    {/if}

    {#if pitchesLoading}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label={$_('common.loading')}>
        {#each Array(3) as _}<div class="h-40 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}
      </div>
    {:else if pitchesError}
      <div class="uneem-card flex items-center gap-3" role="alert">
        <div class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger-light text-danger"><Icon name="alert-triangle" size={19} /></div>
        <div class="min-w-0 flex-1"><p class="font-bold text-text">{isArabic ? 'تعذر تحميل المرافق' : 'Couldn’t load facilities'}</p></div>
        <button type="button" on:click={() => void fetchPitches()} class="min-h-10 text-sm font-bold text-primary">{$_('common.retry')}</button>
      </div>
    {:else if pitches.length === 0}
      <div class="uneem-empty">
        <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-text-muted"><Icon name="map-pin" size={22} /></div>
        <p class="mt-3 font-bold text-text">{isArabic ? 'ما كاين حتى مرفق دابا' : 'No facilities yet'}</p>
      </div>
    {:else if filteredPitches.length === 0}
      <div class="uneem-empty">
        <p class="font-bold text-text">{isArabic ? 'ما كاين حتى مرفق بهاد الرياضة' : 'No facility for this sport'}</p>
        <button type="button" on:click={() => (selectedSport = 'all')} class="mt-2 min-h-10 text-sm font-bold text-primary">{isArabic ? 'شوف الكل' : 'Show all'}</button>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each filteredPitches as pitch (pitch.id)}<PitchCard {pitch} />{/each}
      </div>
    {/if}
  </section>
</main>

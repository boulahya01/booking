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

  $: sports = Array.from(
    new Set(
      pitches
        .map((pitch) => String(pitch.sport_type || '').trim().toLowerCase())
        .filter(Boolean)
    )
  ).sort()

  $: filteredPitches = selectedSport === 'all'
    ? pitches
    : pitches.filter((pitch) => String(pitch.sport_type || '').trim().toLowerCase() === selectedSport)

  $: firstName = $authState.user?.full_name?.trim().split(/\s+/)[0] || ''
  $: isArabic = ($locale || 'en').startsWith('ar')

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

<svelte:head>
  <title>UNEEM</title>
</svelte:head>

<div class="min-h-screen pb-6" style="background: var(--bg);">
  <div class="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-7">
    <header class="mb-6 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-sm font-medium" style="color: var(--text-secondary);">
          {#if firstName}
            {isArabic ? `مرحبا ${firstName}` : `Welcome back, ${firstName}`}
          {:else}
            {isArabic ? 'مرحبا بك في UNEEM' : 'Welcome to UNEEM'}
          {/if}
        </p>
        <h1 class="mt-1 text-[1.7rem] font-semibold tracking-[-0.025em] sm:text-3xl" style="color: var(--text);">
          {isArabic ? 'العب اليوم' : 'Play today'}
        </h1>
        <p class="mt-1 max-w-lg text-sm leading-6" style="color: var(--text-muted);">
          {isArabic
            ? 'شوف حجزك الجاي أو اختار الملعب والوقت المناسب بسرعة.'
            : 'See what is next, then find the right facility and time without extra steps.'}
        </p>
      </div>

      <a
        href="/notifications"
        class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        style="background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border);"
        aria-label={isArabic ? 'الإشعارات' : 'Notifications'}
      >
        <Icon name="bell" size={19} />
      </a>
    </header>

    <div class="space-y-4">
      <NextBookingCard />
      <NotificationBanner />
    </div>

    <section aria-labelledby="facilities-heading" class="mt-8">
      <div class="mb-4 flex items-end justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.14em]" style="color: var(--primary);">
            {isArabic ? 'المرافق الرياضية' : 'Sports facilities'}
          </p>
          <h2 id="facilities-heading" class="mt-1 text-xl font-semibold tracking-[-0.02em]" style="color: var(--text);">
            {isArabic ? 'اختار فين تلعب' : 'Choose where to play'}
          </h2>
        </div>
        {#if !pitchesLoading && !pitchesError && pitches.length > 0}
          <span class="text-xs font-medium" style="color: var(--text-muted);">
            {filteredPitches.length}/{pitches.length}
          </span>
        {/if}
      </div>

      {#if sports.length > 1}
        <div class="-mx-4 mb-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label={isArabic ? 'تصفية حسب الرياضة' : 'Filter by sport'}>
          <div class="flex min-w-max gap-2">
            <button
              type="button"
              on:click={() => (selectedSport = 'all')}
              class="min-h-[42px] rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              style={selectedSport === 'all'
                ? 'background: var(--primary); color: white;'
                : 'background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border);'}
              aria-pressed={selectedSport === 'all'}
            >
              {isArabic ? 'الكل' : 'All'}
            </button>
            {#each sports as sport}
              <button
                type="button"
                on:click={() => (selectedSport = sport)}
                class="min-h-[42px] rounded-full px-4 text-sm font-semibold capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                style={selectedSport === sport
                  ? 'background: var(--primary); color: white;'
                  : 'background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border);'}
                aria-pressed={selectedSport === sport}
              >
                {sport}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if pitchesLoading}
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label={$_('common.loading')}>
          {#each Array(3) as _}
            <div class="overflow-hidden rounded-2xl animate-pulse" style="background: var(--surface); border: 1px solid var(--border);">
              <div class="h-24" style="background: var(--surface-level-1);"></div>
              <div class="space-y-3 p-4">
                <div class="h-5 w-2/3 rounded" style="background: var(--surface-level-1);"></div>
                <div class="h-4 w-1/2 rounded" style="background: var(--surface-level-1);"></div>
                <div class="h-10 rounded-xl" style="background: var(--surface-level-1);"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else if pitchesError}
        <div class="rounded-2xl p-5" style="background: var(--surface); border: 1px solid var(--border);" role="alert">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style="background: var(--danger-light); color: var(--danger);">
              <Icon name="alert-triangle" size={18} />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold" style="color: var(--text);">
                {isArabic ? 'ما قدرناش نحملو المرافق' : 'Facilities are unavailable right now'}
              </p>
              <p class="mt-1 text-sm" style="color: var(--text-muted);">
                {isArabic ? 'عاود المحاولة وبلا ما تضيع الصفحة.' : 'Retry without losing your place.'}
              </p>
              <button
                type="button"
                on:click={() => void fetchPitches()}
                class="mt-3 min-h-[42px] rounded-xl px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                style="background: var(--primary-light); color: var(--primary);"
              >
                {$_('common.retry')}
              </button>
            </div>
          </div>
        </div>
      {:else if pitches.length === 0}
        <div class="rounded-2xl px-5 py-10 text-center" style="background: var(--surface); border: 1px solid var(--border);">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style="background: var(--surface-level-1); color: var(--text-muted);">
            <Icon name="map-pin" size={22} />
          </div>
          <p class="font-semibold" style="color: var(--text);">{$_('home.no_pitches_found')}</p>
          <p class="mx-auto mt-1 max-w-sm text-sm" style="color: var(--text-muted);">
            {isArabic ? 'ملي يفتح شي مرفق غادي يبان هنا مباشرة.' : 'When a facility becomes available, it will appear here.'}
          </p>
        </div>
      {:else if filteredPitches.length === 0}
        <div class="rounded-2xl px-5 py-8 text-center" style="background: var(--surface-level-1);">
          <p class="font-semibold" style="color: var(--text);">
            {isArabic ? 'ما كاين حتى مرفق بهاد الرياضة دابا' : 'No facility for this sport right now'}
          </p>
          <button type="button" on:click={() => (selectedSport = 'all')} class="mt-2 text-sm font-semibold" style="color: var(--primary);">
            {isArabic ? 'شوف الكل' : 'Show all'}
          </button>
        </div>
      {:else}
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {#each filteredPitches as pitch (pitch.id)}
            <PitchCard {pitch} />
          {/each}
        </div>
      {/if}
    </section>
  </div>
</div>

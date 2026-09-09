<script lang="ts">
  import { onMount } from 'svelte'
  import PitchCard from '$lib/components/PitchCard.svelte'
  import NextBookingCard from '$lib/components/NextBookingCard.svelte'
  import SegmentedControl from '$lib/components/SegmentedControl.svelte'
  import Button from '$lib/components/Button.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { _, locale } from 'svelte-i18n'
  import { USE_MOCK, mockPitches } from '$lib/mock'
  import { authState } from '$lib/stores/auth'
  import { logger } from '$lib/logger'
  import { listActiveFacilities, type FacilitySummary } from '$lib/facilityApi'

  let pitches: FacilitySummary[] = []
  let pitchesLoading = true
  let pitchesError = false
  let refreshing = false
  let selectedSport = 'all'
  let disposed = false
  $: sports = Array.from(new Set(pitches.map((pitch) => String(pitch.sport_type || '').trim().toLowerCase()).filter(Boolean))).sort()
  $: filteredPitches = selectedSport === 'all' ? pitches : pitches.filter((pitch) => String(pitch.sport_type || '').trim().toLowerCase() === selectedSport)
  $: firstName = $authState.user?.full_name?.trim().split(/\s+/)[0] || ''
  $: isArabic = ($locale || 'en').startsWith('ar')
  $: sportOptions = [{ value: 'all', label: isArabic ? 'الكل' : 'All' }, ...sports.map((sport) => ({ value: sport, label: sportLabel(sport, isArabic) }))]

  function sportLabel(value: string, ar: boolean) {
    if (!ar) return value.charAt(0).toUpperCase() + value.slice(1)
    return ({ football: 'كرة القدم', basketball: 'كرة السلة', volleyball: 'الكرة الطائرة', tennis: 'التنس' } as Record<string, string>)[value] || value
  }

  async function fetchPitches(force = false) {
    if (refreshing) return
    refreshing = true
    pitchesLoading = pitches.length === 0
    pitchesError = false
    try {
      const next = USE_MOCK ? mockPitches as FacilitySummary[] : await listActiveFacilities(force)
      if (!disposed) pitches = next
    } catch (error) {
      logger.error('[Home Page] Failed to load pitches:', error)
      if (!disposed) pitchesError = true
    } finally {
      if (!disposed) { pitchesLoading = false; refreshing = false }
    }
  }

  onMount(() => { void fetchPitches(); return () => { disposed = true } })
</script>

<svelte:head><title>{isArabic ? 'الرئيسية' : 'Home'} · UNEEM</title></svelte:head>

<main class="uneem-page home-page">
  <header class="home-header">
    <div class="min-w-0">
      {#if firstName}<p class="home-greeting">{isArabic ? `مرحباً ${firstName}` : `Hi ${firstName}`}</p>{/if}
      <h1 class="uneem-title">{isArabic ? 'العب اليوم' : 'Play today'}</h1>
    </div>
    <ActionLink href="/matches" variant="secondary" icon="users" className="home-matches-link">{isArabic ? 'المباريات المفتوحة' : 'Open matches'}</ActionLink>
  </header>

  <NextBookingCard />

  <section aria-labelledby="facilities-heading">
    <div class="facilities-heading">
      <h2 id="facilities-heading">{isArabic ? 'المرافق' : 'Facilities'}</h2>
      <button type="button" class="uneem-icon-button" disabled={refreshing} aria-busy={refreshing} aria-label={isArabic ? 'تحديث المرافق' : 'Refresh facilities'} on:click={() => void fetchPitches(true)}>
        <Icon name="refresh-cw" size={18} className={refreshing ? 'animate-spin' : ''} />
      </button>
    </div>
    {#if sports.length > 1}
      <div class="sport-filter">
        <SegmentedControl options={sportOptions} value={selectedSport} ariaLabel={isArabic ? 'تصفية حسب الرياضة' : 'Filter by sport'} scrollable onChange={(value) => (selectedSport = value)} />
      </div>
    {/if}
    {#if pitchesError}
      <div class="facilities-error" role="alert">
        <p>{isArabic ? 'تعذر تحميل المرافق' : 'Couldn’t load facilities'}</p>
        <Button variant="secondary" size="sm" on:click={() => void fetchPitches(true)}>{$_('common.retry')}</Button>
      </div>
    {/if}
    {#if pitchesLoading}
      <div class="facilities-grid" aria-busy="true" aria-label={$_('common.loading')}>
        {#each [1, 2, 3, 4] as _}
          <div class="facility-skeleton" aria-hidden="true">
            <div class="h-[52px] w-[52px] animate-pulse rounded-[16px] bg-surface-level-1"></div>
            <div class="h-5 w-3/4 animate-pulse rounded bg-surface-level-1"></div>
            <div class="h-4 w-1/2 animate-pulse rounded bg-surface-level-1"></div>
            <div class="mt-1 h-4 w-24 animate-pulse rounded bg-surface-level-1"></div>
          </div>
        {/each}
      </div>
    {:else if pitches.length === 0 && !pitchesError}
      <div class="facilities-empty"><Icon name="map-pin" size={28} /><p>{isArabic ? 'لا توجد مرافق حالياً' : 'No facilities yet'}</p></div>
    {:else if pitches.length > 0 && filteredPitches.length === 0}
      <div class="facilities-empty">
        <Icon name="search" size={28} /><p>{isArabic ? 'لا توجد مرافق لهذه الرياضة' : 'No facility for this sport'}</p>
        <Button variant="secondary" on:click={() => (selectedSport = 'all')}>{isArabic ? 'عرض الكل' : 'Show all'}</Button>
      </div>
    {:else if filteredPitches.length > 0}
      <div class="facilities-grid" aria-busy={refreshing}>
        {#each filteredPitches as pitch (pitch.id)}<PitchCard {pitch} />{/each}
      </div>
    {/if}
  </section>
</main>

<style>
  .home-page { max-width: 64rem; }
  .home-header { display: flex; flex-direction: column; gap: 20px; margin-bottom: 28px; }
  .home-greeting { margin-bottom: 6px; color: var(--text-secondary); font-size: 14px; font-weight: 550; }
  .home-header :global(.home-matches-link) { width: 100%; }
  .facilities-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
  .facilities-heading h2 { font-size: 22px; font-weight: 650; letter-spacing: -.025em; }
  .sport-filter { margin-bottom: 20px; }
  .facilities-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .facility-skeleton { display: flex; min-height: 221px; flex-direction: column; gap: 16px; padding: 20px; border-radius: var(--radius-xl); background: var(--surface); }
  .facilities-error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; padding: 16px; border-radius: var(--radius-lg); background: var(--danger-light); }
  .facilities-error p { flex: 1 1 180px; color: var(--danger); font-size: 14px; }
  .facilities-empty { display: flex; align-items: center; flex-direction: column; gap: 16px; padding: 48px 16px; color: var(--text-secondary); text-align: center; }
  .facilities-empty p { color: var(--text); font-size: 16px; font-weight: 550; }
  @media (min-width: 640px) { .home-header { flex-direction: row; align-items: center; justify-content: space-between; } .home-header :global(.home-matches-link) { width: auto; } .facilities-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; } }
</style>

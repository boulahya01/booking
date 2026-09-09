<script lang="ts">
  import { _, locale } from 'svelte-i18n'
  import type { FacilitySummary } from '$lib/facilityApi'
  import Icon from './Icon.svelte'

  export let pitch: FacilitySummary

  $: closeTime = pitch.close_time ? pitch.close_time.slice(0, 5) : ''
  $: displayCloseTime = closeTime === '00:00' && pitch.open_time?.slice(0, 5) !== '00:00' ? '24:00' : closeTime
  $: isArabic = ($locale || 'en').startsWith('ar')
  $: sport = pitch.sport_type?.trim().toLowerCase() || ''
  $: sportName = ({ football: isArabic ? 'كرة القدم' : 'Football', basketball: isArabic ? 'كرة السلة' : 'Basketball', volleyball: isArabic ? 'الكرة الطائرة' : 'Volleyball', tennis: isArabic ? 'التنس' : 'Tennis' } as Record<string, string>)[sport] || pitch.sport_type
</script>

<a href={`/pitch/${pitch.id}`} class="facility-card">
  <div class="facility-card-top">
    <div class="facility-symbol" aria-hidden="true">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="3" width="22" height="26" rx="3" />
        <path d="M5 16h22" />
        {#if sport === 'tennis' || sport === 'volleyball'}
          <path d="M9 3v26M23 3v26M9 10h14M9 22h14M16 10v12" />
        {:else if sport === 'basketball'}
          <circle cx="16" cy="16" r="3" />
          <path d="M10 3v4a6 6 0 0 0 12 0V3M10 29v-4a6 6 0 0 1 12 0v4M14 4h4M14 28h4" />
        {:else}
          <circle cx="16" cy="16" r="3" />
          <path d="M11 3v5h10V3M11 29v-5h10v5" />
        {/if}
      </svg>
    </div>
    {#if sportName}<span class="facility-sport">{sportName}</span>{/if}
  </div>
  <div class="facility-copy">
    <h3>{pitch.name}</h3>
    <p class="facility-location"><Icon name="map-pin" size={16} /><span>{pitch.location || $_('bookings.unknown_location')}</span></p>
  </div>
  <div class="facility-bottom">
    {#if pitch.open_time && pitch.close_time}
      <p class="facility-hours"><Icon name="clock" size={15} /><span dir="ltr">{pitch.open_time.slice(0, 5)}–{displayCloseTime}</span></p>
    {/if}
    <span class="facility-view">{isArabic ? 'الأوقات' : 'View times'}<Icon name={isArabic ? 'chevron-left' : 'chevron-right'} size={16} /></span>
  </div>
</a>

<style>
  .facility-card { display: flex; min-width: 0; height: 100%; flex-direction: column; gap: 16px; padding: 20px; border-radius: var(--radius-xl); background: var(--surface); transition: background var(--motion-fast), transform var(--motion-fast); }
  .facility-card:hover { background: var(--surface-raised); }
  .facility-card:active { transform: scale(.985); }
  .facility-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .facility-symbol { display: grid; width: 52px; height: 52px; flex-shrink: 0; place-items: center; border-radius: 16px; background: var(--primary-light); color: var(--primary); }
  .facility-sport { color: var(--text-secondary); font-size: 13px; font-weight: 550; overflow-wrap: anywhere; }
  .facility-copy { flex: 1; min-width: 0; }
  h3 { font-size: 19px; font-weight: 650; letter-spacing: -.025em; line-height: 1.3; overflow-wrap: anywhere; }
  .facility-location { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; color: var(--text-secondary); font-size: 13px; line-height: 1.5; }
  .facility-location :global(svg) { margin-top: 2px; }
  .facility-bottom { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; padding-top: 4px; }
  .facility-hours, .facility-view { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; line-height: 20px; }
  .facility-hours { color: var(--text-secondary); }
  .facility-view { margin-inline-start: auto; color: var(--primary); font-weight: 650; }
  @media (prefers-reduced-motion: reduce) { .facility-card { transition: none; } }
</style>

<script lang="ts">
  import { language } from '$lib/stores/ui'
  import type { SharedMatch } from '$lib/communityApi'
  import Icon from './Icon.svelte'
  export let match: SharedMatch | null
  $: ar = $language === 'ar'
  $: date = match ? new Intl.DateTimeFormat(ar ? 'ar' : 'en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: match.timezone }).format(new Date(match.starts_at)) : ''
</script>
{#if match}
  <a class="shared-match" href={'/bookings/' + match.booking_id}>
    <span class="match-symbol"><Icon name="users" size={21}/></span>
    <span class="match-copy"><strong>{match.pitch_name}</strong><span>{date}</span><span>{match.spots_left > 0 ? `${match.spots_left} ${ar ? 'مكان متاح' : 'spots left'}` : (ar ? 'مكتملة' : 'Full')}</span></span>
    <span class="match-action">{ar ? 'عرض المباراة' : 'View match'}<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={16}/></span>
  </a>
{:else}
  <p class="closed-match">{ar ? 'لم تعد المباراة المشتركة مفتوحة.' : 'The shared match is no longer open.'}</p>
{/if}
<style>
  .shared-match { display:flex; align-items:center; gap:12px; padding:16px; border:1px solid var(--border-light); background:var(--surface); border-radius:14px; }
  .match-symbol { display:grid; place-items:center; width:40px; height:40px; flex-shrink:0; border-radius:12px; color:var(--primary); background:var(--primary-light); }
  .match-copy { display:grid; gap:5px; flex:1; min-width:0; }
  strong { font-weight:500; font-size:15px; overflow-wrap:anywhere; }
  .match-copy > span { font-size:12px; color:var(--text-secondary); }
  .match-action { display:flex; align-items:center; gap:4px; color:var(--primary); font-size:12px; }
  .closed-match { font-size:13px; color:var(--text-secondary); padding:12px; border:1px solid var(--border-light); border-radius:12px; }
  @media(max-width:400px) { .shared-match { display:grid; grid-template-columns:36px minmax(0,1fr); padding:12px; gap:10px; } .match-symbol { width:36px; height:36px; } .match-action { grid-column:1 / -1; justify-self:end; min-height:32px; } }
</style>

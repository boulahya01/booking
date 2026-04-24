<script lang="ts">
  import NeonCard from '$lib/components/NeonCard.svelte'
  export let pitch: any
</script>

<NeonCard>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
    <div>
      <div style="font-weight:700">{pitch.name}</div>
      <div style="color:var(--muted);font-size:.9rem;margin-top:6px">{pitch.open_time} — {pitch.close_time}</div>
    </div>
    <div>
      <a class="neon-button" href={`/pitch/${pitch.id}`} aria-label={`Open ${pitch.name}`} >View</a>
    </div>
  </div>
</NeonCard>

<style>
  /* small per-card tweaks if needed */
</style>

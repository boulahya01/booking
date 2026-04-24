<script lang="ts">
  export let slot: any;
  export let onBook: (s: any) => void;
</script>

<div class="slot-card neon-card" role="group" aria-label="Slot">
  <div class="slot-main">
    <div class="slot-info">
      <div class="slot-time">{new Date(slot.datetime_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="slot-sub">{new Date(slot.datetime_start).toLocaleDateString()}</div>
    </div>

    <div class="slot-meta">
      {#if slot.is_available}
        <button class="neon-button small" on:click={() => onBook(slot)} aria-label="Book slot">Book</button>
      {:else}
        <button class="neon-button small" disabled aria-label="Slot booked">Booked</button>
        {#if slot.booker_name}
          <div class="slot-booker">{slot.booker_name}</div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .slot-card { padding: 0.6rem; display: block; }
  .slot-main { display:flex; justify-content:space-between; align-items:center; gap:0.6rem }
  .slot-info { display:flex; flex-direction:column }
  .slot-time { font-weight: 700; font-size: 1rem; }
  .slot-sub { color: var(--muted); font-size: 0.85rem }
  .slot-meta { display:flex; flex-direction:column; align-items:flex-end }
  .slot-booker { margin-top:0.25rem; color:var(--muted); font-size:0.8rem }
  .neon-button.small { padding: 0.4rem 0.6rem; font-size:0.85rem }
</style>

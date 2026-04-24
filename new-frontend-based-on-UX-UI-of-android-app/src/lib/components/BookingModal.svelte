<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import NeonButton from '$lib/components/NeonButton.svelte';

  export let slot: any;
  export let onClose: () => void;

  const dispatch = createEventDispatcher();
  let loading = false;
  let error: string | null = null;

  async function confirmBooking() {
    loading = true;
    error = null;
    try {
      const payload = {
        pitch_id: slot.pitch_id,
        slot_datetime: slot.datetime_start,
        status: 'active'
      };

      const { data, error: insertErr } = await supabase.from('bookings').insert(payload).select().maybeSingle();
      if (insertErr) throw insertErr;
      dispatch('booked', { booking: data });
      onClose();
    } catch (e: any) {
      error = e?.message || String(e);
    } finally {
      loading = false;
    }
  }
</script>

<div class="modal-backdrop" role="dialog" aria-modal="true">
  <div class="modal neon-card">
    <header class="modal-header">
      <h3>Confirm booking</h3>
      <button class="close" on:click={onClose} aria-label="Close">✕</button>
    </header>

    <div class="modal-body">
      <p><strong>Pitch:</strong> {slot.pitch_name}</p>
      <p><strong>When:</strong> {new Date(slot.datetime_start).toLocaleString()}</p>
      {#if slot.is_available === false}
        <p class="muted">This slot appears booked. Confirm before continuing.</p>
      {/if}
      {#if error}
        <p class="error">{error}</p>
      {/if}
    </div>

    <footer class="modal-footer">
      <NeonButton on:click={onClose} variant="ghost">Cancel</NeonButton>
      <NeonButton on:click={confirmBooking} disabled={loading || !slot.is_available}> {loading ? 'Booking…' : 'Confirm Booking'}</NeonButton>
    </footer>
  </div>
</div>

<style>
  .modal-backdrop { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.45); z-index:50 }
  .modal { width: min(540px, 95%); padding:1rem; box-shadow: 0 8px 30px rgba(0,0,0,0.5) }
  .modal-header { display:flex; justify-content:space-between; align-items:center }
  .modal-body { margin-top:0.6rem }
  .modal-footer { display:flex; gap:0.5rem; justify-content:flex-end; margin-top:1rem }
  .close { background:transparent; border: none; font-size:1.1rem }
  .muted { color:var(--muted) }
  .error { color: var(--danger) }
</style>

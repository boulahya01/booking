<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabaseClient';
  import SlotCard from '$lib/components/SlotCard.svelte';
  import BookingModal from '$lib/components/BookingModal.svelte';
  import NeonCard from '$lib/components/NeonCard.svelte';
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte';

  let pitch: any = null;
  let slots: any[] = [];
  let loading = true;
  let loadingSlots = false;
  let selectedSlot: any = null;
  let showModal = false;

  const params = get(page).params;
  const pitchId = params.id;

  async function fetchPitch() {
    const { data, error } = await supabase.from('pitches').select('*').eq('id', pitchId).maybeSingle();
    if (error) {
      console.error('fetchPitch error', error);
      pitch = null;
    } else {
      pitch = data;
    }
  }

  async function fetchSlots() {
    loadingSlots = true;
    try {
      const res = await supabase.functions.invoke('available-slots', { body: JSON.stringify({ pitch_id: pitchId }) });
      // supabase.functions.invoke sometimes returns stringified JSON
      let data = (res && (res.data ?? res)) || null;
      if (typeof data === 'string') data = JSON.parse(data);
      slots = Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('fetchSlots error', e);
      slots = [];
    } finally {
      loadingSlots = false;
    }
  }

  function openBooking(slot) {
    selectedSlot = slot;
    showModal = true;
  }

  function onModalClose() {
    showModal = false;
    selectedSlot = null;
    // refresh slots after booking
    fetchSlots();
  }

  onMount(async () => {
    loading = true;
    await fetchPitch();
    await fetchSlots();
    loading = false;
  });

  $: grouped = slots.reduce((acc, s) => {
    const d = new Date(s.datetime_start).toLocaleDateString();
    (acc[d] ??= []).push(s);
    return acc;
  }, {} as Record<string, any[]>);
</script>

{#if loading}
  <LoadingSkeleton />
{:else}
  {#if pitch}
    <NeonCard>
      <h2>{pitch.name}</h2>
      <p class="muted">{pitch.location}</p>
      <p class="muted">Capacity: {pitch.capacity ?? '—'}</p>
    </NeonCard>

    <section class="slots-section">
      <h3>Available slots</h3>
      {#if loadingSlots}
        <LoadingSkeleton />
      {:else}
        {#if slots.length === 0}
          <p class="muted">No slots available.</p>
        {:else}
          {#each Object.entries(grouped) as [date, arr]}
            <div class="slot-day">
              <h4>{date}</h4>
              <div class="slot-grid">
                {#each arr as s}
                  <SlotCard {s} slot={s} on:click={() => openBooking(s)} onBook={(ev) => openBooking(ev)} />
                {/each}
              </div>
            </div>
          {/each}
        {/if}
      {/if}
    </section>

    {#if showModal && selectedSlot}
      <BookingModal {slot}={selectedSlot} onClose={onModalClose} on:booked={() => onModalClose()} />
    {/if}
  {:else}
    <p class="muted">Pitch not found.</p>
  {/if}
{/if}

<style>
  .slots-section { margin-top:0.8rem }
  .slot-day { margin-bottom:1rem }
  .slot-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:0.5rem }
  .muted { color:var(--muted) }
</style>

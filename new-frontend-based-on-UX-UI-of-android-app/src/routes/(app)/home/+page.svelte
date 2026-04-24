<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import NeonCard from '$lib/components/NeonCard.svelte'
  import PitchCard from '$lib/components/PitchCard.svelte'
  import NextBookingCard from '$lib/components/NextBookingCard.svelte'
  import TextField from '$lib/components/NeonTextField.svelte'
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte'
  import { sanitizeInput } from '$lib/validation'

  let pitches: any[] = []
  let filtered: any[] = []
  let loading = true
  let q = ''

  onMount(async () => {
    const { data, error } = await supabase.from('pitches').select('id,name,open_time,close_time')
    if (!error && data) {
      pitches = data
      filtered = pitches
    }
    loading = false
  })

  $: if (!loading) {
    const sq = sanitizeInput(q).toLowerCase()
    filtered = sq ? pitches.filter(p => (p.name || '').toLowerCase().includes(sq)) : pitches
  }
</script>

{#if loading}
  <div class="container">
    <LoadingSkeleton />
    <LoadingSkeleton />
  </div>
{:else}
  <div class="container">
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:12px">
      <NextBookingCard />
      <div>
        <TextField label="Search pitches" bind:value={q} placeholder="Search by name" />
      </div>
    </div>

    <h2 style="font-weight:700;margin-bottom:8px">Available Pitches</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem">
      {#each filtered as p}
        <PitchCard pitch={p} />
      {/each}
    </div>
  </div>
{/if}

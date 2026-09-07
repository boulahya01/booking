<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { language } from '$lib/stores/ui'
  import {
    listOpenMatches,
    listMyMatches,
    MatchApiError,
    matchErrorCopy
  } from '$lib/matchApi'

  let error = ''

  $: matchId = $page.params.id || ''
  $: ar = $language === 'ar'

  onMount(() => {
    void resolveBooking()
  })

  async function resolveBooking() {
    try {
      const [openRows, mineRows] = await Promise.all([
        listOpenMatches(),
        listMyMatches()
      ])
      const match = [...openRows, ...mineRows].find((item) => item.match_id === matchId)
      if (!match) {
        error = ar ? 'هذه المباراة لم تعد متاحة.' : 'This match is no longer available.'
        return
      }

      await goto(`/bookings/${match.booking_id}`, { replaceState: true })
    } catch (e) {
      error = matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language)
    }
  }
</script>

<svelte:head><title>UNEEM</title></svelte:head>

<main class="uneem-page-narrow">
  {#if error}
    <section class="uneem-empty py-10">
      <p class="font-bold text-text">{error}</p>
      <a href="/matches" class="uneem-primary-action mt-4 min-w-[120px]">
        {ar ? 'المباريات' : 'Matches'}
      </a>
    </section>
  {:else}
    <div class="space-y-3" aria-busy="true">
      <div class="h-28 animate-pulse rounded-[18px] bg-surface-level-1"></div>
      <div class="h-20 animate-pulse rounded-[18px] bg-surface-level-1"></div>
    </div>
  {/if}
</main>

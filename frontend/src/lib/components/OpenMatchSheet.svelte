<script lang="ts">
  import Button from '$lib/components/Button.svelte'
  import type { MyBooking } from '$lib/bookingApi'
  import { createOpenMatch, MatchApiError, matchErrorCopy } from '$lib/matchApi'
  import { language, uiState } from '$lib/stores/ui'

  export let booking: MyBooking
  export let onClose: () => void
  export let onOpened: (matchId: string) => void

  let reservedSpots = 0
  let working = false

  $: ar = $language === 'ar'
  $: capacity = Math.max(1, Number(booking.pitches?.capacity || 1))
  $: maxReservedSpots = Math.max(0, capacity - 2)
  $: openSpots = Math.max(0, capacity - 1 - reservedSpots)
  $: copy = ar ? {
    title:'فتح الحجز للاعبين', friends:'الأصدقاء معك', openSpots:'أماكن متاحة', back:'رجوع', opening:'جارٍ الفتح…', open:'افتح', opened:'تم فتح المباراة للاعبين'
  } : {
    title:'Open booking to players', friends:'Friends with you', openSpots:'Open spots', back:'Back', opening:'Opening…', open:'Open', opened:'Match is open'
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString(ar ? 'ar-MA' : 'en', {
      weekday:'short', month:'short', day:'numeric', timeZone: booking.pitches?.timezone || 'Africa/Casablanca'
    })
  }

  function formatTime(value: string) {
    return new Date(value).toLocaleTimeString(ar ? 'ar-MA' : 'en', {
      hour:'2-digit', minute:'2-digit', hour12:false, timeZone: booking.pitches?.timezone || 'Africa/Casablanca'
    })
  }

  async function confirm() {
    if (working || openSpots < 1) return
    working = true
    try {
      const opened = await createOpenMatch(booking.id, Math.min(reservedSpots, maxReservedSpots))
      uiState.addToast(copy.opened, 'success')
      onOpened(opened.id)
    } catch (e) {
      uiState.addToast(matchErrorCopy(e instanceof MatchApiError ? e.code : 'unknown', $language), 'error')
    } finally {
      working = false
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" role="presentation">
  <button type="button" tabindex="-1" aria-label="Close match dialog" class="absolute inset-0 cursor-default" disabled={working} on:click={onClose}></button>
  <section class="uneem-mobile-sheet relative z-10 sm:max-w-md" role="dialog" aria-modal="true" tabindex="-1">
    <h2 class="text-xl font-extrabold text-text">{copy.title}</h2>
    <p class="mt-1 text-sm text-text-muted">
      {booking.pitches?.name || 'Facility'} · {formatDate(booking.starts_at)} · {formatTime(booking.starts_at)}
    </p>

    <div class="mt-5 rounded-[16px] bg-surface-level-1 p-4">
      <div class="flex items-center justify-between gap-4">
        <span class="text-sm font-semibold text-text-secondary">{copy.friends}</span>
        <div class="flex items-center gap-2">
          <button
            class="grid h-10 w-10 place-items-center rounded-[12px] bg-surface text-lg font-bold text-text disabled:opacity-35"
            disabled={reservedSpots === 0 || working}
            on:click={() => reservedSpots = Math.max(0, reservedSpots - 1)}
            aria-label="Remove reserved friend"
          >−</button>
          <span class="min-w-7 text-center text-lg font-extrabold text-text">{reservedSpots}</span>
          <button
            class="grid h-10 w-10 place-items-center rounded-[12px] bg-surface text-lg font-bold text-text disabled:opacity-35"
            disabled={reservedSpots >= maxReservedSpots || working}
            on:click={() => reservedSpots = Math.min(maxReservedSpots, reservedSpots + 1)}
            aria-label="Add reserved friend"
          >+</button>
        </div>
      </div>

      <div class="mt-4 flex items-end justify-between border-t border-border-light pt-4">
        <span class="text-sm font-semibold text-text-secondary">{copy.openSpots}</span>
        <span class="text-3xl font-extrabold tracking-[-0.04em] text-text">{openSpots}</span>
      </div>
    </div>

    <div class="mt-5 flex gap-3">
      <Button variant="secondary" className="flex-1" disabled={working} on:click={onClose}>{copy.back}</Button>
      <Button className="flex-1" disabled={working || openSpots < 1} loading={working} on:click={confirm}>
        {working ? copy.opening : `${copy.open} ${openSpots}`}
      </Button>
    </div>
  </section>
</div>

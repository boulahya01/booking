<script lang="ts">
  import { onMount } from 'svelte'
  import { initPwaInstall } from '$lib/pwaInstall'
  import { initPwaUpdates } from '$lib/pwaUpdate'
  import PwaUpdateNotice from './PwaUpdateNotice.svelte'

  onMount(() => {
    const stopInstall = initPwaInstall()
    const stopUpdates = initPwaUpdates()
    return () => {
      stopUpdates()
      stopInstall()
    }
  })
</script>

<PwaUpdateNotice />

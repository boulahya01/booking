<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { fly } from 'svelte/transition'
  import { language } from '$lib/stores/ui'
  import Icon from './Icon.svelte'
  export let message = ''
  export let type: 'success' | 'error' | 'info' | 'warning' = 'info'
  export let id = ''
  const dispatch = createEventDispatcher()
  const icons = { success: 'circle-check', error: 'alert-circle', info: 'info', warning: 'alert-triangle' }
</script>

<div data-toast-id={id} class="ui-toast" data-tone={type} role={type === 'error' ? 'alert' : 'status'} in:fly={{ y: -8, duration: 160 }} out:fly={{ y: -4, duration: 100 }}>
  <span class="ui-toast-icon"><Icon name={icons[type]} size={22} /></span>
  <span class="ui-toast-message">{message}</span>
  <button type="button" on:click={() => dispatch('close')} class="uneem-icon-button" aria-label={$language === 'ar' ? 'إغلاق' : 'Dismiss'}><Icon name="x" size={18} /></button>
</div>

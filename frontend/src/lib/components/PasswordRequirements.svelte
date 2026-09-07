<script lang="ts">
  import Icon from './Icon.svelte'
  import { passwordRequirements } from '$lib/utils/cn'

  export let password = ''
  export let lengthLabel = '8+ characters'
  export let numberLabel = '1 number'
  export let symbolLabel = '1 symbol'

  $: requirements = passwordRequirements(password)
  $: rows = [
    { label: lengthLabel, passed: requirements.length },
    { label: numberLabel, passed: requirements.number },
    { label: symbolLabel, passed: requirements.symbol }
  ]
</script>

<ul class="space-y-2 px-1" aria-label="Password requirements" aria-live="polite">
  {#each rows as row}
    <li class={`flex items-center gap-2 text-sm ${row.passed ? 'text-success' : password.length ? 'text-text-secondary' : 'text-text-muted'}`}>
      <span class={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${row.passed ? 'bg-success-light text-success' : 'bg-surface-level-1 text-text-muted'}`} aria-hidden="true">
        <Icon name={row.passed ? 'check' : 'x'} size={12} strokeWidth={2.5} />
      </span>
      <span>{row.label}</span>
    </li>
  {/each}
</ul>

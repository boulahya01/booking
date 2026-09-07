<script lang="ts">
  import Icon from './Icon.svelte'
  import { passwordRequirements } from '$lib/utils/cn'

  export let password = ''
  export let lengthLabel = 'At least 8 characters'
  export let numberLabel = 'At least 1 number'
  export let symbolLabel = 'At least 1 symbol'

  $: requirements = passwordRequirements(password)
  $: alternativeLabel = symbolLabel.includes('واحد على الأقل')
    ? `${numberLabel} أو ${symbolLabel.replace(/\s*واحد على الأقل$/, '')}`
    : `${numberLabel} or ${symbolLabel.replace(/^At least 1\s+/, '')}`
  $: rows = [
    { label: lengthLabel, passed: requirements.length },
    { label: alternativeLabel, passed: requirements.numberOrSymbol }
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

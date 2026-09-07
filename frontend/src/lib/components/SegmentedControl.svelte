<script lang="ts">
  export type SegmentOption = {
    value: string
    label: string
    disabled?: boolean
  }

  export let options: SegmentOption[] = []
  export let value = ''
  export let ariaLabel = 'Options'
  export let scrollable = false
  export let className = ''
  export let onChange: (value: string) => void = () => {}
</script>

<div
  class={`uneem-segmented ${scrollable ? 'is-scrollable' : ''} ${className}`}
  role="group"
  aria-label={ariaLabel}
>
  <div class="uneem-segmented-track">
    {#each options as option (option.value)}
      <button
        type="button"
        class="uneem-segmented-option"
        class:is-active={value === option.value}
        disabled={option.disabled}
        aria-pressed={value === option.value}
        on:click={() => onChange(option.value)}
      >
        {option.label}
      </button>
    {/each}
  </div>
</div>

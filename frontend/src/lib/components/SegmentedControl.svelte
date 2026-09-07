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

<style>
  .uneem-segmented {
    max-width: 100%;
  }

  .uneem-segmented.is-scrollable {
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .uneem-segmented.is-scrollable::-webkit-scrollbar {
    display: none;
  }

  .uneem-segmented-track {
    display: inline-flex;
    min-width: 100%;
    align-items: center;
    gap: 0.2rem;
    border: 1px solid var(--border-light);
    border-radius: 12px;
    background: var(--surface-level-1);
    padding: 3px;
  }

  .is-scrollable .uneem-segmented-track {
    min-width: max-content;
  }

  .uneem-segmented-option {
    min-height: 36px;
    flex: 1 0 auto;
    border: 1px solid transparent;
    border-radius: 9px;
    padding: 0.45rem 0.85rem;
    color: var(--text-secondary);
    background: transparent;
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    transition: color 130ms ease, background 130ms ease, border-color 130ms ease, box-shadow 130ms ease;
  }

  .uneem-segmented-option:hover:not(:disabled):not(.is-active) {
    color: var(--text);
    background: color-mix(in srgb, var(--surface) 60%, transparent);
  }

  .uneem-segmented-option.is-active {
    border-color: var(--border-light);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-sm);
  }

  .uneem-segmented-option:focus-visible {
    box-shadow: var(--focus-ring);
  }

  .uneem-segmented-option:disabled {
    opacity: 0.42;
  }

  :global(.dark) .uneem-segmented-option.is-active {
    border-color: var(--border);
    background: var(--surface-raised);
  }
</style>

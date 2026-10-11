<script lang="ts">
  export let className = ''
</script>

<span class={`loading-shape ${className}`} aria-hidden="true"></span>

<style>
  .loading-shape { display: block; position: relative; flex-shrink: 0; overflow: hidden; border-radius: 6px; background: var(--surface-level-1); }
  .loading-shape::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, var(--surface-raised), transparent); transform: translateX(-100%); animation: loading-sweep 1.8s ease-in-out infinite; }
  @keyframes loading-sweep { to { transform: translateX(100%); } }
  @media (prefers-reduced-motion: reduce) { .loading-shape::after { animation: none; background: none; } }
</style>

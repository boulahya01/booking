<script lang="ts">
  export let count: number = 0
</script>

<div class="flex items-center gap-1.5 text-text-muted" role="status" aria-label={`You have ${count} notifications`}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 22c1.1046 0 2-.8954 2-2h-4c0 1.1046.8954 2 2 2z" fill="currentColor" opacity="0.9"/>
    <path d="M18 16v-5c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 10-3 0v.68C7.63 5.36 6 7.92 6 11v5l-1.99 2h15.98L18 16z" fill="currentColor"/>
  </svg>
  {#if count > 0}
    <span class="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{count}</span>
  {/if}
</div>

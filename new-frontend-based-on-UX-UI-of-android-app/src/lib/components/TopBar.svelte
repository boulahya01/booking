<script lang="ts">
  import { user, isAuthenticated, clearUser } from '$lib/stores/auth'
  import NeonButton from '$lib/components/NeonButton.svelte'
  import NotificationBadge from '$lib/components/NotificationBadge.svelte'
  import { supabase } from '$lib/supabaseClient'
  import { onMount } from 'svelte'
</script>

<div class="topbar">
  <div class="brand">Booking</div>
  <div style="display:flex;gap:.6rem;align-items:center">
    <NotificationBadge count={0} />
    {#if $isAuthenticated}
      <div style="color:var(--muted);margin-right:.6rem">{$user?.full_name || $user?.email}</div>
      <NeonButton on:click={async () => { await supabase.auth.signOut(); clearUser(); window.location.href = '/login' }}>
        Logout
      </NeonButton>
    {:else}
      <a href="/login" class="neon-button">Sign in</a>
    {/if}
  </div>
</div>

<style>
  .brand{font-weight:800}
</style>

<script lang="ts">
  import { isAdmin } from '$lib/stores/auth'
</script>

<nav class="bottom-nav" role="navigation" aria-label="Bottom navigation">
  <a href="/home">Home</a>
  <a href="/bookings">Bookings</a>
  <a href="/profile">Profile</a>
  {#if $isAdmin}
    <a href="/admin/users">Admin</a>
  {/if}
</nav>

<style>
  nav a{color:var(--text);text-decoration:none;padding:.5rem .6rem;border-radius:8px}
  nav a:hover{background:rgba(255,255,255,0.02)}
</style>

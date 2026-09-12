<script lang="ts">
  import { browser } from '$app/environment'
  import PublicPage from '$lib/components/PublicPage.svelte'
  import { entryState, markWelcomeSeen } from '$lib/entryState'
  import { authState } from '$lib/stores/auth'

  $: showLanding = browser &&
    $entryState.ready &&
    !$authState.loading &&
    !$authState.user &&
    !$entryState.welcomeSeen
</script>

<svelte:head>
  <title>UNEM Sports — Student sports booking</title>
  <meta
    name="description"
    content="UNEM Sports helps students discover university sports facilities, book available time slots, and create or join open matches."
  />
  <meta property="og:title" content="UNEM Sports" />
  <meta
    property="og:description"
    content="A simple student sports platform for facilities, bookings and open matches."
  />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://uneem.site/" />
  <link rel="canonical" href="https://uneem.site/" />
</svelte:head>

{#if showLanding}
  <PublicPage>
    <section class="hero" aria-labelledby="home-title">
      <p class="eyebrow">Student sports, simplified</p>
      <h1 id="home-title">Book. Play. Meet.</h1>
      <p class="hero-copy">
        UNEM Sports helps students discover university sports facilities, see available time slots,
        book facilities, and create or join open matches in one place.
      </p>

      <div class="hero-actions">
        <a class="primary-action" href="/login" on:click={markWelcomeSeen}>Sign in</a>
        <a class="secondary-action" href="/register" on:click={markWelcomeSeen}>Create account</a>
      </div>
    </section>

    <section class="capabilities" aria-label="What UNEM Sports does">
      <article>
        <span>01</span>
        <h2>Find a facility</h2>
        <p>See sports facilities and available time slots without digging through schedules.</p>
      </article>
      <article>
        <span>02</span>
        <h2>Book quickly</h2>
        <p>Choose a valid slot and manage your booking from the same simple flow.</p>
      </article>
      <article>
        <span>03</span>
        <h2>Play together</h2>
        <p>Create or join open matches and share a match with other students.</p>
      </article>
    </section>

    <section class="trust-note" aria-labelledby="verification-title">
      <div>
        <p class="eyebrow">Student verification</p>
        <h2 id="verification-title">One student. One verified Student ID.</h2>
      </div>
      <p>
        Anyone can create an account and browse. Booking and participation unlock only after a
        unique Student ID is verified.
      </p>
    </section>
  </PublicPage>
{:else}
  <div class="entry-pending" role="status" aria-label="Opening UNEM Sports">
    <div class="entry-mark" aria-hidden="true"></div>
  </div>
{/if}

<style>
  .entry-pending {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    background: var(--bg);
  }

  .entry-mark {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    background: var(--primary);
  }

  .hero {
    max-width: 820px;
    padding-top: clamp(16px, 5vw, 52px);
  }

  .eyebrow {
    margin: 0 0 14px;
    color: var(--primary);
    font-size: 12px;
    line-height: 1.2;
    font-weight: 760;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    max-width: 780px;
    font-size: clamp(3.25rem, 10vw, 7.25rem);
    line-height: 0.88;
    letter-spacing: -0.075em;
    font-weight: 790;
    text-wrap: balance;
  }

  .hero-copy {
    max-width: 680px;
    margin: 28px 0 0;
    color: var(--text-secondary);
    font-size: clamp(1rem, 2vw, 1.18rem);
    line-height: 1.62;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 30px;
  }

  .primary-action,
  .secondary-action {
    min-height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    padding-inline: 20px;
    font-size: 15px;
    font-weight: 700;
    transition: transform var(--motion-fast) var(--motion-ease), background var(--motion-fast) var(--motion-ease);
  }

  .primary-action {
    background: var(--text);
    color: var(--text-inverse);
  }

  .secondary-action {
    background: var(--surface-level-1);
    color: var(--text);
  }

  .primary-action:active,
  .secondary-action:active {
    transform: scale(0.985);
  }

  .capabilities {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1px;
    margin-top: clamp(72px, 11vw, 132px);
    overflow: hidden;
    border-block: 1px solid var(--border-light);
  }

  .capabilities article {
    min-width: 0;
    padding: 28px clamp(18px, 3vw, 30px) 32px;
    background: var(--bg);
  }

  .capabilities article + article {
    border-inline-start: 1px solid var(--border-light);
  }

  .capabilities span {
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 700;
  }

  .capabilities h2,
  .trust-note h2 {
    margin: 20px 0 0;
    color: var(--text);
    font-size: 1.15rem;
    line-height: 1.25;
    letter-spacing: -0.025em;
    font-weight: 730;
  }

  .capabilities p {
    margin: 9px 0 0;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.58;
  }

  .trust-note {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: clamp(28px, 7vw, 100px);
    align-items: end;
    margin-top: clamp(68px, 10vw, 118px);
    padding: clamp(28px, 5vw, 52px);
    border-radius: 26px;
    background: var(--surface);
  }

  .trust-note .eyebrow {
    margin-bottom: 0;
  }

  .trust-note h2 {
    margin-top: 10px;
    max-width: 440px;
    font-size: clamp(1.65rem, 4vw, 2.65rem);
    line-height: 1.04;
    letter-spacing: -0.045em;
  }

  .trust-note > p {
    margin: 0;
    max-width: 520px;
    color: var(--text-secondary);
    font-size: 15px;
    line-height: 1.66;
  }

  @media (max-width: 760px) {
    h1 {
      font-size: clamp(3.05rem, 17vw, 5rem);
    }

    .capabilities {
      grid-template-columns: 1fr;
    }

    .capabilities article + article {
      border-inline-start: 0;
      border-top: 1px solid var(--border-light);
    }

    .capabilities article {
      padding-inline: 0;
    }

    .trust-note {
      grid-template-columns: 1fr;
      align-items: start;
      padding: 24px;
      border-radius: 22px;
    }
  }
</style>

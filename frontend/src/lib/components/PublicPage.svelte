<div class="public-site">
  <header class="public-header">
    <a href="/" class="public-brand" aria-label="UNEM Sports home">
      UNEM Sports<span aria-hidden="true">.</span>
    </a>
    <nav aria-label="Account">
      <a href="/login" class="public-signin">Sign in</a>
    </nav>
  </header>

  <main class="public-main">
    <slot />
  </main>

  <footer class="public-footer">
    <p>UNEM Sports</p>
    <nav aria-label="Legal">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/data-deletion">Data deletion</a>
    </nav>
  </footer>
</div>

<style>
  .public-site {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }

  .public-header,
  .public-footer,
  .public-main {
    width: min(100% - 32px, 1120px);
    margin-inline: auto;
  }

  .public-header {
    min-height: 76px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .public-brand {
    font-size: 18px;
    line-height: 1;
    font-weight: 760;
    letter-spacing: -0.035em;
  }

  .public-brand span {
    color: var(--primary);
  }

  .public-signin {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    padding-inline: 14px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 650;
    color: var(--text-secondary);
    transition: background var(--motion-fast) var(--motion-ease), color var(--motion-fast) var(--motion-ease);
  }

  .public-signin:hover {
    background: var(--surface-level-1);
    color: var(--text);
  }

  .public-main {
    flex: 1;
    padding-block: clamp(36px, 7vw, 88px) 72px;
  }

  .public-footer {
    min-height: 92px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    border-top: 1px solid var(--border-light);
    color: var(--text-muted);
    font-size: 13px;
  }

  .public-footer p {
    margin: 0;
    font-weight: 650;
    color: var(--text-secondary);
  }

  .public-footer nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 18px;
  }

  .public-footer a:hover {
    color: var(--text);
  }

  :global(.public-copy) {
    width: min(100%, 760px);
    margin-inline: auto;
  }

  :global(.public-copy .eyebrow) {
    margin: 0 0 12px;
    color: var(--primary);
    font-size: 12px;
    line-height: 1.2;
    font-weight: 760;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  :global(.public-copy h1) {
    margin: 0;
    max-width: 720px;
    font-size: clamp(2.15rem, 7vw, 4rem);
    line-height: 0.98;
    letter-spacing: -0.055em;
    font-weight: 780;
  }

  :global(.public-copy .lede) {
    max-width: 680px;
    margin: 20px 0 0;
    color: var(--text-secondary);
    font-size: clamp(1rem, 2vw, 1.12rem);
    line-height: 1.65;
  }

  :global(.public-copy .updated) {
    margin: 14px 0 0;
    color: var(--text-muted);
    font-size: 13px;
  }

  :global(.public-copy .legal-body) {
    margin-top: 44px;
  }

  :global(.public-copy section) {
    margin-top: 34px;
  }

  :global(.public-copy h2) {
    margin: 0 0 10px;
    color: var(--text);
    font-size: 1.08rem;
    line-height: 1.35;
    font-weight: 720;
    letter-spacing: -0.02em;
  }

  :global(.public-copy p),
  :global(.public-copy li) {
    color: var(--text-secondary);
    font-size: 15px;
    line-height: 1.72;
  }

  :global(.public-copy p) {
    margin: 0;
  }

  :global(.public-copy p + p) {
    margin-top: 12px;
  }

  :global(.public-copy ul) {
    margin: 10px 0 0;
    padding-inline-start: 20px;
  }

  :global(.public-copy a.inline-link) {
    color: var(--primary);
    font-weight: 650;
  }

  @media (max-width: 640px) {
    .public-header,
    .public-footer,
    .public-main {
      width: min(100% - 32px, 1120px);
    }

    .public-header {
      min-height: 68px;
    }

    .public-main {
      padding-block: 34px 56px;
    }

    .public-footer {
      align-items: flex-start;
      flex-direction: column;
      justify-content: center;
      padding-block: 24px;
    }

    .public-footer nav {
      justify-content: flex-start;
      gap: 14px 18px;
    }

    :global(.public-copy .legal-body) {
      margin-top: 36px;
    }
  }
</style>

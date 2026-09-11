<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import { authState, isAuthenticated } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'
  import { afterSignIn } from '$lib/inviteNavigation'
  import Button from '$lib/components/Button.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import SocialSignIn from '$lib/components/SocialSignIn.svelte'
  import Icon from '$lib/components/Icon.svelte'

  const WELCOME_SEEN_KEY = 'uneem:welcome-seen'

  function hasSeenWelcome(): boolean {
    if (!browser) return false
    return localStorage.getItem(WELCOME_SEEN_KEY) === 'true'
  }

  function markWelcomeSeen(): void {
    if (!browser) return
    localStorage.setItem(WELCOME_SEEN_KEY, 'true')
  }

  let socialLoading = false
  let mounted = false

  $: ar = $language === 'ar'
  $: copy = ar
    ? {
        title: 'UNEEM Sports',
        subtitle: 'احجز الملاعب، انضم للمباريات، وتابع نشاطك الرياضي.',
        signIn: 'تسجيل الدخول',
        createAccount: 'إنشاء حساب',
        or: 'أو',
        google: 'Google',
        football: 'كرة القدم',
        basketball: 'كرة السلة',
        tennis: 'التنس',
        more: 'والمزيد...'
      }
    : {
        title: 'UNEEM Sports',
        subtitle: 'Book pitches, join matches, and track your sports activity.',
        signIn: 'Sign in',
        createAccount: 'Create account',
        or: 'or',
        google: 'Google',
        football: 'Football',
        basketball: 'Basketball',
        tennis: 'Tennis',
        more: 'and more...'
      }

  onMount(() => {
    mounted = true
    markWelcomeSeen()

    // If already authenticated, redirect to app
    if ($isAuthenticated) {
      const account = $authState.account
      void goto(afterSignIn(account), { replaceState: true })
    }
  })

  async function handleSocialSignIn() {
    // SocialSignIn component handles the actual OAuth flow
    // This is just a placeholder for any additional logic
  }
</script>

<svelte:head>
  <title>UNEEM Sports</title>
  <meta name="description" content="UNEEM Sports - Book pitches, join matches, and track your sports activity at university." />
</svelte:head>

<main class="landing-page" aria-labelledby="landing-title">
  <header class="landing-header">
    <div class="landing-brand">
      <Icon name="trophy" size={32} className="landing-icon" />
      <h1 id="landing-title" class="landing-title">{copy.title}</h1>
    </div>
    <nav class="landing-nav" aria-label="Landing navigation">
      <ActionLink href="/login" variant="ghost" size="sm">{copy.signIn}</ActionLink>
    </nav>
  </header>

  <section class="landing-hero" aria-labelledby="hero-title">
    <h2 id="hero-title" class="visually-hidden">{copy.title} - {copy.subtitle}</h2>
    <p class="landing-subtitle">{copy.subtitle}</p>

    <div class="landing-sports" aria-label="Available sports">
      <span class="sport-badge">{copy.football}</span>
      <span class="sport-badge">{copy.basketball}</span>
      <span class="sport-badge">{copy.tennis}</span>
      <span class="sport-badge">{copy.more}</span>
    </div>

    <div class="landing-actions">
      <ActionLink href="/register" variant="primary" size="lg" class="w-full sm:w-auto">
        <Icon name="user-plus" size={18} className="me-2" />
        {copy.createAccount}
      </ActionLink>
      <p class="landing-divider"><span>{copy.or}</span></p>
      <SocialSignIn disabled={false} bind:busy={socialLoading} />
    </div>
  </section>

  <footer class="landing-footer">
    <nav aria-label="Legal links">
      <a href="/help" class="landing-link">{ar ? 'المساعدة' : 'Help'}</a>
      <span class="landing-separator" aria-hidden="true">·</span>
      <a href="/help#privacy" class="landing-link">{ar ? 'الخصوصية' : 'Privacy'}</a>
      <span class="landing-separator" aria-hidden="true">·</span>
      <a href="/help#terms" class="landing-link">{ar ? 'الشروط' : 'Terms'}</a>
    </nav>
    <p class="landing-copyright">© 2026 UNEEM Sports</p>
  </footer>
</main>

<style>
  .landing-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 24px 16px 32px;
    max-width: 480px;
    margin: 0 auto;
  }

  .landing-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 40px;
  }

  .landing-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .landing-title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text);
  }

  .landing-nav {
    flex-shrink: 0;
  }

  .landing-hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 32px;
    padding: 20px 0;
  }

  .landing-subtitle {
    font-size: 16px;
    line-height: 1.6;
    color: var(--text-secondary);
    max-width: 360px;
  }

  .landing-sports {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .sport-badge {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--surface-level-1);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
  }

  .landing-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 100%;
    max-width: 360px;
  }

  .landing-divider {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    color: var(--text-muted);
    font-size: 13px;
  }

  .landing-divider span {
    background: var(--surface);
    padding: 0 8px;
    z-index: 1;
  }

  .landing-divider::before,
  .landing-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .landing-footer {
    margin-top: auto;
    padding-top: 32px;
    text-align: center;
  }

  .landing-footer nav {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .landing-link {
    font-size: 13px;
    color: var(--text-secondary);
    transition: color 0.2s;
  }

  .landing-link:hover {
    color: var(--primary);
  }

  .landing-separator {
    color: var(--text-muted);
  }

  .landing-copyright {
    font-size: 12px;
    color: var(--text-muted);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
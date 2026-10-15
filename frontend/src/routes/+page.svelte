<script lang="ts">
  import { browser } from '$app/environment'
  import PublicPage from '$lib/components/PublicPage.svelte'
  import { entryState, markWelcomeSeen } from '$lib/entryState'
  import { authState } from '$lib/stores/auth'
  import { language } from '$lib/stores/ui'

  $: ar = $language === 'ar'
  $: copy = ar ? {
    title: 'UNEM Sports — حجز المرافق الرياضية للطلبة',
    description: 'اكتشف المرافق الرياضية الجامعية، واحجز الأوقات المتاحة، وأنشئ مباريات مفتوحة أو انضم إليها مع UNEM Sports.',
    socialDescription: 'منصة رياضية بسيطة للطلبة تجمع المرافق والحجوزات والمباريات المفتوحة.',
    eyebrow: 'الرياضة الجامعية، بكل بساطة',
    heading: 'احجز. العب. تعارف.',
    introduction: 'اعثر على ملعب، واحجز وقتك، وانضم إلى مباريات مفتوحة مع زملائك في الجامعة.',
    accountActions: 'إجراءات الحساب',
    getStarted: 'ابدأ الآن',
    illustration: 'رسم توضيحي لملعب UNEM Sports',
    visualCaption: 'كل ما تحتاجه لمباراتك القادمة',
    visualTitle: 'اعثر على ملعبك.',
    capabilitiesLabel: 'ما الذي يقدمه UNEM Sports',
    capabilitiesEyebrow: 'صُمّم للطلبة',
    capabilitiesTitle: 'كل ما تحتاجه من الفكرة إلى صافرة البداية.',
    capabilities: [
      { title: 'اعثر على مرفق', description: 'اطّلع على الملاعب والأوقات المتاحة بسهولة.' },
      { title: 'احجز بسهولة', description: 'اختر وقتاً متاحاً وأكمل حجزك بخطوات واضحة.' },
      { title: 'العب مع الآخرين', description: 'افتح حجزك للانضمام أو شارك في مباراة مع طلبة آخرين.' }
    ],
    verificationEyebrow: 'التحقق من الهوية الطلابية',
    verificationTitle: 'هوية طلابية موثّقة لكل طالب.',
    verificationDescription: 'يمكن للجميع إنشاء حساب والتصفح. يتاح الحجز والانضمام إلى المباريات بعد التحقق من رقم طالب فريد.',
    opening: 'جارٍ فتح UNEM Sports'
  } : {
    title: 'UNEM Sports — Student sports booking',
    description: 'UNEM Sports helps students discover university sports facilities, book available time slots, and create or join open matches.',
    socialDescription: 'A simple student sports platform for facilities, bookings and open matches.',
    eyebrow: 'Campus sport, made simple',
    heading: 'Book. Play. Meet.',
    introduction: 'Find a court, reserve a time, and join open matches with students on campus.',
    accountActions: 'Account actions',
    getStarted: 'Get started',
    illustration: 'UNEM Sports court illustration',
    visualCaption: 'One place for your next game',
    visualTitle: 'Find your court.',
    capabilitiesLabel: 'What UNEM Sports does',
    capabilitiesEyebrow: 'Made for students',
    capabilitiesTitle: 'Everything between the idea and the first whistle.',
    capabilities: [
      { title: 'Find a facility', description: 'See open courts and time slots without digging through schedules.' },
      { title: 'Book quickly', description: 'Choose a valid slot and keep the booking in one simple flow.' },
      { title: 'Play together', description: 'Open your booking or join a match with other students.' }
    ],
    verificationEyebrow: 'Student verification',
    verificationTitle: 'One student. One verified Student ID.',
    verificationDescription: 'Anyone can create an account and browse. Booking and participation unlock only after a unique Student ID is verified.',
    opening: 'Opening UNEM Sports'
  }

  $: showLanding = browser &&
    $entryState.ready &&
    !$authState.loading &&
    !$authState.user &&
    !$entryState.welcomeSeen
</script>

<svelte:head>
  <title>{copy.title}</title>
  <meta
    name="description"
    content={copy.description}
  />
  <meta property="og:title" content="UNEM Sports" />
  <meta
    property="og:description"
    content={copy.socialDescription}
  />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://uneem.site/" />
  <link rel="canonical" href="https://uneem.site/" />
</svelte:head>

{#if showLanding}
  <PublicPage showAccountLink={false}>
    <div class="landing-grid">
      <section class="hero" aria-labelledby="home-title" aria-describedby="home-copy">
        <p class="eyebrow">{copy.eyebrow}</p>
        <h1 id="home-title">{copy.heading}</h1>
        <p id="home-copy" class="hero-copy">
          {copy.introduction}
        </p>

        <div class="hero-actions" aria-label={copy.accountActions}>
          <a class="primary-action" href="/login" on:click={markWelcomeSeen}>
            <span>{copy.getStarted}</span>
            <span class="action-arrow" aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <figure class="hero-visual">
        <img src="/assets/brand/landing-court.svg" alt={copy.illustration} width="720" height="720" loading="eager" />
        <figcaption><span>{copy.visualCaption}</span><strong>{copy.visualTitle}</strong></figcaption>
      </figure>
    </div>

    <section class="capabilities" aria-label={copy.capabilitiesLabel}>
      <div class="capabilities-intro">
        <p class="eyebrow">{copy.capabilitiesEyebrow}</p>
        <h2>{copy.capabilitiesTitle}</h2>
      </div>
      <div class="capability-list">
        {#each copy.capabilities as capability, index}
          <article><span dir="ltr">{String(index + 1).padStart(2, '0')}</span><div><h3>{capability.title}</h3><p>{capability.description}</p></div></article>
        {/each}
      </div>
    </section>

    <section class="trust-note" aria-labelledby="verification-title">
      <div>
        <p class="eyebrow">{copy.verificationEyebrow}</p>
        <h2 id="verification-title">{copy.verificationTitle}</h2>
      </div>
      <p>
        {copy.verificationDescription}
      </p>
    </section>
  </PublicPage>
{:else}
  <div class="entry-pending" role="status" aria-label={copy.opening}>
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
    max-width: 650px;
    padding-block-start: clamp(12px, 4vw, 52px);
  }

  .landing-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.75fr);
    gap: clamp(32px, 7vw, 100px);
    align-items: center;
  }

  .eyebrow {
    margin: 0;
    margin-block-end: 14px;
    color: var(--primary);
    font-size: 12px;
    line-height: 1.2;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    max-width: 780px;
    font-size: clamp(3.25rem, 10vw, 7.25rem);
    line-height: 0.88;
    letter-spacing: var(--tracking-tight);
    font-weight: 600;
    text-wrap: balance;
  }

  .hero-copy {
    max-width: 34rem;
    margin: 0;
    margin-block-start: 28px;
    color: var(--text-secondary);
    font-size: clamp(1rem, 2vw, 1.18rem);
    line-height: 1.62;
  }

  .hero-actions {
    display: flex;
    margin-block-start: 30px;
  }

  .primary-action {
    min-height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    padding-inline: 22px;
    font-size: 15px;
    font-weight: 500;
    transition: transform var(--motion-fast) var(--motion-ease), background var(--motion-fast) var(--motion-ease), box-shadow var(--motion-fast) var(--motion-ease);
  }

  .primary-action {
    gap: 12px;
    background: var(--primary-action);
    color: #fff;
    box-shadow: 0 10px 24px color-mix(in srgb, var(--primary) 22%, transparent);
  }

  .action-arrow {
    font-size: 20px;
    line-height: 1;
    transition: transform var(--motion-fast) var(--motion-ease);
  }

  .primary-action:hover,
  .primary-action:focus-visible {
    background: var(--primary-hover);
    box-shadow: 0 14px 30px color-mix(in srgb, var(--primary) 30%, transparent);
  }

  .primary-action:active {
    transform: scale(0.985);
  }

  .primary-action:hover .action-arrow,
  .primary-action:focus-visible .action-arrow { transform: translate(2px, -2px); }

  .hero-visual {
    position: relative;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    border-radius: 30px;
    background: #101113;
    box-shadow: var(--shadow-lg);
  }

  .hero-visual img { display: block; width: 100%; height: auto; }

  .hero-visual figcaption {
    position: absolute;
    inset-block-end: 18px;
    inset-inline: 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 16px;
    background: rgba(16,17,19,.74);
    color: #fff;
    backdrop-filter: blur(12px);
  }

  .hero-visual figcaption span { color: rgba(255,255,255,.68); font-size: 11px; }
  .hero-visual figcaption strong { font-size: 16px; font-weight: 500; }

  .capabilities {
    display: grid;
    grid-template-columns: minmax(220px, .72fr) minmax(0, 1.28fr);
    gap: clamp(28px, 8vw, 120px);
    margin-block-start: clamp(64px, 11vw, 132px);
    padding-block: 28px;
    border-block: 1px solid var(--border-light);
  }

  .capabilities-intro h2 {
    max-width: 18rem;
    margin-block-start: 16px;
    color: var(--text);
    font-size: clamp(1.45rem, 3vw, 2.15rem);
    line-height: 1.08;
    letter-spacing: var(--tracking-tight);
  }

  .capability-list { display: grid; }

  .capability-list article {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 16px;
    min-width: 0;
    padding-block: 16px;
    border-block-start: 1px solid var(--border-light);
  }

  .capability-list article:first-child { padding-block-start: 0; border-block-start: 0; }

  .capability-list article:last-child { padding-block-end: 0; }

  .capability-list h3 {
    color: var(--text);
    font-size: 1rem;
    line-height: 1.25;
    font-weight: 500;
  }

  .capability-list span {
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
  }

  .capability-list p {
    margin: 0;
    margin-block-start: 9px;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.58;
  }

  .trust-note {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: clamp(28px, 7vw, 100px);
    align-items: end;
    margin-block-start: clamp(60px, 10vw, 118px);
    padding: clamp(28px, 5vw, 52px);
    border-radius: 26px;
    background: var(--surface);
  }

  .trust-note .eyebrow {
    margin-block-end: 0;
  }

  .trust-note h2 {
    margin: 10px 0 0;
    max-width: 440px;
    font-size: clamp(1.65rem, 4vw, 2.65rem);
    line-height: 1.04;
    letter-spacing: var(--tracking-tight);
  }

  .trust-note > p {
    margin: 0;
    max-width: 520px;
    color: var(--text-secondary);
    font-size: 15px;
    line-height: 1.66;
  }

  :global(html[lang='ar']) h1 { font-weight: 500; line-height: 1.2; letter-spacing: 0; }
  :global(html[lang='ar']) h2 { font-weight: 500; line-height: 1.35; letter-spacing: 0; }
  :global(html[lang='ar']) .eyebrow { line-height: 1.5; letter-spacing: 0; text-transform: none; }

  @media (max-width: 760px) {
    .landing-grid { grid-template-columns: 1fr; gap: 34px; }

    h1 {
      font-size: clamp(2.75rem, 14vw, 4.6rem);
    }

    .hero-copy {
      max-width: 36rem;
      margin-block-start: 22px;
    }

    .capabilities {
      grid-template-columns: 1fr;
      gap: 28px;
      margin-block-start: 64px;
    }

    .capabilities-intro h2 { max-width: 22rem; }

    .trust-note {
      grid-template-columns: 1fr;
      align-items: start;
      padding: 24px;
      border-radius: 22px;
    }
  }

  @media (max-width: 430px) {
    .hero {
      padding-block-start: 4px;
    }

    .hero-actions { margin-block-start: 24px; }

    .primary-action { width: 100%; }

    .capabilities {
      margin-block-start: 52px;
    }

    .trust-note {
      margin-block-start: 52px;
      padding: 20px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .primary-action,
    .action-arrow {
      transition: none;
    }
  }
</style>

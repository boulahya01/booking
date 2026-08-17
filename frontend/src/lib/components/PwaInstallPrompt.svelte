<script lang="ts">
  import { onMount } from 'svelte'
  import { locale } from 'svelte-i18n'
  import { pwaInstall, type DeferredInstallPrompt } from '$lib/stores/pwa'

  const DISMISS_KEY = 'pwa_install_dismissed_until'
  const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000

  $: isArabic = $locale === 'ar'
  $: copy = isArabic
    ? {
        title: 'أضف UnemBook إلى الشاشة الرئيسية',
        body: 'افتح حجوزاتك بشكل أسرع في المرة القادمة.',
        install: 'تثبيت',
        later: 'ليس الآن'
      }
    : {
        title: 'Add UnemBook to your Home Screen',
        body: 'Open your bookings faster next time.',
        install: 'Install',
        later: 'Not now'
      }

  $: canInstall = Boolean(
    $pwaInstall.prompt &&
    $pwaInstall.engaged &&
    !$pwaInstall.installed &&
    Date.now() >= $pwaInstall.dismissedUntil
  )

  onMount(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

    if (isStandalone) pwaInstall.setInstalled(true)

    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (Number.isFinite(dismissedUntil) && dismissedUntil > 0) {
      pwaInstall.setDismissedUntil(dismissedUntil)
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      const prompt = event as DeferredInstallPrompt
      prompt.preventDefault()
      pwaInstall.setPrompt(prompt)
    }

    const handleInstalled = () => {
      localStorage.removeItem(DISMISS_KEY)
      pwaInstall.setInstalled(true)
      pwaInstall.setEngaged(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  })

  function dismiss() {
    const dismissedUntil = Date.now() + DISMISS_FOR_MS
    localStorage.setItem(DISMISS_KEY, String(dismissedUntil))
    pwaInstall.setDismissedUntil(dismissedUntil)
    pwaInstall.setEngaged(false)
  }

  async function install() {
    const prompt = $pwaInstall.prompt
    if (!prompt) return

    try {
      await prompt.prompt()
      const choice = await prompt.userChoice

      if (choice.outcome === 'accepted') {
        localStorage.removeItem(DISMISS_KEY)
        pwaInstall.setInstalled(true)
      } else {
        dismiss()
      }
    } finally {
      pwaInstall.setPrompt(null)
      pwaInstall.setEngaged(false)
    }
  }
</script>

{#if canInstall}
  <aside
    class="fixed z-[60] start-4 end-4 bottom-24 md:bottom-6 mx-auto max-w-md rounded-2xl border border-border bg-surface p-4 shadow-xl"
    role="status"
    aria-live="polite"
  >
    <div class="flex items-start gap-3">
      <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
        <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
          <path d="M12 18h.01" />
          <path d="m9 10 3 3 3-3" />
          <path d="M12 13V6" />
        </svg>
      </div>

      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-semibold text-text">{copy.title}</h2>
        <p class="mt-1 text-sm leading-relaxed text-text-secondary">{copy.body}</p>

        <div class="mt-3 flex items-center gap-2">
          <button
            type="button"
            on:click={() => void install()}
            class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            {copy.install}
          </button>
          <button
            type="button"
            on:click={dismiss}
            class="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-level-1 hover:text-text"
          >
            {copy.later}
          </button>
        </div>
      </div>
    </div>
  </aside>
{/if}

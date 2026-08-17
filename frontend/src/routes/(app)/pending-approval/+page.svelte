<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { getMyAccountState, signOut } from '$lib/auth'
  import type { AccountState } from '$lib/types'
  import { language } from '$lib/stores/ui'
  import AuthShell from '$lib/components/AuthShell.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'

  let state: AccountState | null = null
  let loading = true
  let error = ''

  $: copy = $language === 'ar'
    ? {
        title: 'حالة الحساب', loadError: 'تعذر تحميل حالة الحساب', retry: 'حاول مرة أخرى', help: 'المساعدة', signOut: 'تسجيل الخروج',
        restrictedLabel: 'الحساب مقيد', restrictedTitle: 'الوصول الرياضي متوقف مؤقتاً', restrictedBody: 'يمكنك حماية حسابك وطلب مراجعة. إنشاء حساب آخر لن يزيل هذا التقييد.', reason: 'السبب', reviewRequired: 'مراجعة الحساب مطلوبة', requestReview: 'طلب مراجعة', security: 'الحساب والأمان',
        conflictLabel: 'تأكيد الهوية مطلوب', conflictTitle: 'نحتاج لتأكيد ملكية الحساب', conflictBody: 'لا تغيّر رقم الطالب ولا تنشئ حساباً جديداً. الدعم يمكنه حل المشكلة بأمان.', contactSupport: 'تواصل مع الدعم', verificationStatus: 'حالة التحقق',
        actionLabel: 'إجراء مطلوب', rejectedTitle: 'التحقق يحتاج تصحيحاً', rejectedBody: 'احتفظ بنفس الحساب. صحح فقط المعلومة أو البطاقة المرفوضة ثم أرسلها من جديد.', fixVerification: 'تصحيح التحقق',
        oneStep: 'خطوة واحدة متبقية', requiredTitle: 'أكد هويتك الطلابية', requiredBody: 'الحسابات بالبريد الشخصي تحتاج موافقة بطاقة الطالب قبل الحجز أو الانضمام للمباريات.', startVerification: 'ابدأ التحقق',
        reviewLabel: 'قيد المراجعة', pendingTitle: 'بطاقة الطالب قيد المراجعة', pendingBody: 'لا تحتاج لأي إجراء الآن. سيحصل نفس الحساب على الوصول بعد الموافقة.', viewSubmission: 'عرض الطلب', contactHelp: 'التواصل مع الدعم'
      }
    : {
        title: 'Account status', loadError: 'Couldn’t load your account', retry: 'Try again', help: 'Help', signOut: 'Sign out',
        restrictedLabel: 'Account restricted', restrictedTitle: 'Sports access is temporarily unavailable', restrictedBody: 'You can still secure your account and request a review. Creating another account will not remove this restriction.', reason: 'Reason', reviewRequired: 'Account review required', requestReview: 'Request review', security: 'Account & security',
        conflictLabel: 'Identity review needed', conflictTitle: 'We need to confirm account ownership', conflictBody: 'Don’t change Student ID or create another account. Support can resolve ownership safely.', contactSupport: 'Contact support', verificationStatus: 'Verification status',
        actionLabel: 'Action needed', rejectedTitle: 'Your verification needs a correction', rejectedBody: 'Keep this account. Fix only the rejected information or card and submit again.', fixVerification: 'Fix verification',
        oneStep: 'One step left', requiredTitle: 'Verify your student identity', requiredBody: 'Personal-email accounts need student-card approval before booking or joining matches.', startVerification: 'Start verification',
        reviewLabel: 'Under review', pendingTitle: 'Your student card is being reviewed', pendingBody: 'No action is needed right now. This same account will receive access after approval.', viewSubmission: 'View submission', contactHelp: 'Contact support'
      }

  onMount(async () => {
    try {
      state = await getMyAccountState()
      if (!state) {
        await goto('/login')
        return
      }
      if (state.can_use_sports && state.access_status === 'approved') await goto('/home')
    } catch (e: any) {
      error = e.message || copy.loadError
    } finally {
      loading = false
    }
  })

  async function logout() {
    await signOut()
    await goto('/login')
  }
</script>

<svelte:head><title>{copy.title} · UNEEM</title></svelte:head>

<AuthShell maxWidth="max-w-lg">
  {#if loading}
    <section class="space-y-3" aria-busy="true">
      <div class="h-52 animate-pulse rounded-3xl bg-surface-level-1"></div>
      <div class="h-12 animate-pulse rounded-2xl bg-surface-level-1"></div>
    </section>
  {:else if error}
    <section class="w-full">
      <div class="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-danger-light text-danger"><Icon name="alert-triangle" size={20} /></div>
      <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text">{copy.loadError}</h1>
      <p class="mt-2 text-sm leading-6 text-text-secondary">{error}</p>
      <div class="mt-6 space-y-3">
        <Button on:click={() => location.reload()} variant="primary" size="lg" className="w-full">{copy.retry}</Button>
        <ActionLink href="/help" variant="secondary" size="lg" icon="info" className="w-full">{copy.help}</ActionLink>
      </div>
    </section>
  {:else if state}
    <section class="w-full">
      {#if state.access_status === 'suspended'}
        <div class="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-danger-light text-danger"><Icon name="shield" size={20} /></div>
        <p class="text-sm font-semibold text-danger">{copy.restrictedLabel}</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-[-0.035em] text-text">{copy.restrictedTitle}</h1>
        <p class="mt-3 text-sm leading-6 text-text-secondary">{copy.restrictedBody}</p>
        <div class="mt-5 rounded-2xl bg-surface-level-1 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">{copy.reason}</p>
          <p class="mt-1 text-sm font-medium text-text">{state.restriction_reason?.replaceAll('_', ' ') || copy.reviewRequired}</p>
        </div>
        <div class="mt-6 space-y-3">
          <ActionLink href="/help" variant="primary" size="lg" icon="shield" className="w-full">{copy.requestReview}</ActionLink>
          <ActionLink href="/profile" variant="secondary" size="lg" icon="user" className="w-full">{copy.security}</ActionLink>
        </div>
      {:else if state.identity_status === 'conflict'}
        <div class="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-warning-light text-warning"><Icon name="shield" size={20} /></div>
        <p class="text-sm font-semibold text-warning">{copy.conflictLabel}</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-[-0.035em] text-text">{copy.conflictTitle}</h1>
        <p class="mt-3 text-sm leading-6 text-text-secondary">{copy.conflictBody}</p>
        <div class="mt-6 space-y-3">
          <ActionLink href="/help" variant="primary" size="lg" icon="info" className="w-full">{copy.contactSupport}</ActionLink>
          <ActionLink href="/verification" variant="secondary" size="lg" icon="shield" className="w-full">{copy.verificationStatus}</ActionLink>
        </div>
      {:else if state.identity_status === 'rejected'}
        <div class="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-warning-light text-warning"><Icon name="pencil" size={20} /></div>
        <p class="text-sm font-semibold text-warning">{copy.actionLabel}</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-[-0.035em] text-text">{copy.rejectedTitle}</h1>
        <p class="mt-3 text-sm leading-6 text-text-secondary">{copy.rejectedBody}</p>
        <div class="mt-6 space-y-3">
          <ActionLink href="/verification" variant="primary" size="lg" icon="shield" className="w-full">{copy.fixVerification}</ActionLink>
          <ActionLink href="/help" variant="secondary" size="lg" icon="info" className="w-full">{copy.help}</ActionLink>
        </div>
      {:else if state.identity_status === 'required'}
        <div class="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary-light text-primary"><Icon name="shield" size={20} /></div>
        <p class="text-sm font-semibold text-primary">{copy.oneStep}</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-[-0.035em] text-text">{copy.requiredTitle}</h1>
        <p class="mt-3 text-sm leading-6 text-text-secondary">{copy.requiredBody}</p>
        <div class="mt-6 space-y-3">
          <ActionLink href="/verification" variant="primary" size="lg" icon="shield" className="w-full">{copy.startVerification}</ActionLink>
          <ActionLink href="/help" variant="secondary" size="lg" icon="info" className="w-full">{copy.help}</ActionLink>
        </div>
      {:else}
        <div class="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-warning-light text-warning"><Icon name="clock" size={20} /></div>
        <p class="text-sm font-semibold text-warning">{copy.reviewLabel}</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-[-0.035em] text-text">{copy.pendingTitle}</h1>
        <p class="mt-3 text-sm leading-6 text-text-secondary">{copy.pendingBody}</p>
        <div class="mt-6 grid grid-cols-2 gap-3">
          <ActionLink href="/verification" variant="secondary" size="md" icon="shield">{copy.viewSubmission}</ActionLink>
          <ActionLink href="/help" variant="secondary" size="md" icon="info">{copy.contactHelp}</ActionLink>
        </div>
      {/if}

      <Button on:click={logout} variant="ghost" size="md" className="mt-4 w-full text-text-secondary">
        <Icon name="log-out" size={17} /> {copy.signOut}
      </Button>
    </section>
  {/if}
</AuthShell>

<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { getMyAccountState } from '$lib/auth'
  import {
    getLatestVerificationAttempt,
    identityErrorCode,
    uploadAndSubmitStudentCard,
    validateStudentCard,
    type IdentityFailureCode,
    type VerificationAttempt,
    type VerificationReason
  } from '$lib/identityApi'
  import type { AccountState } from '$lib/types'
  import { language } from '$lib/stores/ui'
  import { isValidStudentId } from '$lib/utils/cn'
  import { sanitizeStudentId } from '$lib/validation'
  import AuthShell from '$lib/components/AuthShell.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'

  type FieldState = 'idle' | 'valid' | 'invalid'

  let state: AccountState | null = null
  let attempt: VerificationAttempt | null = null
  let studentId = ''
  let card: File | null = null
  let previewUrl = ''
  let loading = true
  let submitting = false
  let error = ''
  let submitAttempted = false
  let fileError = ''

  $: copy = $language === 'ar'
    ? {
        pageTitle: 'التحقق من الطالب', back: 'حالة الحساب', loadError: 'تعذر تحميل حالة التحقق. حاول مجدداً.',
        verifiedTitle: 'تم تأكيد هويتك', verifiedBody: 'رقم الطالب مرتبط الآن بهذا الحساب.',
        pendingTitle: 'المراجعة جارية', pendingBody: 'تم إرسال بطاقتك. لا ترسلها مرة أخرى إلا إذا طلبنا تصحيحاً.',
        conflictTitle: 'نحتاج لتأكيد الملكية', conflictBody: 'لا تنشئ حساباً آخر ولا تغيّر رقم الطالب. استخدم المساعدة لحل المشكلة بأمان.',
        requiredTitle: 'أكد هويتك الطلابية', requiredBody: 'أرسل رقم الطالب وصورة واضحة من بطاقتك الجامعية.',
        studentId: 'رقم الطالب', studentIdPlaceholder: 'S123456789', studentIdValid: 'الصيغة صحيحة · الملكية تُراجع مع البطاقة', studentIdInvalid: 'استخدم حرفاً واحداً + 9 أرقام فقط.',
        card: 'صورة بطاقة الطالب', addCard: 'أضف صورة واضحة للبطاقة', replaceCard: 'اختيار صورة أخرى', cardHint: 'JPG أو PNG أو WebP · أقل من 5 MB', cardReady: 'الصورة جاهزة', cardRequired: 'اختر صورة البطاقة.', invalidType: 'استخدم JPG أو PNG أو WebP.', tooLarge: 'يجب أن تكون الصورة أقل من 5 MB.', invalidImage: 'اختر صورة صالحة.',
        submittedId: 'رقم الطالب المرسل', pending: 'قيد المراجعة', noResubmit: 'لا تحتاج لإعادة الإرسال الآن.',
        submit: 'إرسال للمراجعة', resubmit: 'إعادة الإرسال للمراجعة', submitting: 'جاري الإرسال…',
        profile: 'العودة للملف الشخصي', accountHelp: 'مساعدة الحساب', help: 'المساعدة', accountStatus: 'حالة الحساب', private: 'بطاقتك خاصة ولا تظهر إلا للمراجعين المصرح لهم.',
        sessionRequired: 'انتهت جلسة تسجيل الدخول. سجّل الدخول من جديد ثم أعد المحاولة.',
        claimUnavailable: 'رقم الطالب مرتبط بهوية مؤكدة أخرى. لا تنشئ حساباً جديداً؛ استخدم المساعدة لتأكيد الملكية.',
        uploadFailed: 'تعذر رفع صورة البطاقة. اختر الصورة من جديد وحاول مرة أخرى.',
        networkError: 'تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مجدداً.',
        submitFailed: 'تعذر إرسال طلب التحقق الآن. حاول مجدداً بعد قليل.',
        reasonStudentIdTitle: 'تحقق من رقم الطالب', reasonStudentIdBody: 'رقم الطالب لا يطابق البطاقة. صححه وأرسل البطاقة من جديد.',
        reasonCardTitle: 'استخدم صورة أوضح', reasonCardBody: 'تعذر قراءة البطاقة بوضوح. احتفظ برقم الطالب وغيّر الصورة فقط.',
        reasonNameTitle: 'بياناتك تحتاج مراجعة', reasonNameBody: 'الاسم في الحساب لا يطابق البطاقة. حدّث البيانات المسموح بها ثم أعد الإرسال.',
        reasonDuplicateTitle: 'نحتاج لتأكيد الملكية', reasonDuplicateBody: 'تعذر تأكيد الهوية بأمان. لا تنشئ حساباً جديداً وتواصل مع المساعدة.',
        reasonNotCardTitle: 'استخدم بطاقة الطالب الجامعية', reasonNotCardBody: 'الصورة المرسلة لم تُقبل كبطاقة طالب. استبدلها بصورة واضحة من بطاقتك.',
        reasonExpiredTitle: 'استخدم بطاقة حالية', reasonExpiredBody: 'البطاقة لم تؤكد وضعك الطلابي الحالي. ارفع بطاقة حالية أو تواصل مع المساعدة.'
      }
    : {
        pageTitle: 'Student verification', back: 'Account status', loadError: 'Couldn’t load verification status. Try again.',
        verifiedTitle: 'Identity verified', verifiedBody: 'Your Student ID is now linked to this account.',
        pendingTitle: 'Review in progress', pendingBody: 'Your card was submitted. Don’t submit again unless we ask for a correction.',
        conflictTitle: 'We need to verify ownership', conflictBody: 'Don’t create another account or change Student ID. Use Help so ownership can be resolved safely.',
        requiredTitle: 'Verify your student identity', requiredBody: 'Submit your Student ID and a clear photo of your university card.',
        studentId: 'Student ID', studentIdPlaceholder: 'S123456789', studentIdValid: 'Format valid · ownership is checked with your card', studentIdInvalid: 'Use exactly 1 letter + 9 digits.',
        card: 'Student card photo', addCard: 'Add a clear card photo', replaceCard: 'Choose a different photo', cardHint: 'JPG, PNG or WebP · under 5 MB', cardReady: 'Photo ready', cardRequired: 'Choose your student card photo.', invalidType: 'Use a JPG, PNG, or WebP image.', tooLarge: 'The image must be smaller than 5 MB.', invalidImage: 'Choose a valid image.',
        submittedId: 'Submitted Student ID', pending: 'Pending', noResubmit: 'You don’t need to submit again right now.',
        submit: 'Submit for review', resubmit: 'Resubmit for review', submitting: 'Submitting…',
        profile: 'Back to profile', accountHelp: 'Account help', help: 'Help', accountStatus: 'Account status', private: 'Your card is private and visible only to authorized reviewers.',
        sessionRequired: 'Your sign-in session expired. Sign in again, then retry verification.',
        claimUnavailable: 'That Student ID is linked to another verified identity. Don’t create another account; use Help to resolve ownership.',
        uploadFailed: 'We couldn’t upload the card photo. Choose the image again and retry.',
        networkError: 'UNEEM can’t reach the service. Check your connection and try again.',
        submitFailed: 'We couldn’t submit verification right now. Try again in a moment.',
        reasonStudentIdTitle: 'Check your Student ID', reasonStudentIdBody: 'The Student ID did not match the card. Correct it and submit the card again.',
        reasonCardTitle: 'Upload a clearer card photo', reasonCardBody: 'The card could not be read clearly. Keep your Student ID and replace only the photo.',
        reasonNameTitle: 'Your details need attention', reasonNameBody: 'The name on the account and student card did not match. Update permitted profile details, then resubmit.',
        reasonDuplicateTitle: 'We need to verify ownership', reasonDuplicateBody: 'We could not safely confirm this identity. Do not create another account. Contact Help.',
        reasonNotCardTitle: 'Upload your university student card', reasonNotCardBody: 'The submitted image was not accepted as a student card. Replace it with a clear photo of your card.',
        reasonExpiredTitle: 'Use a current student card', reasonExpiredBody: 'The submitted card could not confirm current student status. Upload a current card or contact Help.'
      }

  $: reasonCopy = {
    student_id_incorrect: { title: copy.reasonStudentIdTitle, body: copy.reasonStudentIdBody, editId: true },
    student_card_unreadable: { title: copy.reasonCardTitle, body: copy.reasonCardBody, editId: false },
    name_mismatch: { title: copy.reasonNameTitle, body: copy.reasonNameBody, editId: false },
    duplicate_student_identity: { title: copy.reasonDuplicateTitle, body: copy.reasonDuplicateBody, editId: false },
    not_a_student_card: { title: copy.reasonNotCardTitle, body: copy.reasonNotCardBody, editId: false },
    student_card_expired: { title: copy.reasonExpiredTitle, body: copy.reasonExpiredBody, editId: false }
  } as Record<VerificationReason, { title: string; body: string; editId: boolean }>

  $: rejectedReason = state?.restriction_reason as VerificationReason | null
  $: remediation = rejectedReason ? reasonCopy[rejectedReason] : null
  $: normalizedStudentId = sanitizeStudentId(studentId)
  $: studentIdValid = isValidStudentId(normalizedStudentId)
  $: studentIdState = fieldState(studentId.length > 0 || submitAttempted, studentIdValid)
  $: fileState = fieldState(!!card || !!fileError || submitAttempted, !!card && !fileError)
  $: backHref = state?.identity_status === 'verified' ? '/profile' : '/pending-approval'

  onMount(load)

  function fieldState(active: boolean, valid: boolean): FieldState {
    if (!active) return 'idle'
    return valid ? 'valid' : 'invalid'
  }

  function verificationMessage(code: IdentityFailureCode): string {
    if (code === 'session_required') return copy.sessionRequired
    if (code === 'invalid_student_id') return copy.studentIdInvalid
    if (code === 'identity_claim_unavailable') return copy.claimUnavailable
    if (code === 'upload_failed') return copy.uploadFailed
    if (code === 'network') return copy.networkError
    if (code === 'status_load_failed') return copy.loadError
    return copy.submitFailed
  }

  async function load() {
    loading = true
    error = ''
    try {
      const [account, latest] = await Promise.all([getMyAccountState(), getLatestVerificationAttempt()])
      if (!account) {
        await goto('/login')
        return
      }
      state = account
      attempt = latest
      studentId = sanitizeStudentId(account.student_id || latest?.claimed_student_id || '')
    } catch {
      error = copy.loadError
    } finally {
      loading = false
    }
  }

  function localFileMessage(code: string) {
    if (code === 'invalid_type') return copy.invalidType
    if (code === 'too_large') return copy.tooLarge
    return copy.invalidImage
  }

  function chooseCard(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const next = input.files?.[0] || null
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    previewUrl = ''
    card = null
    fileError = ''
    error = ''

    if (!next) return
    const validationError = validateStudentCard(next)
    if (validationError) {
      fileError = localFileMessage(validationError)
      input.value = ''
      return
    }

    card = next
    previewUrl = URL.createObjectURL(next)
  }

  async function submit() {
    submitAttempted = true
    error = ''
    studentId = normalizedStudentId
    if (!studentIdValid) return
    if (!card) {
      fileError = copy.cardRequired
      return
    }
    if (fileError || state?.identity_status === 'conflict') return

    submitting = true
    try {
      state = await uploadAndSubmitStudentCard(normalizedStudentId, card)
      attempt = await getLatestVerificationAttempt()
      card = null
      fileError = ''
      submitAttempted = false
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      previewUrl = ''
    } catch (caught) {
      const code = identityErrorCode(caught)
      error = verificationMessage(code)
      if (code === 'session_required') {
        await goto('/login')
      }
    } finally {
      submitting = false
    }
  }
</script>

<svelte:head><title>{copy.pageTitle} · UNEEM</title></svelte:head>

<AuthShell backHref={backHref} backLabel={copy.back} maxWidth="max-w-xl">
  {#if loading}
    <div class="space-y-3" aria-busy="true">
      <div class="h-28 animate-pulse rounded-2xl bg-surface-level-1"></div>
      <div class="h-64 animate-pulse rounded-2xl bg-surface-level-1"></div>
    </div>
  {:else if error && !state}
    <section>
      <div class="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-danger-light text-danger"><Icon name="alert-triangle" size={20} /></div>
      <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text">{copy.loadError}</h1>
      <div class="mt-6 grid grid-cols-2 gap-3">
        <ActionLink href="/pending-approval" variant="secondary" size="md" icon="arrow-left">{copy.accountStatus}</ActionLink>
        <ActionLink href="/help" variant="secondary" size="md" icon="info">{copy.help}</ActionLink>
      </div>
    </section>
  {:else if state}
    <section class="w-full">
      <div class="mb-6">
        <div class={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${state.identity_status === 'verified' ? 'bg-success-light text-success' : state.identity_status === 'conflict' ? 'bg-warning-light text-warning' : 'bg-primary-light text-primary'}`}>
          <Icon name={state.identity_status === 'verified' ? 'check' : state.identity_status === 'pending' ? 'clock' : 'shield'} size={20} />
        </div>
        {#if state.identity_status === 'verified'}
          <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text">{copy.verifiedTitle}</h1>
          <p class="mt-2 text-sm leading-6 text-text-secondary">{copy.verifiedBody}</p>
        {:else if state.identity_status === 'pending'}
          <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text">{copy.pendingTitle}</h1>
          <p class="mt-2 text-sm leading-6 text-text-secondary">{copy.pendingBody}</p>
        {:else if state.identity_status === 'conflict'}
          <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text">{copy.conflictTitle}</h1>
          <p class="mt-2 text-sm leading-6 text-text-secondary">{copy.conflictBody}</p>
        {:else if remediation}
          <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text">{remediation.title}</h1>
          <p class="mt-2 text-sm leading-6 text-text-secondary">{remediation.body}</p>
        {:else}
          <h1 class="text-3xl font-semibold tracking-[-0.035em] text-text">{copy.requiredTitle}</h1>
          <p class="mt-2 text-sm leading-6 text-text-secondary">{copy.requiredBody}</p>
        {/if}
      </div>

      {#if state.identity_status === 'verified'}
        <div class="space-y-3">
          <ActionLink href="/profile" variant="primary" size="lg" icon="user" className="w-full">{copy.profile}</ActionLink>
          <ActionLink href="/help" variant="secondary" size="lg" icon="info" className="w-full">{copy.help}</ActionLink>
        </div>
      {:else if state.identity_status === 'pending'}
        <div class="rounded-2xl bg-surface-level-1 p-4">
          <p class="text-xs font-medium text-text-muted">{copy.submittedId}</p>
          <div class="mt-1 flex items-center justify-between gap-3"><p class="font-semibold tracking-wide text-text">{attempt?.claimed_student_id || state.student_id}</p><span class="rounded-full bg-warning-light px-3 py-1 text-xs font-semibold text-warning">{copy.pending}</span></div>
          <p class="mt-3 text-sm leading-6 text-text-secondary">{copy.noResubmit}</p>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <ActionLink href="/pending-approval" variant="secondary" size="md" icon="arrow-left">{copy.accountStatus}</ActionLink>
          <ActionLink href="/help" variant="secondary" size="md" icon="info">{copy.help}</ActionLink>
        </div>
      {:else if state.identity_status === 'conflict'}
        <div class="space-y-3">
          <ActionLink href="/help" variant="primary" size="lg" icon="info" className="w-full">{copy.accountHelp}</ActionLink>
          <ActionLink href="/pending-approval" variant="secondary" size="lg" icon="arrow-left" className="w-full">{copy.accountStatus}</ActionLink>
        </div>
      {:else}
        <div class="space-y-4">
          <TextField label={copy.studentId} placeholder={copy.studentIdPlaceholder} icon="id-card" autocapitalize="characters" spellcheck={false} maxlength={20} bind:value={studentId} validation={studentIdState} hint={studentIdState === 'invalid' ? copy.studentIdInvalid : ''} validHint={copy.studentIdValid} disabled={state.identity_status === 'rejected' && !!remediation && !remediation.editId} />

          <div>
            <span class="mb-1.5 block text-sm font-semibold text-text">{copy.card}</span>
            <label class={`block cursor-pointer rounded-2xl border p-4 transition-colors ${fileState === 'invalid' ? 'border-danger bg-danger-light/20' : fileState === 'valid' ? 'border-success/70 bg-success-light/20' : 'border-border bg-surface hover:bg-surface-level-1'}`}>
              <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" on:change={chooseCard} />
              {#if previewUrl}
                <img src={previewUrl} alt="Student card preview" class="mb-3 max-h-56 w-full rounded-xl object-contain" />
                <div class="flex items-center justify-center gap-2 text-sm font-semibold text-primary"><Icon name="camera" size={17} />{copy.replaceCard}</div>
              {:else}
                <div class="flex min-h-[120px] flex-col items-center justify-center text-center">
                  <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary"><Icon name="camera" size={19} /></div>
                  <p class="font-semibold text-text">{copy.addCard}</p>
                  <p class="mt-1 text-xs text-text-muted">{copy.cardHint}</p>
                </div>
              {/if}
            </label>
            <div class={`mt-1.5 flex min-h-5 items-center gap-1.5 px-1 text-xs font-medium ${fileState === 'valid' ? 'text-success' : fileState === 'invalid' ? 'text-danger' : 'text-text-muted'}`} aria-live="polite">
              {#if fileState !== 'idle'}<Icon name={fileState === 'valid' ? 'check' : 'x'} size={13} />{/if}
              <span>{fileState === 'valid' ? copy.cardReady : fileError}</span>
            </div>
          </div>

          {#if error}<div class="rounded-2xl border border-danger/15 bg-danger-light p-4 text-sm font-medium leading-6 text-danger" role="alert">{error}</div>{/if}

          <Button on:click={submit} variant="primary" size="lg" loading={submitting} disabled={submitting} className="w-full">{submitting ? copy.submitting : state.identity_status === 'rejected' ? copy.resubmit : copy.submit}</Button>
          <p class="text-center text-xs leading-5 text-text-muted">{copy.private}</p>

          <div class="grid grid-cols-2 gap-3 pt-1">
            <ActionLink href="/pending-approval" variant="secondary" size="md" icon="arrow-left">{copy.accountStatus}</ActionLink>
            <ActionLink href="/help" variant="secondary" size="md" icon="info">{copy.help}</ActionLink>
          </div>
        </div>
      {/if}
    </section>
  {/if}
</AuthShell>

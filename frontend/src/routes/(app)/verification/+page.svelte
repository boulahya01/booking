<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { getMyAccountState } from '$lib/auth'
  import { authState } from '$lib/stores/auth'
  import { language, uiState } from '$lib/stores/ui'
  import { identityErrorCode, uploadAndSubmitStudentCard, updateMyStudentId, validateStudentCard } from '$lib/identityApi'
  import type { AccountState } from '$lib/types'
  import { isValidStudentId } from '$lib/utils/cn'
  import { sanitizeStudentId } from '$lib/validation'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'

  let state: AccountState | null = null
  let studentId = ''
  let card: File | null = null
  let previewUrl = ''
  let loading = true
  let busy = false
  let error = ''
  let fileError = ''
  let attempted = false
  let disposed = false

  $: ar = $language === 'ar'
  $: copy = ar ? {
    page: 'التحقق من الطالب', back: 'حسابي', title: 'أكد هويتك الطلابية', subtitle: 'مطلوب لجميع الطلاب قبل الحجز أو الانضمام.',
    pending: 'هويتك قيد المراجعة', pendingBody: 'يمكنك تصحيح رقم الطالب أثناء مراجعة البطاقة.',
    verified: 'تم تأكيد هويتك', verifiedBody: 'رقم الطالب مرتبط بحسابك. يمكنك الآن الحجز والانضمام.',
    id: 'رقم الطالب', invalidId: 'استخدم S متبوعاً بأرقام، مثل S123.', save: 'حفظ رقم الطالب', saved: 'تم تحديث رقم الطالب',
    card: 'بطاقة الطالب', addPhoto: 'أضف صورة البطاقة', replacePhoto: 'استبدال صورة البطاقة', photoHint: 'JPG أو PNG أو WebP · حتى 5 MB',
    private: 'الصورة خاصة ولا تظهر إلا للمراجعين.', submit: 'إرسال للمراجعة', resubmit: 'تحديث البطاقة', sent: 'تم إرسال البطاقة للمراجعة',
    retry: 'إعادة المحاولة', loadError: 'تعذر تحميل حالة التحقق.', failure: 'تعذر حفظ التغيير. حاول مجدداً.', required: 'اختر صورة البطاقة.',
    badType: 'اختر صورة JPG أو PNG أو WebP.', tooLarge: 'استخدم صورة أصغر من 5 MB.', invalidImage: 'اختر صورة صالحة.',
    duplicate: 'هذا الرقم مرتبط بحساب موثّق آخر. صحح الرقم أو تواصل مع الدعم.', rejected: 'تحتاج بطاقتك إلى تصحيح.',
    locked: 'تمت الموافقة على هويتك. لا يمكن تغيير الرقم الآن.', browse: 'استكشاف الملاعب', help: 'المساعدة', suspended: 'الحساب مقيد. تواصل مع الدعم.'
  } : {
    page: 'Student verification', back: 'Profile', title: 'Verify your student ID', subtitle: 'Required for everyone before booking or joining.',
    pending: 'ID under review', pendingBody: 'You can correct your Student ID while we review your card.',
    verified: 'Identity verified', verifiedBody: 'Your ID is linked to this account. You can book and join matches.',
    id: 'Student ID', invalidId: 'Use S followed by numbers, for example S123.', save: 'Save Student ID', saved: 'Student ID updated',
    card: 'Student card', addPhoto: 'Add card photo', replacePhoto: 'Replace card photo', photoHint: 'JPG, PNG or WebP · up to 5 MB',
    private: 'Your photo is visible only to authorized reviewers.', submit: 'Submit for review', resubmit: 'Update card', sent: 'Card submitted for review',
    retry: 'Retry', loadError: 'Couldn’t load verification status.', failure: 'Couldn’t save this change. Try again.', required: 'Choose a card photo.',
    badType: 'Choose a JPG, PNG or WebP image.', tooLarge: 'Use an image smaller than 5 MB.', invalidImage: 'Choose a valid image.',
    duplicate: 'This ID belongs to another verified account. Correct a typo or contact Help.', rejected: 'Your card needs a correction.',
    locked: 'Your ID was approved and can no longer be edited.', browse: 'Explore facilities', help: 'Help', suspended: 'Your account is restricted. Contact Help.'
  }
  $: normalizedId = sanitizeStudentId(studentId)
  $: validId = isValidStudentId(normalizedId)
  $: dirtyId = normalizedId !== (state?.student_id || '')
  $: pending = state?.identity_status === 'pending'
  $: verified = state?.identity_status === 'verified'
  $: restricted = state?.access_status === 'suspended'
  $: reason = state?.restriction_reason
  $: rejectionText = reason === 'student_id_incorrect' ? (ar ? 'رقم الطالب لا يطابق البطاقة.' : 'The Student ID does not match the card.')
    : reason === 'student_card_unreadable' ? (ar ? 'الصورة غير واضحة. أرسل صورة أوضح.' : 'The photo is unreadable. Upload a clearer one.')
    : reason === 'name_mismatch' ? (ar ? 'الاسم لا يطابق البطاقة. تواصل مع الدعم.' : 'Your name does not match the card. Contact Help.')
    : reason === 'student_card_expired' ? (ar ? 'أرسل صورة بطاقة طالب سارية.' : 'Upload a current student card.')
    : reason === 'not_a_student_card' ? (ar ? 'أرسل صورة بطاقتك الجامعية.' : 'Upload your university student card.')
    : reason === 'duplicate_student_identity' ? copy.duplicate : copy.rejected

  async function load() {
    loading = !state
    error = ''
    try {
      const account = await getMyAccountState()
      if (disposed) return
      if (!account) { await goto('/login'); return }
      state = account
      authState.setAccount(account)
      studentId = account.student_id || ''
    } catch { if (!disposed) error = copy.loadError }
    finally { if (!disposed) loading = false }
  }

  function chooseCard(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const next = input.files?.[0] || null
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    previewUrl = ''
    card = null
    fileError = ''
    if (!next) return
    const problem = validateStudentCard(next)
    if (problem) {
      fileError = problem === 'too_large' ? copy.tooLarge : problem === 'invalid_type' ? copy.badType : copy.invalidImage
      input.value = ''
      return
    }
    card = next
    previewUrl = URL.createObjectURL(next)
  }

  async function save(withCard: boolean) {
    if (busy || verified || restricted) return
    attempted = true
    error = ''
    if (!validId) return
    if (withCard && !card) { fileError = copy.required; return }
    busy = true
    try {
      state = withCard ? await uploadAndSubmitStudentCard(normalizedId, card!) : await updateMyStudentId(normalizedId)
      if (disposed) return
      studentId = state.student_id || normalizedId
      attempted = false
      if (withCard) {
        card = null
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        previewUrl = ''
      }
      if (state.identity_status === 'conflict') error = copy.duplicate
      else uiState.addToast(withCard ? copy.sent : copy.saved, 'success')
    } catch (caught) {
      const code = identityErrorCode(caught)
      if (code === 'identity_already_verified') { await load(); error = copy.locked }
      else if (code === 'invalid_student_id') error = copy.invalidId
      else if (code === 'identity_claim_unavailable') error = copy.duplicate
      else if (code === 'session_required') { await goto('/login'); return }
      else error = copy.failure
    } finally { busy = false }
  }

  onMount(() => {
    void load()
    const refresh = () => { if (!document.hidden && !busy && !dirtyId && !card && pending) void load() }
    const timer = setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    return () => {
      disposed = true
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  })
</script>

<svelte:head><title>{copy.page} · UNEEM</title></svelte:head>

<main class="uneem-page-narrow verification-page">
  <a href="/profile" class="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-text-secondary"><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={18} />{copy.back}</a>
  {#if loading}
    <div class="space-y-4" aria-busy="true"><div class="h-24 animate-pulse rounded-2xl bg-surface-level-1"></div><div class="h-64 animate-pulse rounded-2xl bg-surface-level-1"></div></div>
  {:else if !state}
    <h1 class="uneem-title">{copy.loadError}</h1>
    <Button className="mt-6" on:click={load}>{copy.retry}</Button>
  {:else}
    <header class="mb-7">
      <div class={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${verified ? 'bg-success-light text-success' : 'bg-primary-light text-primary'}`}><Icon name={verified ? 'check' : pending ? 'clock' : 'id-card'} size={24} /></div>
      <h1 class="uneem-title">{verified ? copy.verified : pending ? copy.pending : copy.title}</h1>
      <p class="mt-2 text-sm leading-6 text-text-secondary">{verified ? copy.verifiedBody : pending ? copy.pendingBody : copy.subtitle}</p>
    </header>

    {#if error}<p class="mb-5 rounded-2xl bg-danger-light p-4 text-sm text-danger" role="alert">{error}</p>{/if}
    {#if restricted}
      <p class="mb-5 text-sm text-danger">{copy.suspended}</p>
      <ActionLink href="/help" fullWidth size="lg">{copy.help}</ActionLink>
    {:else if verified}
      <div class="mb-6 rounded-2xl bg-surface p-5"><p class="text-xs font-medium text-text-muted">{copy.id}</p><p class="mt-1 text-xl font-semibold" dir="ltr">{state.student_id}</p></div>
      <ActionLink href="/home" fullWidth size="lg">{copy.browse}</ActionLink>
    {:else}
      {#if state.identity_status === 'rejected' || state.identity_status === 'conflict'}<p class="mb-5 rounded-2xl bg-warning-light p-4 text-sm leading-6 text-text">{rejectionText}</p>{/if}
      <form on:submit|preventDefault={() => save(false)} class="space-y-3">
        <TextField label={copy.id} placeholder="S123" autocapitalize="characters" spellcheck={false} maxlength={50} bind:value={studentId} error={attempted && !validId ? copy.invalidId : ''} disabled={busy} />
        {#if dirtyId && normalizedId}<Button type="submit" variant="secondary" fullWidth disabled={busy} loading={busy}>{copy.save}</Button>{/if}
      </form>
      <section class="mt-6" aria-labelledby="card-heading">
        <h2 id="card-heading" class="mb-3 text-sm font-semibold text-text">{copy.card}</h2>
        <label class="card-upload" class:has-photo={!!previewUrl} class:upload-disabled={busy}>
          <input type="file" accept="image/jpeg,image/png,image/webp" on:change={chooseCard} disabled={busy} aria-label={pending || card ? copy.replacePhoto : copy.addPhoto} />
          {#if previewUrl}<img src={previewUrl} alt={copy.card} class="mb-4 max-h-52 w-full rounded-xl object-contain" />{:else}<Icon name={pending ? 'circle-check' : 'camera'} size={28} className="mb-3 text-text-secondary" />{/if}
          <span class="text-sm font-semibold">{pending || card ? copy.replacePhoto : copy.addPhoto}</span>
          <span class="mt-1 text-xs leading-5 text-text-muted">{copy.photoHint}</span>
        </label>
        {#if fileError}<p class="mt-2 text-sm text-danger" role="alert">{fileError}</p>{/if}
        <p class="mt-3 flex items-start gap-2 text-xs leading-5 text-text-muted"><Icon name="lock" size={14} className="mt-0.5 shrink-0" />{copy.private}</p>
      </section>
      {#if !pending || card}<Button fullWidth size="lg" className="mt-6" loading={busy} disabled={busy} on:click={() => save(true)}>{pending ? copy.resubmit : copy.submit}</Button>{/if}
      <ActionLink href="/home" variant="secondary" fullWidth size="lg" className="mt-3">{copy.browse}</ActionLink>
      <div class="mt-4 text-center"><a href="/help" class="inline-flex min-h-11 items-center px-4 text-sm font-semibold text-primary">{copy.help}</a></div>
    {/if}
  {/if}
</main>

<style>
  .verification-page { max-width: 560px; }
  .card-upload { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 144px; padding: 24px; border-radius: 22px; background: var(--surface); text-align: center; cursor: pointer; }
  .card-upload:focus-within { outline: 3px solid var(--primary); outline-offset: 3px; }
  .card-upload input { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
  .upload-disabled { opacity: .6; }
</style>

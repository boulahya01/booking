<script lang="ts">
  import { onMount } from 'svelte'
  import { language, uiState } from '$lib/stores/ui'
  import {
    createVerificationEvidenceUrl,
    identityErrorCode,
    listVerificationQueue,
    reviewVerification,
    type VerificationQueueItem,
    type VerificationReason
  } from '$lib/identityApi'
  import Icon from '$lib/components/Icon.svelte'
  import Button from '$lib/components/Button.svelte'
  import Modal from '$lib/components/Modal.svelte'

  let queue: VerificationQueueItem[] = []
  let loading = true
  let error = ''
  let reviewingId = ''
  let evidenceUrl = ''
  let loadingEvidence = false
  let evidenceError = ''
  let reviewError = ''
  let selected: VerificationQueueItem | null = null
  let reason: VerificationReason = 'student_id_incorrect'

  $: ar = $language === 'ar'
  $: copy = ar ? {
    title:'التحقق من الطلبة', subtitle:'راجع البطاقة ورقم الطالب.', refresh:'تحديث', clear:'لا توجد طلبات', clearHint:'جميع الطلبات تمت مراجعتها.',
    studentId:'رقم الطالب', academic:'بريد جامعي', personal:'بريد شخصي', attempt:'محاولة', previous:'المشكلة السابقة', review:'مراجعة', private:'وثيقة خاصة. استخدمها فقط للتحقق.',
    rejectLabel:'سبب الرفض', reject:'رفض مع تصحيح', approve:'موافقة', saving:'جارٍ الحفظ…', loadError:'تعذر تحميل الطلبات.', cardError:'تعذر فتح البطاقة.', saveError:'تعذر حفظ القرار.', conflictError:'رقم الطالب مرتبط بالفعل بهوية موثقة أخرى. تم تسجيل الطلب كتعارض.'
  } : {
    title:'Student verification', subtitle:'Review the card and Student ID.', refresh:'Refresh', clear:'Queue is clear', clearHint:'No submissions are waiting.',
    studentId:'Student ID', academic:'Academic email', personal:'Personal email', attempt:'Attempt', previous:'Previous issue', review:'Review', private:'Private evidence. Use it only for verification.',
    rejectLabel:'Reason for rejection', reject:'Reject with fix', approve:'Approve', saving:'Saving…', loadError:'Couldn’t load the queue.', cardError:'Couldn’t open the card.', saveError:'Couldn’t save the review.', conflictError:'This Student ID already belongs to another verified identity. The submission was recorded as a conflict.'
  }

  const reasons: VerificationReason[] = [
    'student_id_incorrect','student_card_unreadable','name_mismatch','not_a_student_card','student_card_expired','duplicate_student_identity'
  ]

  onMount(load)

  function reasonLabel(value: VerificationReason) {
    if (ar) {
      if (value === 'student_id_incorrect') return 'رقم الطالب غير مطابق'
      if (value === 'student_card_unreadable') return 'الصورة غير واضحة'
      if (value === 'name_mismatch') return 'الاسم غير مطابق'
      if (value === 'not_a_student_card') return 'الصورة ليست بطاقة طالب'
      if (value === 'student_card_expired') return 'البطاقة لا تؤكد الوضع الحالي'
      return 'تعارض في ملكية الهوية'
    }
    if (value === 'student_id_incorrect') return 'Student ID does not match'
    if (value === 'student_card_unreadable') return 'Student card is unreadable'
    if (value === 'name_mismatch') return 'Name does not match'
    if (value === 'not_a_student_card') return 'Image is not a student card'
    if (value === 'student_card_expired') return 'Card cannot confirm current status'
    return 'Identity ownership conflict'
  }

  async function load() {
    loading = true
    error = ''
    try { queue = await listVerificationQueue() }
    catch { error = copy.loadError }
    finally { loading = false }
  }

  function closeReview() {
    if (reviewingId) return
    selected = null
    evidenceUrl = ''
    evidenceError = ''
    reviewError = ''
  }

  async function openAttempt(item: VerificationQueueItem) {
    selected = item
    evidenceUrl = ''
    evidenceError = ''
    reviewError = ''
    loadingEvidence = true
    reason = item.previous_reason_code || 'student_id_incorrect'
    try {
      const url = await createVerificationEvidenceUrl(item.card_storage_path)
      if (selected?.attempt_id === item.attempt_id) evidenceUrl = url
    } catch {
      if (selected?.attempt_id === item.attempt_id) evidenceError = copy.cardError
    } finally {
      if (selected?.attempt_id === item.attempt_id) loadingEvidence = false
    }
  }

  async function decide(decision: 'approved' | 'rejected') {
    if (!selected || reviewingId || loadingEvidence || !evidenceUrl) return
    reviewingId = selected.attempt_id
    reviewError = ''
    try {
      await reviewVerification(selected.attempt_id, decision, decision === 'rejected' ? reason : null)
      uiState.addToast(ar ? 'تم حفظ المراجعة' : 'Review saved', 'success')
      selected = null
      evidenceUrl = ''
      queue = queue.filter((item) => item.attempt_id !== reviewingId)
    } catch (cause) {
      if (identityErrorCode(cause) === 'identity_claim_unavailable') {
        selected = null
        evidenceUrl = ''
        queue = queue.filter((item) => item.attempt_id !== reviewingId)
        error = copy.conflictError
      } else {
        reviewError = copy.saveError
      }
    } finally { reviewingId = '' }
  }
</script>

<svelte:head><title>{copy.title} · UNEEM Admin</title></svelte:head>

<main class="uneem-page max-w-6xl">
  <header class="uneem-page-header flex-wrap">
    <div><h1 class="uneem-title">{copy.title}</h1><p class="uneem-subtitle">{copy.subtitle}</p></div>
    <Button variant="secondary" size="sm" loading={loading} on:click={load}><Icon name="refresh-cw" size={17}/>{copy.refresh}</Button>
  </header>

  {#if error}<div class="mb-4 rounded-2xl bg-danger-light px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</div>{/if}

  {#if loading}
    <div class="space-y-3" aria-busy="true">{#each Array(3) as _}<div class="h-20 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}</div>
  {:else if queue.length === 0 && !error}
    <section class="uneem-empty">
      <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-success-light text-success"><Icon name="check" size={22}/></div>
      <h2 class="mt-3 font-bold text-text">{copy.clear}</h2><p class="mt-1 text-sm text-text-muted">{copy.clearHint}</p>
    </section>
  {:else}
    <section class="uneem-panel px-4 sm:px-5">
      {#each queue as item (item.attempt_id)}
        <button on:click={() => openAttempt(item)} class="uneem-list-row min-h-24 w-full gap-4 !py-5 text-start transition-colors hover:bg-surface-level-1">
          <div class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-level-1 text-sm font-semibold text-text-secondary">{item.full_name?.charAt(0)?.toUpperCase() || '?'}</div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2"><h2 class="break-words text-base font-semibold text-text">{item.full_name}</h2><span class="rounded-full bg-surface-level-1 px-2 py-0.5 text-[10px] font-bold text-text-secondary">{item.email_kind === 'academic' ? copy.academic : copy.personal}</span>{#if Number(item.attempt_count)>1}<span class="rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-bold text-warning">{copy.attempt} {item.attempt_count}</span>{/if}</div>
            <p class="mt-2 text-sm leading-6 text-text-secondary">{copy.studentId}: <bdi class="font-semibold text-text">{item.claimed_student_id}</bdi>{#if item.previous_reason_code} · {copy.previous}: {reasonLabel(item.previous_reason_code)}{/if}</p>
          </div>
          <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} className="shrink-0 text-text-muted"/>
        </button>
      {/each}
    </section>
  {/if}
</main>

{#if selected}
  <Modal open title={copy.review} size="lg" closeDisabled={!!reviewingId} on:close={closeReview}>
    <h3 class="text-xl font-semibold text-text">{selected.full_name}</h3>
    <p class="mt-2 text-sm text-text-secondary">{copy.studentId}: <bdi class="font-semibold text-text">{selected.claimed_student_id}</bdi></p>
    <div class="mt-5 overflow-hidden rounded-2xl bg-surface-level-1">
      {#if loadingEvidence}
        <div class="h-56 animate-pulse" aria-busy="true" aria-label={ar ? 'جارٍ تحميل البطاقة' : 'Loading student card'}></div>
      {:else if evidenceError}
        <div class="p-6 text-center"><p class="text-sm text-danger" role="alert">{evidenceError}</p><Button variant="secondary" className="mt-4" on:click={() => selected && openAttempt(selected)}>{ar ? 'إعادة المحاولة' : 'Retry'}</Button></div>
      {:else if evidenceUrl}
        <img src={evidenceUrl} alt={ar ? 'بطاقة الطالب المرفقة للتحقق' : 'Student card submitted for verification'} class="max-h-[46dvh] w-full object-contain" on:error={() => { evidenceError = copy.cardError; evidenceUrl = '' }} />
      {/if}
    </div>
    <p class="mt-2 text-xs leading-5 text-text-muted">{copy.private}</p>
    {#if reviewError}<p class="mt-4 rounded-xl bg-danger-light p-4 text-sm text-danger" role="alert">{reviewError}</p>{/if}
    <label class="mt-5 block text-sm font-medium text-text-secondary" for="reject-reason">{copy.rejectLabel}</label>
    <select id="reject-reason" bind:value={reason} disabled={!!reviewingId} class="uneem-field mt-2">
      {#each reasons as option}<option value={option}>{reasonLabel(option)}</option>{/each}
    </select>
    <svelte:fragment slot="footer">
      <Button variant="secondary" disabled={!!reviewingId || loadingEvidence || !evidenceUrl} on:click={() => decide('rejected')} className="!bg-danger-light !text-danger sm:flex-1">{copy.reject}</Button>
      <Button loading={!!reviewingId} disabled={loadingEvidence || !evidenceUrl} on:click={() => decide('approved')} className="sm:flex-1">{copy.approve}</Button>
    </svelte:fragment>
  </Modal>
{/if}

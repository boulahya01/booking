<script lang="ts">
  import { onMount } from 'svelte'
  import { language } from '$lib/stores/ui'
  import {
    createVerificationEvidenceUrl,
    listVerificationQueue,
    reviewVerification,
    type VerificationQueueItem,
    type VerificationReason
  } from '$lib/identityApi'
  import Icon from '$lib/components/Icon.svelte'

  let queue: VerificationQueueItem[] = []
  let loading = true
  let error = ''
  let reviewingId = ''
  let evidenceUrl = ''
  let selected: VerificationQueueItem | null = null
  let reason: VerificationReason = 'student_id_incorrect'

  $: ar = $language === 'ar'
  $: copy = ar ? {
    title:'التحقق من الطلبة', subtitle:'راجع البطاقة ورقم الطالب.', refresh:'تحديث', clear:'ما كاين حتى طلب', clearHint:'جميع الطلبات تمت مراجعتها.',
    studentId:'رقم الطالب', academic:'بريد جامعي', personal:'بريد شخصي', attempt:'محاولة', previous:'المشكل السابق', review:'مراجعة', private:'وثيقة خاصة. استعملها فقط للتحقق.',
    rejectLabel:'سبب الرفض', reject:'رفض مع تصحيح', approve:'موافقة', saving:'جاري الحفظ…', loadError:'تعذر تحميل الطلبات.', cardError:'تعذر فتح البطاقة.', saveError:'تعذر حفظ القرار.'
  } : {
    title:'Student verification', subtitle:'Review the card and Student ID.', refresh:'Refresh', clear:'Queue is clear', clearHint:'No submissions are waiting.',
    studentId:'Student ID', academic:'Academic email', personal:'Personal email', attempt:'Attempt', previous:'Previous issue', review:'Review', private:'Private evidence. Use it only for verification.',
    rejectLabel:'Reason for rejection', reject:'Reject with fix', approve:'Approve', saving:'Saving…', loadError:'Couldn’t load the queue.', cardError:'Couldn’t open the card.', saveError:'Couldn’t save the review.'
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

  async function openAttempt(item: VerificationQueueItem) {
    error = ''
    try {
      evidenceUrl = await createVerificationEvidenceUrl(item.card_storage_path)
      selected = item
      reason = item.previous_reason_code || 'student_id_incorrect'
    } catch { error = copy.cardError }
  }

  async function decide(decision: 'approved' | 'rejected') {
    if (!selected) return
    reviewingId = selected.attempt_id
    error = ''
    try {
      await reviewVerification(selected.attempt_id, decision, decision === 'rejected' ? reason : null)
      selected = null
      evidenceUrl = ''
      queue = queue.filter((item) => item.attempt_id !== reviewingId)
    } catch { error = copy.saveError }
    finally { reviewingId = '' }
  }
</script>

<svelte:head><title>{copy.title} · UNEEM Admin</title></svelte:head>

<main class="uneem-page max-w-6xl">
  <header class="uneem-page-header">
    <div><p class="uneem-kicker">Admin</p><h1 class="uneem-title">{copy.title}</h1><p class="uneem-subtitle">{copy.subtitle}</p></div>
    <button on:click={load} class="uneem-secondary-action min-h-11 shrink-0 px-3 text-sm"><Icon name="refresh-cw" size={16}/>{copy.refresh}</button>
  </header>

  {#if error}<div class="mb-4 rounded-2xl bg-danger-light px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</div>{/if}

  {#if loading}
    <div class="space-y-3" aria-busy="true">{#each Array(3) as _}<div class="h-20 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}</div>
  {:else if queue.length === 0}
    <section class="uneem-empty">
      <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-success-light text-success"><Icon name="check" size={22}/></div>
      <h2 class="mt-3 font-bold text-text">{copy.clear}</h2><p class="mt-1 text-sm text-text-muted">{copy.clearHint}</p>
    </section>
  {:else}
    <section class="uneem-panel px-4 sm:px-5">
      {#each queue as item}
        <button on:click={() => openAttempt(item)} class="uneem-list-row w-full text-start">
          <div class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-light text-sm font-extrabold text-primary">{item.full_name?.charAt(0)?.toUpperCase() || '?'}</div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2"><h2 class="truncate text-sm font-bold text-text">{item.full_name}</h2><span class="rounded-full bg-surface-level-1 px-2 py-0.5 text-[10px] font-bold text-text-secondary">{item.email_kind === 'academic' ? copy.academic : copy.personal}</span>{#if Number(item.attempt_count)>1}<span class="rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-bold text-warning">{copy.attempt} {item.attempt_count}</span>{/if}</div>
            <p class="mt-1 text-xs text-text-muted">{copy.studentId}: <span class="font-bold text-text-secondary">{item.claimed_student_id}</span>{#if item.previous_reason_code} · {copy.previous}: {reasonLabel(item.previous_reason_code)}{/if}</p>
          </div>
          <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} className="shrink-0 text-text-muted"/>
        </button>
      {/each}
    </section>
  {/if}
</main>

{#if selected}
  <div class="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" role="presentation" on:click={() => !reviewingId && (selected=null)}>
    <section class="uneem-mobile-sheet max-h-[92vh] overflow-y-auto sm:max-w-2xl" role="dialog" aria-modal="true" on:click|stopPropagation>
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0"><p class="uneem-kicker">{copy.review}</p><h2 class="mt-1 truncate text-xl font-bold text-text">{selected.full_name}</h2><p class="mt-1 text-sm text-text-muted">{copy.studentId}: <span class="font-bold text-text">{selected.claimed_student_id}</span></p></div>
        <button on:click={() => {selected=null;evidenceUrl=''}} class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-level-1 text-text-secondary" aria-label="Close"><Icon name="x" size={18}/></button>
      </div>

      <div class="mt-5 overflow-hidden rounded-[22px] bg-surface-level-1">{#if evidenceUrl}<img src={evidenceUrl} alt="Private student card evidence" class="max-h-[46vh] w-full object-contain" />{/if}</div>
      <p class="mt-2 text-xs text-text-muted">{copy.private}</p>

      <label class="mt-5 block text-sm font-bold text-text" for="reject-reason">{copy.rejectLabel}</label>
      <select id="reject-reason" bind:value={reason} class="uneem-field mt-2">
        {#each reasons as option}<option value={option}>{reasonLabel(option)}</option>{/each}
      </select>

      <div class="mt-6 grid grid-cols-2 gap-3">
        <button on:click={() => decide('rejected')} disabled={!!reviewingId} class="flex min-h-[50px] items-center justify-center rounded-[18px] bg-danger-light px-4 font-bold text-danger">{copy.reject}</button>
        <button on:click={() => decide('approved')} disabled={!!reviewingId} class="uneem-primary-action">{reviewingId ? copy.saving : copy.approve}</button>
      </div>
    </section>
  </div>
{/if}

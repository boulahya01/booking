<script lang="ts">
  import { onMount } from 'svelte'
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

  const reasons: { value: VerificationReason; label: string }[] = [
    { value: 'student_id_incorrect', label: 'Student ID does not match' },
    { value: 'student_card_unreadable', label: 'Student card is unreadable' },
    { value: 'name_mismatch', label: 'Name does not match' },
    { value: 'not_a_student_card', label: 'Image is not a student card' },
    { value: 'student_card_expired', label: 'Student card cannot confirm current status' },
    { value: 'duplicate_student_identity', label: 'Identity ownership conflict' }
  ]

  onMount(load)

  async function load() {
    loading = true
    error = ''
    try {
      queue = await listVerificationQueue()
    } catch (e: any) {
      error = e.message || 'Unable to load verification queue.'
    } finally {
      loading = false
    }
  }

  async function openAttempt(item: VerificationQueueItem) {
    error = ''
    try {
      evidenceUrl = await createVerificationEvidenceUrl(item.card_storage_path)
      selected = item
      reason = item.previous_reason_code || 'student_id_incorrect'
    } catch (e: any) {
      error = e.message || 'Unable to open student card.'
    }
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
    } catch (e: any) {
      error = e.message || 'Unable to save review.'
    } finally {
      reviewingId = ''
    }
  }
</script>

<svelte:head>
  <title>Identity verification - UNEEM Admin</title>
</svelte:head>

<div class="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
  <header class="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="text-sm font-medium text-primary">Admin · Student safety</p>
      <h1 class="mt-1 text-2xl font-semibold tracking-tight text-text sm:text-3xl">Identity verification</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Review only the evidence needed to confirm Student ID ownership. Rejections must tell the student exactly what can be fixed.</p>
    </div>
    <button on:click={load} class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-surface-level-1 px-4 text-sm font-semibold text-text">
      <Icon name="refresh-cw" size={17} /> Refresh
    </button>
  </header>

  {#if error}
    <div class="mb-4 rounded-xl bg-danger-light p-3 text-sm text-danger" role="alert">{error}</div>
  {/if}

  {#if loading}
    <div class="space-y-3" aria-busy="true">
      {#each Array(3) as _}
        <div class="h-24 animate-pulse rounded-2xl bg-surface-level-1"></div>
      {/each}
    </div>
  {:else if queue.length === 0}
    <div class="rounded-2xl bg-surface-level-1 px-6 py-14 text-center">
      <div class="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary-light text-primary"><Icon name="check" size={22} /></div>
      <h2 class="font-semibold text-text">Queue is clear</h2>
      <p class="mt-1 text-sm text-text-secondary">There are no student identity submissions waiting for review.</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each queue as item}
        <button on:click={() => openAttempt(item)} class="w-full rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-primary/40 sm:p-5">
          <div class="flex items-center gap-4">
            <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-light font-semibold text-primary">{item.full_name?.charAt(0)?.toUpperCase() || '?'}</div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="truncate font-semibold text-text">{item.full_name}</h2>
                <span class="rounded-full bg-surface-level-1 px-2.5 py-1 text-xs font-medium text-text-secondary">{item.email_kind === 'academic' ? 'Academic email' : 'Personal email'}</span>
                {#if Number(item.attempt_count) > 1}
                  <span class="rounded-full bg-warning-light px-2.5 py-1 text-xs font-semibold text-warning">Attempt {item.attempt_count}</span>
                {/if}
              </div>
              <p class="mt-1 text-sm text-text-secondary">Student ID <span class="font-semibold tracking-wide text-text">{item.claimed_student_id}</span></p>
              {#if item.previous_reason_code}<p class="mt-1 text-xs text-text-muted">Previous issue: {item.previous_reason_code.replaceAll('_', ' ')}</p>{/if}
            </div>
            <Icon name="arrow-right" size={19} className="text-text-muted" />
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

{#if selected}
  <div class="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-6" role="presentation">
    <section class="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6" role="dialog" aria-modal="true" aria-label="Review student identity">
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-primary">Verification review</p>
          <h2 class="mt-1 text-xl font-semibold text-text">{selected.full_name}</h2>
          <p class="mt-1 text-sm text-text-secondary">Claimed Student ID: <span class="font-semibold tracking-wide text-text">{selected.claimed_student_id}</span></p>
        </div>
        <button on:click={() => { selected = null; evidenceUrl = '' }} class="grid h-10 w-10 place-items-center rounded-full bg-surface-level-1 text-text" aria-label="Close"><Icon name="x" size={18} /></button>
      </div>

      <div class="overflow-hidden rounded-2xl bg-surface-level-1">
        {#if evidenceUrl}
          <img src={evidenceUrl} alt="Private student card evidence" class="max-h-[46vh] w-full object-contain" />
        {/if}
      </div>
      <p class="mt-2 text-xs leading-5 text-text-muted">Private evidence. Use it only to confirm the submitted identity; do not copy or share it outside the verification workflow.</p>

      <div class="mt-6 rounded-2xl bg-surface-level-1 p-4">
        <label class="block text-sm font-medium text-text" for="reject-reason">If rejecting, choose what the student needs to fix</label>
        <select id="reject-reason" bind:value={reason} class="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary">
          {#each reasons as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-3">
        <button on:click={() => decide('rejected')} disabled={!!reviewingId} class="rounded-xl bg-danger-light px-4 py-3.5 font-semibold text-danger disabled:opacity-50">Reject with fix</button>
        <button on:click={() => decide('approved')} disabled={!!reviewingId} class="rounded-xl bg-primary px-4 py-3.5 font-semibold text-white disabled:opacity-50">{reviewingId ? 'Saving…' : 'Approve'}</button>
      </div>
    </section>
  </div>
{/if}

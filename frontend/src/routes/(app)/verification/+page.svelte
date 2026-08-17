<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { getMyAccountState } from '$lib/auth'
  import {
    getLatestVerificationAttempt,
    uploadAndSubmitStudentCard,
    type VerificationAttempt,
    type VerificationReason
  } from '$lib/identityApi'
  import type { AccountState } from '$lib/types'
  import Icon from '$lib/components/Icon.svelte'

  let state: AccountState | null = null
  let attempt: VerificationAttempt | null = null
  let studentId = ''
  let card: File | null = null
  let previewUrl = ''
  let loading = true
  let submitting = false
  let error = ''

  const reasonCopy: Record<VerificationReason, { title: string; body: string; editId: boolean }> = {
    student_id_incorrect: {
      title: 'Check your Student ID',
      body: 'The Student ID did not match the card. Correct it and submit the card again.',
      editId: true
    },
    student_card_unreadable: {
      title: 'Upload a clearer card photo',
      body: 'The card could not be read clearly. Keep your Student ID and replace only the photo.',
      editId: false
    },
    name_mismatch: {
      title: 'Your details need attention',
      body: 'The name on the account and student card did not match. Update the permitted profile details, then resubmit.',
      editId: false
    },
    duplicate_student_identity: {
      title: 'We need to verify ownership',
      body: 'We could not safely confirm this identity. Do not create another account. Contact Help so an admin can resolve it.',
      editId: false
    },
    not_a_student_card: {
      title: 'Upload your university student card',
      body: 'The submitted image was not accepted as a student card. Replace it with a clear photo of your card.',
      editId: false
    },
    student_card_expired: {
      title: 'Use a current student card',
      body: 'The submitted card could not confirm current student status. Upload a current card or contact Help.',
      editId: false
    }
  }

  $: rejectedReason = state?.restriction_reason as VerificationReason | null
  $: remediation = rejectedReason ? reasonCopy[rejectedReason] : null
  $: canSubmit = state?.identity_status !== 'conflict' && studentId.length === 10 && !!card && !submitting

  onMount(load)

  async function load() {
    loading = true
    error = ''
    try {
      const [account, latest] = await Promise.all([
        getMyAccountState(),
        getLatestVerificationAttempt()
      ])
      if (!account) {
        await goto('/login')
        return
      }
      state = account
      attempt = latest
      studentId = account.student_id || latest?.claimed_student_id || ''
    } catch (e: any) {
      error = e.message || 'Unable to load verification status.'
    } finally {
      loading = false
    }
  }

  function chooseCard(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const next = input.files?.[0] || null
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    card = next
    previewUrl = next ? URL.createObjectURL(next) : ''
    error = ''
  }

  async function submit() {
    if (!card || !canSubmit) return
    submitting = true
    error = ''
    try {
      state = await uploadAndSubmitStudentCard(studentId, card)
      attempt = await getLatestVerificationAttempt()
      card = null
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      previewUrl = ''
    } catch (e: any) {
      error = e.message || 'Unable to submit verification.'
    } finally {
      submitting = false
    }
  }
</script>

<svelte:head>
  <title>Student verification - UNEEM</title>
</svelte:head>

<div class="min-h-screen bg-surface px-4 py-6 sm:px-6">
  <main class="mx-auto w-full max-w-xl">
    <div class="mb-8 flex items-center gap-3">
      <button on:click={() => history.back()} class="grid h-11 w-11 place-items-center rounded-full bg-surface-level-1 text-text" aria-label="Go back">
        <Icon name="arrow-left" size={20} />
      </button>
      <div>
        <p class="text-sm font-medium text-primary">Account security</p>
        <h1 class="text-2xl font-semibold tracking-tight text-text">Student verification</h1>
      </div>
    </div>

    {#if loading}
      <div class="space-y-3" aria-busy="true">
        <div class="h-28 animate-pulse rounded-2xl bg-surface-level-1"></div>
        <div class="h-64 animate-pulse rounded-2xl bg-surface-level-1"></div>
      </div>
    {:else if state}
      <section class="mb-4 rounded-2xl bg-surface-level-1 p-5">
        <div class="flex items-start gap-4">
          <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-light text-primary">
            <Icon name={state.identity_status === 'verified' ? 'check' : state.identity_status === 'pending' ? 'clock' : 'shield'} size={20} />
          </div>
          <div class="min-w-0 flex-1">
            {#if state.identity_status === 'verified'}
              <h2 class="font-semibold text-text">Identity verified</h2>
              <p class="mt-1 text-sm leading-6 text-text-secondary">Your Student ID is securely linked to this UNEEM account.</p>
            {:else if state.identity_status === 'pending'}
              <h2 class="font-semibold text-text">Review in progress</h2>
              <p class="mt-1 text-sm leading-6 text-text-secondary">Your card was submitted. You can keep using the access already granted to your account while the review is pending.</p>
            {:else if state.identity_status === 'conflict'}
              <h2 class="font-semibold text-text">We need to verify ownership</h2>
              <p class="mt-1 text-sm leading-6 text-text-secondary">Do not create another account or try another Student ID. Use Help so an admin can resolve the identity safely.</p>
            {:else if remediation}
              <h2 class="font-semibold text-text">{remediation.title}</h2>
              <p class="mt-1 text-sm leading-6 text-text-secondary">{remediation.body}</p>
            {:else}
              <h2 class="font-semibold text-text">Complete your student identity</h2>
              <p class="mt-1 text-sm leading-6 text-text-secondary">This protects your account and prevents duplicate student identities.</p>
            {/if}
          </div>
        </div>
      </section>

      {#if state.identity_status === 'verified'}
        <button on:click={() => goto('/profile')} class="w-full rounded-xl bg-primary px-4 py-3.5 font-semibold text-white">Back to profile</button>
      {:else if state.identity_status === 'pending'}
        <div class="rounded-2xl border border-border bg-surface p-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm text-text-muted">Submitted Student ID</p>
              <p class="mt-1 font-semibold tracking-wide text-text">{attempt?.claimed_student_id || state.student_id}</p>
            </div>
            <span class="rounded-full bg-warning-light px-3 py-1.5 text-xs font-semibold text-warning">Pending</span>
          </div>
          <p class="mt-4 text-sm leading-6 text-text-secondary">You do not need to submit again unless an admin asks you to correct something.</p>
        </div>
      {:else if state.identity_status === 'conflict'}
        <a href="/pending-approval" class="block w-full rounded-xl bg-primary px-4 py-3.5 text-center font-semibold text-white">Open account help</a>
      {:else}
        <section class="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div class="mb-5">
            <h2 class="text-lg font-semibold text-text">{state.identity_status === 'rejected' ? 'Fix and resubmit' : 'Verify your Student ID'}</h2>
            <p class="mt-1 text-sm leading-6 text-text-secondary">Only redo the information that needs verification. Previous review attempts stay attached to this same account.</p>
          </div>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-text">Student ID</span>
            <input
              bind:value={studentId}
              maxlength="10"
              autocomplete="off"
              class="h-12 w-full rounded-xl border border-border bg-surface-level-1 px-4 uppercase text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
              disabled={state.identity_status === 'rejected' && remediation && !remediation.editId}
              placeholder="A123456789"
            />
          </label>

          <div class="mt-5">
            <span class="mb-2 block text-sm font-medium text-text">Student card photo</span>
            <label class="block cursor-pointer rounded-2xl border border-dashed border-border bg-surface-level-1 p-4 transition hover:border-primary">
              <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" on:change={chooseCard} />
              {#if previewUrl}
                <img src={previewUrl} alt="Student card preview" class="mb-3 max-h-56 w-full rounded-xl object-contain" />
                <p class="text-center text-sm font-medium text-primary">Choose a different photo</p>
              {:else}
                <div class="flex min-h-[132px] flex-col items-center justify-center text-center">
                  <div class="mb-3 grid h-11 w-11 place-items-center rounded-full bg-primary-light text-primary"><Icon name="camera" size={20} /></div>
                  <p class="font-medium text-text">Add a clear card photo</p>
                  <p class="mt-1 text-xs text-text-muted">JPG, PNG or WebP · up to 5 MB</p>
                </div>
              {/if}
            </label>
          </div>

          {#if error}
            <div class="mt-4 rounded-xl bg-danger-light p-3 text-sm text-danger" role="alert">{error}</div>
          {/if}

          <button
            on:click={submit}
            disabled={!canSubmit}
            class="mt-5 w-full rounded-xl bg-primary px-4 py-3.5 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? 'Submitting securely…' : state.identity_status === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
          </button>
          <p class="mt-3 text-center text-xs leading-5 text-text-muted">Your card is private and visible only to authorized reviewers.</p>
        </section>
      {/if}
    {/if}
  </main>
</div>

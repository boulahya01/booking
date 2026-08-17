<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { createMyReport, type ReportReason, type ReportTargetType } from '$lib/reportApi'

  const validTargets: ReportTargetType[] = ['user', 'match', 'booking', 'facility', 'other']

  const reasons: Array<{ value: ReportReason; label: string; targets?: ReportTargetType[] }> = [
    { value: 'harassment', label: 'Harassment or abusive behavior', targets: ['user', 'match'] },
    { value: 'unsafe_behavior', label: 'Unsafe behavior', targets: ['user', 'match', 'facility'] },
    { value: 'spam', label: 'Spam or misuse', targets: ['user', 'match'] },
    { value: 'fake_identity', label: 'Identity concern', targets: ['user'] },
    { value: 'booking_issue', label: 'Booking problem', targets: ['booking'] },
    { value: 'match_issue', label: 'Match problem', targets: ['match'] },
    { value: 'facility_issue', label: 'Facility problem', targets: ['facility'] },
    { value: 'other', label: 'Something else' }
  ]

  $: rawType = $page.params.type
  $: targetId = $page.params.id
  $: targetType = (validTargets.includes(rawType as ReportTargetType) ? rawType : 'other') as ReportTargetType
  $: availableReasons = reasons.filter((item) => !item.targets || item.targets.includes(targetType))
  $: if (availableReasons.length && !availableReasons.some((item) => item.value === reason)) reason = availableReasons[0].value

  let reason: ReportReason = 'other'
  let details = ''
  let submitting = false
  let error = ''
  let sent = false

  async function submitReport() {
    if (!details.trim() || submitting || !targetId) return
    submitting = true
    error = ''

    try {
      await createMyReport({ targetType, targetId, reason, body: details.trim() })
      sent = true
      details = ''
    } catch (e: any) {
      error = e.message
    } finally {
      submitting = false
    }
  }

  function targetLabel(type: ReportTargetType) {
    if (type === 'user') return 'student'
    if (type === 'match') return 'match'
    if (type === 'booking') return 'booking'
    if (type === 'facility') return 'facility'
    return 'item'
  }
</script>

<svelte:head>
  <title>Report {targetLabel(targetType)} - UNEEM</title>
  <meta name="description" content="Privately report a safety or sports issue to the UNEEM team." />
</svelte:head>

<div class="min-h-full bg-bg px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
  <main class="mx-auto w-full max-w-xl">
    <button on:click={() => history.back()} class="inline-flex min-h-11 items-center text-sm font-semibold text-text-secondary hover:text-text">← Back</button>

    <header class="mt-5 mb-7">
      <p class="text-sm font-semibold text-primary">Private report</p>
      <h1 class="mt-1 text-3xl font-semibold tracking-[-0.03em] text-text">Report this {targetLabel(targetType)}</h1>
      <p class="mt-3 text-sm leading-6 text-text-secondary">
        Reports go only to authorized UNEEM admins. The reported person does not see your report or your message.
      </p>
    </header>

    {#if error}
      <div class="mb-4 rounded-2xl bg-danger-light px-4 py-3 text-sm leading-6 text-danger" role="alert">{error}</div>
    {/if}

    {#if sent}
      <section class="uneem-panel p-6 text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-light text-xl text-success">✓</div>
        <h2 class="mt-4 text-xl font-semibold text-text">Report sent</h2>
        <p class="mt-2 text-sm leading-6 text-text-secondary">The UNEEM team can review it in Help & Reports. You can continue using the app normally.</p>
        <button on:click={() => goto('/home')} class="uneem-primary-action mt-5 w-full">Back to UNEEM</button>
        <a href="/help" class="mt-3 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-text-secondary hover:text-text">Open Help & support</a>
      </section>
    {:else}
      <form on:submit|preventDefault={submitReport} class="uneem-panel p-5 sm:p-6">
        <label for="reason" class="text-sm font-semibold text-text">What happened?</label>
        <select id="reason" bind:value={reason} class="uneem-field mt-2">
          {#each availableReasons as item}
            <option value={item.value}>{item.label}</option>
          {/each}
        </select>

        <label for="details" class="mt-5 block text-sm font-semibold text-text">Tell us what we should know</label>
        <textarea
          id="details"
          bind:value={details}
          rows="6"
          maxlength="4000"
          class="uneem-field mt-2 resize-none"
          placeholder="Describe what happened. Include only information that helps the team review the issue."
        ></textarea>
        <p class="mt-2 text-xs leading-5 text-text-muted">Do not include passwords, payment information, or student-card images here.</p>

        <button disabled={submitting || !details.trim()} class="uneem-primary-action mt-5 w-full">
          {submitting ? 'Sending…' : 'Send private report'}
        </button>
      </form>
    {/if}
  </main>
</div>

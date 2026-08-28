<script lang="ts">
  import { onMount } from 'svelte'
  import { language, uiState } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'
  import {
    listAdminUsers,
    adminSetUserAccess,
    type AdminUser,
    type AdminUserStatus,
    type AdminUserSuspendReason,
    type AdminUserRestoreReason,
    type AdminUserModerationReason
  } from '$lib/adminApi'

  let users: AdminUser[] = []
  let loading = true
  let error = ''
  let search = ''
  let appliedSearch = ''
  let status: 'all' | AdminUserStatus = 'all'
  let page = 1
  const pageSize = 50
  let total = 0

  let moderationTarget: AdminUser | null = null
  let nextStatus: 'approved' | 'suspended' = 'suspended'
  let moderationReason: AdminUserModerationReason = 'conduct'
  let moderating = false

  $: ar = $language === 'ar'
  $: totalPages = Math.max(1, Math.ceil(total / pageSize))
  $: copy = ar ? {
    title:'المستخدمون', subtitle:'حسابات الطلبة وحالتها.', search:'بحث بالاسم أو اسم المستخدم أو رقم الطالب', searchAction:'بحث', all:'الكل', active:'مسموح', pending:'قيد المراجعة', suspended:'موقوف',
    academic:'بريد جامعي', personal:'بريد شخصي', verified:'موثّق', required:'مطلوب', reviewing:'قيد المراجعة', rejected:'يحتاج تصحيح', conflict:'تعارض', admin:'مشرف', empty:'ما كاين حتى مستخدم', loadError:'تعذر تحميل المستخدمين.', verification:'طلبات التحقق', previous:'السابق', next:'التالي', users:'مستخدم',
    suspend:'إيقاف الوصول', restore:'إرجاع الوصول', suspendTitle:'إيقاف الوصول الرياضي؟', restoreTitle:'إرجاع الوصول الرياضي؟', suspendBody:'سيتم منع هذا الطالب من استخدام مسارات الرياضة. الحجوزات الحالية لا تُلغى تلقائياً.', restoreBody:'سيعود الوصول بعد التحقق من شروط الحساب. العملية ستُسجل في سجل الإدارة.', reason:'السبب', cancel:'إلغاء', confirmSuspend:'إيقاف الوصول', confirmRestore:'إرجاع الوصول', saving:'جارٍ الحفظ…', updated:'تم تحديث وصول المستخدم', updateError:'تعذر تحديث وصول المستخدم.',
    conduct:'سلوك مخالف', safety:'سلامة', spam:'إزعاج أو سبام', fakeIdentity:'هوية مشكوك فيها', bookingAbuse:'إساءة استخدام الحجز', matchAbuse:'إساءة استخدام المباريات', other:'سبب آخر', reviewComplete:'اكتملت المراجعة', appealApproved:'تم قبول طلب المراجعة'
  } : {
    title:'Users', subtitle:'Student accounts and status.', search:'Search name, username or Student ID', searchAction:'Search', all:'All', active:'Active', pending:'Pending', suspended:'Suspended',
    academic:'Academic email', personal:'Personal email', verified:'Verified', required:'Required', reviewing:'In review', rejected:'Needs correction', conflict:'Conflict', admin:'Admin', empty:'No users found', loadError:'Couldn’t load users.', verification:'Verification queue', previous:'Previous', next:'Next', users:'users',
    suspend:'Suspend access', restore:'Restore access', suspendTitle:'Suspend sports access?', restoreTitle:'Restore sports access?', suspendBody:'This student will be blocked from sports routes. Existing bookings are not cancelled automatically.', restoreBody:'Access returns only if the account still satisfies its identity requirements. The change is audited.', reason:'Reason', cancel:'Cancel', confirmSuspend:'Suspend access', confirmRestore:'Restore access', saving:'Saving…', updated:'User access updated', updateError:'Couldn’t update user access.',
    conduct:'Conduct issue', safety:'Safety issue', spam:'Spam or abuse', fakeIdentity:'Suspected fake identity', bookingAbuse:'Booking abuse', matchAbuse:'Match abuse', other:'Other reason', reviewComplete:'Review complete', appealApproved:'Appeal approved'
  }

  const suspendReasons: { value: AdminUserSuspendReason; label: () => string }[] = [
    { value:'conduct', label:() => copy.conduct },
    { value:'safety', label:() => copy.safety },
    { value:'spam', label:() => copy.spam },
    { value:'fake_identity', label:() => copy.fakeIdentity },
    { value:'booking_abuse', label:() => copy.bookingAbuse },
    { value:'match_abuse', label:() => copy.matchAbuse },
    { value:'other', label:() => copy.other }
  ]

  const restoreReasons: { value: AdminUserRestoreReason; label: () => string }[] = [
    { value:'review_complete', label:() => copy.reviewComplete },
    { value:'appeal_approved', label:() => copy.appealApproved },
    { value:'other', label:() => copy.other }
  ]

  $: moderationReasons = nextStatus === 'suspended' ? suspendReasons : restoreReasons

  onMount(load)

  async function load() {
    loading = true
    error = ''
    try {
      const result = await listAdminUsers({
        query: appliedSearch || undefined,
        status: status === 'all' ? undefined : status,
        limit: pageSize,
        offset: (page - 1) * pageSize
      })
      users = result.rows
      total = result.total
    } catch {
      error = copy.loadError
      users = []
      total = 0
    } finally {
      loading = false
    }
  }

  async function applySearch() {
    appliedSearch = search.trim()
    page = 1
    await load()
  }

  async function setStatus(next: 'all' | AdminUserStatus) {
    if (status === next) return
    status = next
    page = 1
    await load()
  }

  function openModeration(user: AdminUser) {
    if (user.role !== 'student' || user.access_status === 'pending') return
    moderationTarget = user
    nextStatus = user.access_status === 'suspended' ? 'approved' : 'suspended'
    moderationReason = nextStatus === 'suspended' ? 'conduct' : 'review_complete'
  }

  function closeModeration() {
    if (moderating) return
    moderationTarget = null
  }

  async function confirmModeration() {
    if (!moderationTarget || moderating) return
    moderating = true
    try {
      const result = await adminSetUserAccess(moderationTarget.user_id, nextStatus, moderationReason)
      users = users.map((user) => user.user_id === result.user_id
        ? { ...user, access_status: result.access_status, restriction_reason: result.restriction_reason }
        : user)

      if (status !== 'all' && result.access_status !== status) {
        users = users.filter((user) => user.user_id !== result.user_id)
        total = Math.max(0, total - 1)
      }

      moderationTarget = null
      uiState.addToast(copy.updated, 'success')
    } catch (e: any) {
      uiState.addToast(e?.message || copy.updateError, 'error')
    } finally {
      moderating = false
    }
  }

  function statusLabel(value: AdminUserStatus) {
    if (value === 'approved') return copy.active
    if (value === 'suspended') return copy.suspended
    return copy.pending
  }

  function statusTone(value: AdminUserStatus) {
    if (value === 'approved') return 'bg-success-light text-success'
    if (value === 'suspended') return 'bg-danger-light text-danger'
    return 'bg-warning-light text-warning'
  }

  function identityLabel(value: AdminUser['identity_status']) {
    if (value === 'verified') return copy.verified
    if (value === 'pending') return copy.reviewing
    if (value === 'rejected') return copy.rejected
    if (value === 'conflict') return copy.conflict
    return copy.required
  }
</script>

<svelte:head><title>{copy.title} · UNEEM Admin</title></svelte:head>

<main class="uneem-page max-w-6xl">
  <header class="uneem-page-header">
    <div><p class="uneem-kicker">Admin</p><h1 class="uneem-title">{copy.title}</h1><p class="uneem-subtitle">{copy.subtitle}</p></div>
    <a href="/admin/verification" class="uneem-secondary-action min-h-11 shrink-0 px-3 text-sm"><Icon name="shield" size={16}/>{copy.verification}</a>
  </header>

  <section class="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
    <form class="flex min-w-0 gap-2" on:submit|preventDefault={applySearch}>
      <div class="relative min-w-0 flex-1">
        <Icon name="search" size={17} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-text-muted"/>
        <input bind:value={search} class="uneem-field ps-11" placeholder={copy.search}/>
      </div>
      <button class="uneem-secondary-action shrink-0 px-4" disabled={loading}>{copy.searchAction}</button>
    </form>
    <div class="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
      {#each [{value:'all',label:copy.all},{value:'approved',label:copy.active},{value:'pending',label:copy.pending},{value:'suspended',label:copy.suspended}] as item}
        <button on:click={() => setStatus(item.value as 'all' | AdminUserStatus)} class="uneem-chip" class:is-active={status===item.value}>{item.label}</button>
      {/each}
    </div>
  </section>

  <div class="mb-3 flex items-center justify-between gap-3">
    <p class="text-sm font-semibold text-text-secondary">{total} {copy.users}</p>
    {#if loading && users.length > 0}<span class="text-xs text-text-muted">…</span>{/if}
  </div>

  {#if error}<div class="mb-4 rounded-2xl bg-danger-light px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</div>{/if}

  {#if loading && users.length === 0}
    <div class="space-y-3" aria-busy="true">{#each [1,2,3,4] as _}<div class="h-20 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}</div>
  {:else if users.length === 0}
    <section class="uneem-empty"><div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-text-muted"><Icon name="users" size={22}/></div><p class="mt-3 font-bold text-text">{copy.empty}</p></section>
  {:else}
    <section class="uneem-panel px-4 sm:px-5">
      {#each users as user (user.user_id)}
        <div class="uneem-list-row">
          <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-light text-sm font-extrabold text-primary">{user.full_name?.trim()?.[0]?.toUpperCase() || 'U'}</div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2"><p class="truncate text-sm font-bold text-text">{user.full_name}</p>{#if user.username}<span class="truncate text-xs font-semibold text-primary">@{user.username}</span>{/if}{#if user.role === 'admin'}<span class="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary">{copy.admin}</span>{/if}</div>
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
              <span>{user.student_id || '—'}</span>
              <span>{user.email_kind === 'academic' ? copy.academic : copy.personal}</span>
              <span>{identityLabel(user.identity_status)}</span>
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1.5">
            <span class={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(user.access_status)}`}>{statusLabel(user.access_status)}</span>
            {#if user.role === 'student' && user.access_status !== 'pending'}
              <button on:click={() => openModeration(user)} class={`min-h-8 text-xs font-bold ${user.access_status === 'suspended' ? 'text-primary' : 'text-danger'}`}>
                {user.access_status === 'suspended' ? copy.restore : copy.suspend}
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </section>
  {/if}

  {#if totalPages > 1}
    <div class="mt-5 flex items-center justify-center gap-3">
      <button disabled={page === 1 || loading} on:click={async () => { page--; await load() }} class="uneem-secondary-action">{copy.previous}</button>
      <span class="text-sm font-bold text-text-secondary">{page}/{totalPages}</span>
      <button disabled={page >= totalPages || loading} on:click={async () => { page++; await load() }} class="uneem-secondary-action">{copy.next}</button>
    </div>
  {/if}
</main>

{#if moderationTarget}
  <div class="fixed inset-0 z-50 flex items-end bg-black/55 sm:items-center sm:justify-center sm:p-5" role="presentation">
    <button type="button" tabindex="-1" aria-label="Close moderation dialog" class="absolute inset-0 cursor-default" disabled={moderating} on:click={closeModeration}></button>
    <section class="relative z-10 w-full rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-[28px]" role="dialog" aria-modal="true" tabindex="-1">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class={`text-xs font-extrabold uppercase tracking-[0.1em] ${nextStatus === 'suspended' ? 'text-danger' : 'text-primary'}`}>{moderationTarget.full_name}</p>
          <h2 class="mt-1 text-xl font-extrabold text-text">{nextStatus === 'suspended' ? copy.suspendTitle : copy.restoreTitle}</h2>
        </div>
        <button disabled={moderating} on:click={closeModeration} class="grid h-10 w-10 place-items-center rounded-full bg-surface-level-1 text-text-secondary"><Icon name="x" size={18}/></button>
      </div>

      <p class="mt-3 text-sm leading-6 text-text-secondary">{nextStatus === 'suspended' ? copy.suspendBody : copy.restoreBody}</p>

      <label class="mt-5 block">
        <span class="text-sm font-bold text-text">{copy.reason}</span>
        <select bind:value={moderationReason} class="uneem-field mt-2">
          {#each moderationReasons as reason}
            <option value={reason.value}>{reason.label()}</option>
          {/each}
        </select>
      </label>

      <div class="mt-5 grid grid-cols-2 gap-2">
        <button disabled={moderating} on:click={closeModeration} class="uneem-secondary-action">{copy.cancel}</button>
        <button disabled={moderating} on:click={confirmModeration} class={nextStatus === 'suspended' ? 'min-h-12 rounded-2xl bg-danger px-4 font-bold text-white disabled:opacity-60' : 'uneem-primary-action'}>
          {moderating ? copy.saving : nextStatus === 'suspended' ? copy.confirmSuspend : copy.confirmRestore}
        </button>
      </div>
    </section>
  </div>
{/if}

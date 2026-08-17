<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import { language } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'

  let users: any[] = []
  let loading = true
  let error = ''
  let search = ''
  let status = 'all'

  $: ar = $language === 'ar'
  $: copy = ar ? {
    title:'المستخدمون', subtitle:'حسابات الطلبة وحالتها.', search:'بحث بالاسم أو اسم المستخدم أو رقم الطالب', all:'الكل', active:'مسموح', pending:'قيد المراجعة', suspended:'موقوف',
    username:'اسم المستخدم', studentId:'رقم الطالب', academic:'بريد جامعي', personal:'بريد شخصي', verified:'موثّق', required:'مطلوب', reviewing:'قيد المراجعة', rejected:'يحتاج تصحيح', conflict:'تعارض', admin:'مشرف', student:'طالب', empty:'ما كاين حتى مستخدم', loadError:'تعذر تحميل المستخدمين.', verification:'طلبات التحقق'
  } : {
    title:'Users', subtitle:'Student accounts and status.', search:'Search name, username or Student ID', all:'All', active:'Active', pending:'Pending', suspended:'Suspended',
    username:'Username', studentId:'Student ID', academic:'Academic email', personal:'Personal email', verified:'Verified', required:'Required', reviewing:'In review', rejected:'Needs correction', conflict:'Conflict', admin:'Admin', student:'Student', empty:'No users found', loadError:'Couldn’t load users.', verification:'Verification queue'
  }

  $: normalizedSearch = search.trim().toLowerCase()
  $: filtered = users.filter((user) => {
    if (status !== 'all' && user.status !== status) return false
    if (!normalizedSearch) return true
    return [user.full_name,user.username,user.student_id].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))
  })

  onMount(load)

  async function load() {
    loading = true
    error = ''
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id,student_id,full_name,username,role,status,email_kind,identity_status,restriction_reason,created_at')
      .order('created_at', { ascending:false })
    if (err) error = copy.loadError
    else users = data || []
    loading = false
  }

  function statusLabel(value: string) {
    if (value === 'approved') return copy.active
    if (value === 'suspended') return copy.suspended
    return copy.pending
  }

  function statusTone(value: string) {
    if (value === 'approved') return 'bg-success-light text-success'
    if (value === 'suspended') return 'bg-danger-light text-danger'
    return 'bg-warning-light text-warning'
  }

  function identityLabel(value: string) {
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
    <div class="relative">
      <Icon name="search" size={17} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-text-muted"/>
      <input bind:value={search} class="uneem-field ps-11" placeholder={copy.search}/>
    </div>
    <div class="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
      {#each [{value:'all',label:copy.all},{value:'approved',label:copy.active},{value:'pending',label:copy.pending},{value:'suspended',label:copy.suspended}] as item}
        <button on:click={() => status=item.value} class="uneem-chip" class:is-active={status===item.value}>{item.label}</button>
      {/each}
    </div>
  </section>

  {#if error}<div class="mb-4 rounded-2xl bg-danger-light px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</div>{/if}

  {#if loading}
    <div class="space-y-3" aria-busy="true">{#each [1,2,3,4] as _}<div class="h-20 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}</div>
  {:else if filtered.length === 0}
    <section class="uneem-empty"><div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-text-muted"><Icon name="users" size={22}/></div><p class="mt-3 font-bold text-text">{copy.empty}</p></section>
  {:else}
    <section class="uneem-panel px-4 sm:px-5">
      {#each filtered as user (user.id)}
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
          <span class={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(user.status)}`}>{statusLabel(user.status)}</span>
        </div>
      {/each}
    </section>
  {/if}
</main>

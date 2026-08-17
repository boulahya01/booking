<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { language, uiState } from '$lib/stores/ui'
  import {
    listAdminFacilities,
    adminSaveFacility,
    adminArchiveFacility,
    type AdminFacility,
    type AdminFacilityInput,
    type FacilityArchiveReason
  } from '$lib/adminApi'

  let facilities: AdminFacility[] = []
  let loading = true
  let error = ''
  let showInactive = false
  let editing: AdminFacility | null = null
  let showForm = false
  let saving = false
  let archiveTarget: AdminFacility | null = null
  let archiveReason: FacilityArchiveReason = 'maintenance'

  const defaults: AdminFacilityInput = {
    name: '', location: '', sport_type: '', capacity: 10, timezone: 'Africa/Casablanca',
    open_time: '08:00', close_time: '22:00', slot_duration_minutes: 60, booking_window_hours: 168,
    booking_frequency_enabled: false, booking_frequency_days: 7, cancellation_cutoff_minutes: 60,
    is_active: true, sort_order: 0
  }
  let form: AdminFacilityInput = { ...defaults }

  $: ar = $language === 'ar'
  $: visible = showInactive ? facilities : facilities.filter((f) => f.is_active)
  $: copy = ar ? {
    eyebrow:'عمليات UNEEM', title:'المرافق', subtitle:'تحكم في أوقات الحجز والسعة والقواعد من مكان واحد.', add:'إضافة مرفق', active:'النشطة', all:'الكل', empty:'لا توجد مرافق هنا.',
    retry:'إعادة المحاولة', edit:'تعديل', archive:'إيقاف المرفق', inactive:'غير نشط', capacity:'السعة', duration:'مدة الحجز', window:'نافذة الحجز', cutoff:'آخر وقت للإلغاء', frequency:'تكرار الحجز', days:'أيام',
    createTitle:'مرفق جديد', editTitle:'إعدادات المرفق', name:'الاسم', location:'الموقع', sport:'الرياضة', open:'الفتح', close:'الإغلاق', sort:'الترتيب', enabled:'نشط للطلاب', save:'حفظ', cancel:'إلغاء', saving:'جارٍ الحفظ…',
    archiveTitle:'إيقاف هذا المرفق؟', archiveHint:'لن يُحذف التاريخ. سيختفي المرفق من الحجز الجديد ويمكن إعادة تفعيله لاحقاً.', reason:'السبب', keep:'إبقاءه نشطاً', confirmArchive:'إيقاف المرفق'
  } : {
    eyebrow:'UNEEM operations', title:'Facilities', subtitle:'Control availability, capacity and booking rules from one place.', add:'Add facility', active:'Active', all:'All', empty:'No facilities here.',
    retry:'Retry', edit:'Edit', archive:'Archive facility', inactive:'Inactive', capacity:'Capacity', duration:'Slot duration', window:'Booking window', cutoff:'Cancellation cutoff', frequency:'Booking frequency', days:'days',
    createTitle:'New facility', editTitle:'Facility settings', name:'Name', location:'Location', sport:'Sport', open:'Opens', close:'Closes', sort:'Display order', enabled:'Available to students', save:'Save facility', cancel:'Cancel', saving:'Saving…',
    archiveTitle:'Archive this facility?', archiveHint:'History is preserved. The facility disappears from new bookings and can be reactivated later.', reason:'Reason', keep:'Keep active', confirmArchive:'Archive facility'
  }

  const archiveReasons: {value: FacilityArchiveReason; en:string; ar:string}[] = [
    {value:'maintenance',en:'Maintenance',ar:'صيانة'}, {value:'retired',en:'No longer offered',ar:'لم يعد متاحاً'}, {value:'duplicate',en:'Duplicate facility',ar:'مرفق مكرر'}, {value:'other',en:'Other operational reason',ar:'سبب تشغيلي آخر'}
  ]

  onMount(load)

  async function load() {
    loading = true; error = ''
    try { facilities = await listAdminFacilities() }
    catch (e:any) { error = e.message || 'Unable to load facilities' }
    finally { loading = false }
  }

  function normalizeTime(value: string) { return value?.slice(0,5) || '' }

  function openCreate() {
    editing = null
    form = { ...defaults, sort_order: facilities.length }
    showForm = true
  }

  function openEdit(facility: AdminFacility) {
    editing = facility
    form = {
      id: facility.id, name: facility.name, location: facility.location, sport_type: facility.sport_type || '', capacity: facility.capacity,
      timezone: facility.timezone || 'Africa/Casablanca', open_time: normalizeTime(facility.open_time), close_time: normalizeTime(facility.close_time),
      slot_duration_minutes: facility.slot_duration_minutes, booking_window_hours: facility.booking_window_hours,
      booking_frequency_enabled: facility.booking_frequency_enabled, booking_frequency_days: facility.booking_frequency_days,
      cancellation_cutoff_minutes: facility.cancellation_cutoff_minutes, is_active: facility.is_active, sort_order: facility.sort_order
    }
    showForm = true
  }

  async function save() {
    if (!form.name.trim() || !form.location.trim()) { uiState.addToast(ar ? 'الاسم والموقع مطلوبان' : 'Name and location are required', 'error'); return }
    saving = true
    try {
      const saved = await adminSaveFacility(form)
      const index = facilities.findIndex((f) => f.id === saved.id)
      facilities = index === -1 ? [...facilities, saved] : facilities.map((f) => f.id === saved.id ? saved : f)
      facilities = [...facilities].sort((a,b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      showForm = false; editing = null
      uiState.addToast(ar ? 'تم حفظ المرفق' : 'Facility saved', 'success')
    } catch (e:any) { uiState.addToast(e.message || (ar ? 'تعذر الحفظ' : 'Unable to save facility'), 'error') }
    finally { saving = false }
  }

  async function archive() {
    if (!archiveTarget) return
    saving = true
    try {
      const saved = await adminArchiveFacility(archiveTarget.id, archiveReason)
      facilities = facilities.map((f) => f.id === saved.id ? saved : f)
      archiveTarget = null
      uiState.addToast(ar ? 'تم إيقاف المرفق' : 'Facility archived', 'success')
    } catch (e:any) { uiState.addToast(e.message || (ar ? 'تعذر إيقاف المرفق' : 'Unable to archive facility'), 'error') }
    finally { saving = false }
  }
</script>

<svelte:head><title>{copy.title} · UNEEM Admin</title></svelte:head>

<div class="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 sm:pb-10 sm:pt-7">
  <header class="mb-6 flex items-end justify-between gap-4">
    <div><p class="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">{copy.eyebrow}</p><h1 class="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-text">{copy.title}</h1><p class="mt-1 max-w-xl text-sm leading-6 text-text-secondary">{copy.subtitle}</p></div>
    <button on:click={openCreate} class="uneem-primary-action shrink-0"><Icon name="plus" size={17}/><span class="hidden sm:inline">{copy.add}</span></button>
  </header>

  <div class="mb-4 inline-flex rounded-2xl bg-surface-level-1 p-1">
    <button on:click={() => showInactive = false} class={`min-h-10 rounded-xl px-4 text-sm font-bold ${!showInactive ? 'bg-surface text-text shadow-sm' : 'text-text-muted'}`}>{copy.active}</button>
    <button on:click={() => showInactive = true} class={`min-h-10 rounded-xl px-4 text-sm font-bold ${showInactive ? 'bg-surface text-text shadow-sm' : 'text-text-muted'}`}>{copy.all}</button>
  </div>

  {#if error && facilities.length === 0}
    <section class="uneem-card text-center"><p class="text-sm font-semibold text-danger">{error}</p><button on:click={load} class="mt-3 min-h-10 font-bold text-primary">{copy.retry}</button></section>
  {:else if loading && facilities.length === 0}
    <div class="grid gap-3 sm:grid-cols-2" aria-busy="true">{#each [1,2,3,4] as _}<div class="h-40 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}</div>
  {:else if visible.length === 0}
    <section class="uneem-card py-12 text-center"><Icon name="map-pin" size={26} className="mx-auto text-text-muted"/><p class="mt-3 font-bold text-text">{copy.empty}</p></section>
  {:else}
    <div class="grid gap-3 sm:grid-cols-2">
      {#each visible as facility (facility.id)}
        <article class={`uneem-card ${facility.is_active ? '' : 'opacity-70'}`}>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0"><div class="flex flex-wrap items-center gap-2">{#if facility.sport_type}<span class="text-xs font-extrabold uppercase tracking-[0.08em] text-primary">{facility.sport_type}</span>{/if}{#if !facility.is_active}<span class="uneem-chip text-warning">{copy.inactive}</span>{/if}</div><h2 class="mt-1 truncate text-lg font-extrabold text-text">{facility.name}</h2><p class="mt-1 flex items-center gap-1.5 text-sm text-text-secondary"><Icon name="map-pin" size={14}/>{facility.location}</p></div>
            <button on:click={() => openEdit(facility)} class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-level-1 text-text-secondary" aria-label={copy.edit}><Icon name="pencil" size={17}/></button>
          </div>
          <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt class="text-xs text-text-muted">{copy.capacity}</dt><dd class="mt-0.5 font-bold text-text">{facility.capacity}</dd></div>
            <div><dt class="text-xs text-text-muted">{copy.duration}</dt><dd class="mt-0.5 font-bold text-text">{facility.slot_duration_minutes} min</dd></div>
            <div><dt class="text-xs text-text-muted">{copy.window}</dt><dd class="mt-0.5 font-bold text-text">{facility.booking_window_hours}h</dd></div>
            <div><dt class="text-xs text-text-muted">{copy.cutoff}</dt><dd class="mt-0.5 font-bold text-text">{facility.cancellation_cutoff_minutes} min</dd></div>
          </dl>
          <div class="mt-4 flex items-center justify-between border-t border-border-light pt-3"><p class="text-xs text-text-muted">{normalizeTime(facility.open_time)}–{normalizeTime(facility.close_time)}{facility.booking_frequency_enabled ? ` · ${facility.booking_frequency_days} ${copy.days}` : ''}</p>{#if facility.is_active}<button on:click={() => { archiveTarget = facility; archiveReason = 'maintenance' }} class="min-h-9 text-sm font-bold text-danger">{copy.archive}</button>{/if}</div>
        </article>
      {/each}
    </div>
  {/if}
</div>

{#if showForm}
  <div class="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center sm:p-5" role="presentation" on:click={() => !saving && (showForm = false)}>
    <section class="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-2xl sm:rounded-[28px]" role="dialog" aria-modal="true" on:click|stopPropagation>
      <div class="flex items-start justify-between gap-4"><div><p class="text-xs font-extrabold uppercase tracking-[0.1em] text-primary">UNEEM</p><h2 class="mt-1 text-xl font-extrabold text-text">{editing ? copy.editTitle : copy.createTitle}</h2></div><button disabled={saving} on:click={() => showForm = false} class="grid h-10 w-10 place-items-center rounded-full bg-surface-level-1"><Icon name="x" size={18}/></button></div>
      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="sm:col-span-2"><span class="text-sm font-bold text-text">{copy.name}</span><input bind:value={form.name} class="uneem-field mt-2" /></label>
        <label><span class="text-sm font-bold text-text">{copy.location}</span><input bind:value={form.location} class="uneem-field mt-2" /></label>
        <label><span class="text-sm font-bold text-text">{copy.sport}</span><input bind:value={form.sport_type} class="uneem-field mt-2" placeholder="Football" /></label>
        <label><span class="text-sm font-bold text-text">{copy.open}</span><input bind:value={form.open_time} type="time" class="uneem-field mt-2" /></label>
        <label><span class="text-sm font-bold text-text">{copy.close}</span><input bind:value={form.close_time} type="time" class="uneem-field mt-2" /></label>
        <label><span class="text-sm font-bold text-text">{copy.capacity}</span><input bind:value={form.capacity} type="number" min="1" max="200" class="uneem-field mt-2" /></label>
        <label><span class="text-sm font-bold text-text">{copy.duration}</span><select bind:value={form.slot_duration_minutes} class="uneem-field mt-2"><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option><option value={90}>90 min</option><option value={120}>120 min</option></select></label>
        <label><span class="text-sm font-bold text-text">{copy.window}</span><input bind:value={form.booking_window_hours} type="number" min="1" max="720" class="uneem-field mt-2" /></label>
        <label><span class="text-sm font-bold text-text">{copy.cutoff}</span><input bind:value={form.cancellation_cutoff_minutes} type="number" min="0" max="1440" class="uneem-field mt-2" /></label>
        <label><span class="text-sm font-bold text-text">{copy.sort}</span><input bind:value={form.sort_order} type="number" class="uneem-field mt-2" /></label>
        <label><span class="text-sm font-bold text-text">{copy.frequency}</span><div class="mt-2 flex min-h-12 items-center justify-between rounded-2xl bg-surface-level-1 px-4"><span class="text-sm text-text-secondary">{form.booking_frequency_enabled ? 'On' : 'Off'}</span><input bind:checked={form.booking_frequency_enabled} type="checkbox" class="h-5 w-5 accent-primary" /></div></label>
        {#if form.booking_frequency_enabled}<label><span class="text-sm font-bold text-text">{copy.frequency} · {copy.days}</span><input bind:value={form.booking_frequency_days} type="number" min="1" max="365" class="uneem-field mt-2" /></label>{/if}
        <label class="sm:col-span-2"><div class="flex min-h-12 items-center justify-between rounded-2xl bg-surface-level-1 px-4"><span class="font-bold text-text">{copy.enabled}</span><input bind:checked={form.is_active} type="checkbox" class="h-5 w-5 accent-primary" /></div></label>
      </div>
      <div class="mt-6 flex gap-3"><button disabled={saving} on:click={() => showForm = false} class="uneem-secondary-action flex-1">{copy.cancel}</button><button disabled={saving} on:click={save} class="uneem-primary-action flex-1">{saving ? copy.saving : copy.save}</button></div>
    </section>
  </div>
{/if}

{#if archiveTarget}
  <div class="fixed inset-0 z-[60] flex items-end bg-black/55 sm:items-center sm:justify-center sm:p-5" role="presentation" on:click={() => !saving && (archiveTarget = null)}>
    <section class="w-full rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-[28px]" role="dialog" aria-modal="true" on:click|stopPropagation>
      <h2 class="text-xl font-extrabold text-text">{copy.archiveTitle}</h2><p class="mt-2 text-sm leading-6 text-text-secondary">{copy.archiveHint}</p>
      <label class="mt-5 block text-sm font-bold text-text">{copy.reason}<select bind:value={archiveReason} class="uneem-field mt-2">{#each archiveReasons as item}<option value={item.value}>{ar ? item.ar : item.en}</option>{/each}</select></label>
      <div class="mt-5 flex gap-3"><button disabled={saving} on:click={() => archiveTarget = null} class="uneem-secondary-action flex-1">{copy.keep}</button><button disabled={saving} on:click={archive} class="min-h-12 flex-1 rounded-2xl bg-danger px-4 font-bold text-white disabled:opacity-50">{copy.confirmArchive}</button></div>
    </section>
  </div>
{/if}

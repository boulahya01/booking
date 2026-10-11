<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '$lib/components/Icon.svelte'
  import Button from '$lib/components/Button.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Toggle from '$lib/components/Toggle.svelte'
  import SegmentedControl from '$lib/components/SegmentedControl.svelte'
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

  type FacilityForm = Omit<AdminFacilityInput, 'sport_type'> & { sport_type: string }
  const defaults: FacilityForm = {
    name: '', location: '', sport_type: '', capacity: 10, timezone: 'Africa/Casablanca',
    open_time: '08:00', close_time: '22:00', slot_duration_minutes: 60, booking_window_hours: 24,
    booking_frequency_enabled: false, booking_frequency_days: 7, cancellation_cutoff_minutes: 60,
    is_active: true, sort_order: 0
  }
  let form: FacilityForm = { ...defaults }

  $: ar = $language === 'ar'
  $: visible = showInactive ? facilities : facilities.filter((f) => f.is_active)
  $: facilityFilterOptions = [
    { value: 'active', label: copy.active },
    { value: 'all', label: copy.all }
  ]
  const durationOptions = [30, 45, 60, 90, 120].map((minutes) => ({ value: String(minutes), label: `${minutes} min` }))
  $: copy = ar ? {
    eyebrow:'عمليات UNEEM', title:'المرافق', subtitle:'الأوقات والسعة وقواعد الحجز.', add:'إضافة مرفق', active:'النشطة', all:'الكل', empty:'لم يتم إعداد أي مرفق بعد.', emptyAction:'إعداد أول مرفق',
    retry:'إعادة المحاولة', edit:'تعديل', archive:'إيقاف المرفق', inactive:'غير نشط', capacity:'السعة', duration:'مدة الحجز', window:'نافذة الحجز', cutoff:'آخر وقت للإلغاء', frequency:'تكرار الحجز', days:'أيام',
    createTitle:'مرفق جديد', editTitle:'إعدادات المرفق', name:'الاسم', location:'الموقع', sport:'الرياضة', open:'الفتح', close:'الإغلاق', sort:'الترتيب', enabled:'نشط للطلاب', save:'حفظ', cancel:'إلغاء', saving:'جارٍ الحفظ…',
    overnight:'يمكن أن يبقى المرفق مفتوحاً بعد منتصف الليل، مثلاً 08:00 → 01:00.', windowHint:'أقصى مدة ظاهرة للطلبة هي 24 ساعة.',
    archiveTitle:'إيقاف هذا المرفق؟', archiveHint:'لن يُحذف التاريخ. سيختفي المرفق من الحجز الجديد ويمكن إعادة تفعيله لاحقاً.', reason:'السبب', keep:'إبقاؤه نشطاً', confirmArchive:'إيقاف المرفق'
  } : {
    eyebrow:'UNEEM operations', title:'Facilities', subtitle:'Hours, capacity and booking rules.', add:'Add facility', active:'Active', all:'All', empty:'No facilities have been configured.', emptyAction:'Set up first facility',
    retry:'Retry', edit:'Edit', archive:'Archive facility', inactive:'Inactive', capacity:'Capacity', duration:'Slot duration', window:'Booking window', cutoff:'Cancellation cutoff', frequency:'Booking frequency', days:'days',
    createTitle:'New facility', editTitle:'Facility settings', name:'Name', location:'Location', sport:'Sport', open:'Opens', close:'Closes', sort:'Display order', enabled:'Available to students', save:'Save facility', cancel:'Cancel', saving:'Saving…',
    overnight:'Facilities can close after midnight, for example 08:00 → 01:00.', windowHint:'Students can see at most the next 24 hours.',
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
  function facilityHours(facility: AdminFacility) {
    const open = normalizeTime(facility.open_time)
    const close = normalizeTime(facility.close_time)
    return close < open ? `${open}–${close} +1d` : `${open}–${close}`
  }

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
      slot_duration_minutes: facility.slot_duration_minutes, booking_window_hours: Math.min(facility.booking_window_hours, 24),
      booking_frequency_enabled: facility.booking_frequency_enabled, booking_frequency_days: facility.booking_frequency_days,
      cancellation_cutoff_minutes: facility.cancellation_cutoff_minutes, is_active: facility.is_active, sort_order: facility.sort_order
    }
    showForm = true
  }

  async function save() {
    if (saving) return
    if (!form.name.trim() || !form.location.trim()) { uiState.addToast(ar ? 'الاسم والموقع مطلوبان' : 'Name and location are required', 'error'); return }
    saving = true
    try {
      const saved = await adminSaveFacility({ ...form, booking_window_hours: Math.min(Number(form.booking_window_hours || 24), 24) })
      const index = facilities.findIndex((f) => f.id === saved.id)
      facilities = index === -1 ? [...facilities, saved] : facilities.map((f) => f.id === saved.id ? saved : f)
      facilities = [...facilities].sort((a,b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      showForm = false; editing = null
      uiState.addToast(ar ? 'تم حفظ المرفق' : 'Facility saved', 'success')
    } catch (e:any) { uiState.addToast(e.message || (ar ? 'تعذر الحفظ' : 'Unable to save facility'), 'error') }
    finally { saving = false }
  }

  async function archive() {
    if (!archiveTarget || saving) return
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

<main class="uneem-page max-w-6xl">
  <header class="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 class="uneem-title">{copy.title}</h1><p class="mt-1 max-w-xl text-sm leading-6 text-text-secondary">{copy.subtitle}</p></div>
    <Button on:click={openCreate} className="w-full sm:w-auto"><Icon name="plus" size={18}/>{copy.add}</Button>
  </header>

  <div class="mb-4 max-w-xs">
    <SegmentedControl
      options={facilityFilterOptions}
      value={showInactive ? 'all' : 'active'}
      ariaLabel={copy.title}
      onChange={(value) => (showInactive = value === 'all')}
    />
  </div>

  {#if error && facilities.length === 0}
    <section class="uneem-card text-center"><p class="text-sm font-semibold text-danger">{error}</p><button on:click={load} class="mt-3 min-h-10 font-bold text-primary">{copy.retry}</button></section>
  {:else if loading && facilities.length === 0}
    <div class="grid gap-3 sm:grid-cols-2" aria-busy="true">{#each [1,2,3,4] as _}<div class="h-40 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}</div>
  {:else if visible.length === 0}
    <section class="uneem-card py-12 text-center"><Icon name="map-pin" size={26} className="mx-auto text-text-muted"/><p class="mt-3 font-bold text-text">{copy.empty}</p><button on:click={openCreate} class="uneem-primary-action mx-auto mt-5"><Icon name="plus" size={17}/>{copy.emptyAction}</button></section>
  {:else}
    <div class="grid gap-3 sm:grid-cols-2">
      {#each visible as facility (facility.id)}
        <article class="uneem-card flex flex-col">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0"><div class="flex flex-wrap items-center gap-2">{#if facility.sport_type}<span class="text-xs font-semibold text-primary">{facility.sport_type}</span>{/if}{#if !facility.is_active}<span class="rounded-lg bg-warning-light px-2 py-1 text-xs font-medium text-warning">{copy.inactive}</span>{/if}</div><h2 class="mt-2 text-xl font-semibold tracking-tight text-text">{facility.name}</h2><p class="mt-1 flex items-center gap-1.5 text-sm text-text-secondary"><Icon name="map-pin" size={14}/>{facility.location}</p></div>
            <button on:click={() => openEdit(facility)} class="uneem-icon-button shrink-0 bg-surface-level-1" aria-label={`${copy.edit}: ${facility.name}`}><Icon name="pencil" size={17}/></button>
          </div>
          <dl class="my-5 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl bg-surface-level-1 p-4 text-sm">
            <div><dt class="text-xs text-text-muted">{copy.capacity}</dt><dd class="mt-0.5 font-bold text-text">{facility.capacity}</dd></div>
            <div><dt class="text-xs text-text-muted">{copy.duration}</dt><dd class="mt-0.5 font-bold text-text">{facility.slot_duration_minutes} min</dd></div>
            <div><dt class="text-xs text-text-muted">{copy.window}</dt><dd class="mt-0.5 font-bold text-text">{Math.min(facility.booking_window_hours, 24)}h</dd></div>
            <div><dt class="text-xs text-text-muted">{copy.cutoff}</dt><dd class="mt-0.5 font-bold text-text">{facility.cancellation_cutoff_minutes} min</dd></div>
          </dl>
          <div class="mt-auto flex flex-wrap items-center justify-between gap-2"><p class="text-xs text-text-muted">{facilityHours(facility)}{facility.booking_frequency_enabled ? ` · ${facility.booking_frequency_days} ${copy.days}` : ''}</p>{#if facility.is_active}<button on:click={() => { archiveTarget = facility; archiveReason = 'maintenance' }} class="min-h-11 rounded-xl px-2 text-sm font-semibold text-danger hover:bg-danger-light">{copy.archive}</button>{/if}</div>
        </article>
      {/each}
    </div>
  {/if}
</main>

<Modal bind:open={showForm} title={editing ? copy.editTitle : copy.createTitle} size="lg" closeDisabled={saving}>
  <form id="facility-form" on:submit|preventDefault={save} class="grid grid-cols-1 gap-5 sm:grid-cols-2">
    <div class="sm:col-span-2"><TextField label={copy.name} bind:value={form.name} required disabled={saving}/></div>
    <TextField label={copy.location} bind:value={form.location} required disabled={saving}/>
    <TextField label={copy.sport} bind:value={form.sport_type} disabled={saving}/>
    <fieldset class="grid min-w-0 grid-cols-2 gap-4 sm:col-span-2">
      <legend class="mb-3 text-sm font-semibold text-text">{ar ? 'ساعات العمل' : 'Opening hours'}</legend>
      <label class="min-w-0"><span class="text-sm font-medium text-text-secondary">{copy.open}</span><input bind:value={form.open_time} type="time" required disabled={saving} class="uneem-field mt-2" /></label>
      <label class="min-w-0"><span class="text-sm font-medium text-text-secondary">{copy.close}</span><input bind:value={form.close_time} type="time" required disabled={saving} class="uneem-field mt-2" /></label>
      <p class="col-span-2 text-xs leading-5 text-text-muted">{copy.overnight}</p>
    </fieldset>
    <label><span class="text-sm font-medium text-text-secondary">{copy.capacity}</span><input bind:value={form.capacity} type="number" inputmode="numeric" min="1" max="200" required disabled={saving} class="uneem-field mt-2" /></label>
    <label><span class="text-sm font-medium text-text-secondary">{copy.sort}</span><input bind:value={form.sort_order} type="number" inputmode="numeric" disabled={saving} class="uneem-field mt-2" /></label>
    <div class="sm:col-span-2"><span class="text-sm font-medium text-text-secondary">{copy.duration}</span><div class="mt-2"><SegmentedControl options={durationOptions} value={String(form.slot_duration_minutes)} ariaLabel={copy.duration} scrollable onChange={(value) => { if (!saving) form.slot_duration_minutes = Number(value) }} /></div></div>
    <label><span class="text-sm font-medium text-text-secondary">{copy.window} · {ar ? 'ساعة' : 'hours'}</span><input bind:value={form.booking_window_hours} type="number" inputmode="numeric" min="1" max="24" required disabled={saving} class="uneem-field mt-2" /><span class="mt-2 block text-xs leading-5 text-text-muted">{copy.windowHint}</span></label>
    <label><span class="text-sm font-medium text-text-secondary">{copy.cutoff} · {ar ? 'دقيقة' : 'min'}</span><input bind:value={form.cancellation_cutoff_minutes} type="number" inputmode="numeric" min="0" max="1440" required disabled={saving} class="uneem-field mt-2" /></label>
    <div class="space-y-4 rounded-2xl bg-surface-level-1 p-4 sm:col-span-2">
      <Toggle checked={form.booking_frequency_enabled} label={copy.frequency} disabled={saving} onToggle={() => form.booking_frequency_enabled = !form.booking_frequency_enabled}/>
      {#if form.booking_frequency_enabled}<label class="block"><span class="text-sm font-medium text-text-secondary">{copy.days}</span><input bind:value={form.booking_frequency_days} type="number" inputmode="numeric" min="1" max="365" required disabled={saving} class="uneem-field mt-2 !bg-surface" /></label>{/if}
      <Toggle checked={form.is_active} label={copy.enabled} disabled={saving} onToggle={() => form.is_active = !form.is_active}/>
    </div>
  </form>
  <svelte:fragment slot="footer">
    <Button variant="secondary" disabled={saving} on:click={() => showForm = false} className="sm:flex-1">{copy.cancel}</Button>
    <Button type="submit" form="facility-form" loading={saving} className="sm:flex-1">{copy.save}</Button>
  </svelte:fragment>
</Modal>

{#if archiveTarget}
  <Modal open title={copy.archiveTitle} closeDisabled={saving} on:close={() => archiveTarget = null}>
    <p class="font-semibold text-text">{archiveTarget.name}</p>
    <p class="mt-2 text-sm leading-6 text-text-secondary">{copy.archiveHint}</p>
    <label class="mt-5 block text-sm font-medium text-text-secondary">{copy.reason}<select bind:value={archiveReason} disabled={saving} class="uneem-field mt-2">{#each archiveReasons as item}<option value={item.value}>{ar ? item.ar : item.en}</option>{/each}</select></label>
    <svelte:fragment slot="footer">
      <Button variant="secondary" disabled={saving} on:click={() => archiveTarget = null} className="sm:flex-1">{copy.keep}</Button>
      <Button variant="danger" loading={saving} on:click={archive} className="sm:flex-1">{copy.confirmArchive}</Button>
    </svelte:fragment>
  </Modal>
{/if}

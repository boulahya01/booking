<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import { language, uiState } from '$lib/stores/ui'
  import { refreshNotifications } from '$lib/stores/notifications'
  import Toggle from '$lib/components/Toggle.svelte'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'

  type Announcement = {
    id: string
    title_en: string
    title_ar: string
    body_en: string
    body_ar: string
    published_at: string
    expires_at: string | null
    is_active: boolean
    created_at: string
  }

  let announcements: Announcement[] = []
  let loading = true
  let error = ''
  let showForm = false
  let editingId: string | null = null
  let saving = false
  let updatingId = ''
  let form = { title_en:'', title_ar:'', body_en:'', body_ar:'', published_at:'', expires_at:'', is_active:true }

  $: ar = $language === 'ar'
  $: copy = ar ? {
    title:'الإعلانات', subtitle:'رسائل قصيرة للطلبة.', add:'إعلان جديد', edit:'تعديل الإعلان', create:'إعلان جديد', enTitle:'العنوان بالإنجليزية', arTitle:'العنوان بالعربية', enBody:'النص بالإنجليزية', arBody:'النص بالعربية', publish:'النشر', expiry:'ينتهي', active:'مفعّل', save:'حفظ', cancel:'إلغاء', empty:'لا توجد إعلانات', archived:'مؤرشف', archive:'أرشفة', activate:'تفعيل', loadError:'تعذر تحميل الإعلانات.', saveError:'تعذر حفظ الإعلان.', required:'أضف العنوان والنص باللغتين.', noExpiry:'بدون انتهاء'
  } : {
    title:'Announcements', subtitle:'Short updates for students.', add:'New announcement', edit:'Edit announcement', create:'New announcement', enTitle:'English title', arTitle:'Arabic title', enBody:'English message', arBody:'Arabic message', publish:'Publish', expiry:'Expires', active:'Active', save:'Save', cancel:'Cancel', empty:'No announcements yet', archived:'Archived', archive:'Archive', activate:'Activate', loadError:'Couldn’t load announcements.', saveError:'Couldn’t save announcement.', required:'Add the title and message in both languages.', noExpiry:'No expiry'
  }

  onMount(load)

  function toLocalInput(value: string | null) {
    if (!value) return ''
    const date = new Date(value)
    const offset = date.getTimezoneOffset()
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0,16)
  }

  async function load() {
    loading = true
    error = ''
    const { data, error: err } = await supabase.from('announcements').select('id,title_en,title_ar,body_en,body_ar,published_at,expires_at,is_active,created_at').order('published_at',{ascending:false})
    if (err) error = copy.loadError
    else announcements = (data || []) as Announcement[]
    loading = false
  }

  function openCreate() {
    editingId = null
    form = { title_en:'', title_ar:'', body_en:'', body_ar:'', published_at:toLocalInput(new Date().toISOString()), expires_at:'', is_active:true }
    error = ''
    showForm = true
  }

  function openEdit(item: Announcement) {
    editingId = item.id
    form = { title_en:item.title_en, title_ar:item.title_ar, body_en:item.body_en, body_ar:item.body_ar, published_at:toLocalInput(item.published_at), expires_at:toLocalInput(item.expires_at), is_active:item.is_active }
    error = ''
    showForm = true
  }

  async function save() {
    if (saving) return
    error = ''
    if (![form.title_en,form.title_ar,form.body_en,form.body_ar].every((value) => value.trim())) { error = copy.required; return }
    if (form.expires_at && new Date(form.expires_at) <= new Date(form.published_at || Date.now())) { error = ar ? 'وقت الانتهاء يجب أن يكون بعد النشر.' : 'Expiry must be after publication.'; return }
    saving = true
    try {
      const payload = {
        title_en:form.title_en.trim(), title_ar:form.title_ar.trim(), body_en:form.body_en.trim(), body_ar:form.body_ar.trim(),
        published_at:form.published_at ? new Date(form.published_at).toISOString() : new Date().toISOString(),
        expires_at:form.expires_at ? new Date(form.expires_at).toISOString() : null,
        is_active:form.is_active
      }
      if (editingId) {
        const { error: err } = await supabase.from('announcements').update(payload).eq('id',editingId)
        if (err) throw err
      } else {
        const { data:{ user } } = await supabase.auth.getUser()
        if (!user) throw new Error('auth_required')
        const { error: err } = await supabase.from('announcements').insert([{...payload,created_by:user.id}])
        if (err) throw err
      }
      showForm = false
      uiState.addToast(ar ? 'تم حفظ الإعلان' : 'Announcement saved', 'success')
      void refreshNotifications(true)
      await load()
    } catch {
      error = copy.saveError
    } finally { saving = false }
  }

  async function setActive(item: Announcement, active: boolean) {
    if (updatingId) return
    updatingId = item.id
    try {
      const { error: err } = await supabase.from('announcements').update({is_active:active}).eq('id',item.id)
      if (err) throw err
      announcements = announcements.map((row) => row.id === item.id ? {...row,is_active:active} : row)
      uiState.addToast(active ? (ar ? 'تم التفعيل' : 'Announcement activated') : (ar ? 'تمت الأرشفة' : 'Announcement archived'), 'success')
      void refreshNotifications(true)
    } catch { uiState.addToast(copy.saveError, 'error') }
    finally { updatingId = '' }
  }

  function announcementState(item: Announcement) {
    if (!item.is_active) return copy.archived
    if (new Date(item.published_at).getTime() > Date.now()) return ar ? 'مجدول' : 'Scheduled'
    if (item.expires_at && new Date(item.expires_at).getTime() <= Date.now()) return ar ? 'منتهي' : 'Expired'
    return ar ? 'منشور' : 'Published'
  }

</script>

<svelte:head><title>{copy.title} · UNEEM Admin</title></svelte:head>

<main class="uneem-page max-w-6xl">
  <header class="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 class="uneem-title">{copy.title}</h1><p class="uneem-subtitle">{copy.subtitle}</p></div>
    {#if !showForm}<Button on:click={openCreate} className="w-full sm:w-auto"><Icon name="plus" size={18}/>{copy.add}</Button>{/if}
  </header>

  {#if error && !showForm}<div class="mb-4 rounded-2xl bg-danger-light px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</div>{/if}

  {#if showForm}
    <form on:submit|preventDefault={save} class="uneem-panel mb-6 overflow-hidden">
      <div class="flex min-h-16 items-center justify-between gap-4 px-5 pt-3 sm:px-6"><h2 class="font-bold text-text">{editingId ? copy.edit : copy.create}</h2><button type="button" disabled={saving} aria-label={copy.cancel} on:click={() => showForm=false} class="uneem-icon-button shrink-0"><Icon name="x" size={18}/></button></div>
      <div class="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <TextField label={copy.enTitle} bind:value={form.title_en} disabled={saving} required/><TextField label={copy.arTitle} bind:value={form.title_ar} disabled={saving} required/>
        <div><label class="text-sm font-medium text-text-secondary" for="body-en">{copy.enBody}</label><textarea id="body-en" bind:value={form.body_en} rows="4" required disabled={saving} dir="ltr" class="uneem-field mt-2 resize-y"></textarea></div>
        <div><label class="text-sm font-medium text-text-secondary" for="body-ar">{copy.arBody}</label><textarea id="body-ar" bind:value={form.body_ar} rows="4" required disabled={saving} dir="rtl" class="uneem-field mt-2 resize-y"></textarea></div>
        <div><label class="text-sm font-medium text-text-secondary" for="published-at">{copy.publish}</label><input id="published-at" type="datetime-local" disabled={saving} bind:value={form.published_at} class="uneem-field mt-2"/></div>
        <div><label class="text-sm font-medium text-text-secondary" for="expires-at">{copy.expiry}</label><input id="expires-at" type="datetime-local" disabled={saving} bind:value={form.expires_at} class="uneem-field mt-2"/></div>
      </div>
      <div class="mx-5 mb-5 rounded-2xl bg-surface-level-1 p-4 sm:mx-6"><Toggle checked={form.is_active} disabled={saving} onToggle={() => form.is_active=!form.is_active} label={copy.active}/></div>
      {#if error}<p class="mx-5 mb-4 rounded-xl bg-danger-light p-4 text-sm text-danger sm:mx-6" role="alert">{error}</p>{/if}
      <div class="flex flex-col-reverse gap-3 px-5 pb-5 sm:flex-row sm:justify-end sm:px-6 sm:pb-6"><Button variant="secondary" size="lg" className="flex-1 sm:flex-none sm:min-w-28" disabled={saving} on:click={() => showForm=false}>{copy.cancel}</Button><Button size="lg" className="flex-1 sm:flex-none sm:min-w-28" loading={saving} type="submit">{copy.save}</Button></div>
    </form>
  {/if}

  {#if loading}
    <div class="space-y-3" aria-busy="true">{#each [1,2,3] as _}<div class="h-28 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}</div>
  {:else if announcements.length===0 && !error}
    <section class="uneem-empty"><div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-text-muted"><Icon name="bell" size={22}/></div><p class="mt-3 font-bold text-text">{copy.empty}</p><button on:click={openCreate} class="mt-3 min-h-10 text-sm font-bold text-primary">{copy.add}</button></section>
  {:else}
    <div class="grid gap-4 lg:grid-cols-2">
      {#each announcements as item (item.id)}
        <article class="uneem-card flex min-w-0 flex-col">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <p class="mb-2 text-xs font-medium text-text-muted">{announcementState(item)}</p>
              <h2 class="break-words text-lg font-semibold leading-6 text-text">{ar ? item.title_ar : item.title_en}</h2>
            </div>
            <button disabled={saving} on:click={() => openEdit(item)} aria-label={`${copy.edit}: ${ar ? item.title_ar : item.title_en}`} class="uneem-icon-button shrink-0 bg-surface-level-1"><Icon name="edit" size={18}/></button>
          </div>
          <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{ar ? item.body_ar : item.body_en}</p>
          <dl class="my-5 grid grid-cols-2 gap-4 rounded-2xl bg-surface-level-1 p-4 text-xs">
            <div class="min-w-0"><dt class="text-text-muted">{copy.publish}</dt><dd class="mt-1 font-medium leading-5 text-text-secondary"><time datetime={item.published_at}>{new Date(item.published_at).toLocaleString(ar ? 'ar-MA' : 'en', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></dd></div>
            <div class="min-w-0"><dt class="text-text-muted">{copy.expiry}</dt><dd class="mt-1 font-medium leading-5 text-text-secondary">{item.expires_at ? new Date(item.expires_at).toLocaleString(ar ? 'ar-MA' : 'en', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : copy.noExpiry}</dd></div>
          </dl>
          <div class="mt-auto"><Toggle checked={item.is_active} disabled={!!updatingId} label={copy.active} onToggle={() => void setActive(item, !item.is_active)}/></div>
        </article>
      {/each}
    </div>
  {/if}
</main>

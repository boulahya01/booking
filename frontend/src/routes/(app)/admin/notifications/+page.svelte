<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabaseClient'
  import { language, uiState } from '$lib/stores/ui'
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
  let form = { title_en:'', title_ar:'', body_en:'', body_ar:'', published_at:'', expires_at:'', is_active:true }

  $: ar = $language === 'ar'
  $: copy = ar ? {
    title:'الإعلانات', subtitle:'رسائل قصيرة للطلبة.', add:'إعلان جديد', edit:'تعديل الإعلان', create:'إعلان جديد', enTitle:'العنوان بالإنجليزية', arTitle:'العنوان بالعربية', enBody:'النص بالإنجليزية', arBody:'النص بالعربية', publish:'النشر', expiry:'ينتهي', active:'مفعّل', save:'حفظ', cancel:'إلغاء', empty:'ما كاين حتى إعلان', archived:'مؤرشف', archive:'أرشفة', activate:'تفعيل', loadError:'تعذر تحميل الإعلانات.', saveError:'تعذر حفظ الإعلان.', required:'أضف العنوان والنص باللغتين.', noExpiry:'بدون انتهاء'
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
    error = ''
    if (![form.title_en,form.title_ar,form.body_en,form.body_ar].every((value) => value.trim())) { error = copy.required; return }
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
      await load()
    } catch {
      error = copy.saveError
    } finally { saving = false }
  }

  async function setActive(item: Announcement, active: boolean) {
    const { error: err } = await supabase.from('announcements').update({is_active:active}).eq('id',item.id)
    if (err) { uiState.addToast(copy.saveError,'error'); return }
    announcements = announcements.map((row) => row.id===item.id ? {...row,is_active:active} : row)
    uiState.addToast(active ? (ar?'تم التفعيل':'Announcement activated') : (ar?'تمت الأرشفة':'Announcement archived'),'success')
  }
</script>

<svelte:head><title>{copy.title} · UNEEM Admin</title></svelte:head>

<main class="uneem-page max-w-6xl">
  <header class="uneem-page-header">
    <div><p class="uneem-kicker">Admin</p><h1 class="uneem-title">{copy.title}</h1><p class="uneem-subtitle">{copy.subtitle}</p></div>
    {#if !showForm}<button on:click={openCreate} class="uneem-primary-action min-h-11 shrink-0 px-4 text-sm"><Icon name="plus" size={17}/>{copy.add}</button>{/if}
  </header>

  {#if error}<div class="mb-4 rounded-2xl bg-danger-light px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</div>{/if}

  {#if showForm}
    <section class="uneem-panel mb-6 overflow-hidden">
      <div class="flex min-h-14 items-center justify-between border-b border-border-light px-4 sm:px-5"><h2 class="font-bold text-text">{editingId ? copy.edit : copy.create}</h2><button on:click={() => showForm=false} class="grid h-10 w-10 place-items-center rounded-full text-text-muted hover:bg-surface-level-1"><Icon name="x" size={18}/></button></div>
      <div class="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <TextField label={copy.enTitle} bind:value={form.title_en}/><TextField label={copy.arTitle} bind:value={form.title_ar}/>
        <div><label class="text-sm font-bold text-text" for="body-en">{copy.enBody}</label><textarea id="body-en" bind:value={form.body_en} rows="4" class="uneem-field mt-2 resize-none"></textarea></div>
        <div><label class="text-sm font-bold text-text" for="body-ar">{copy.arBody}</label><textarea id="body-ar" bind:value={form.body_ar} rows="4" dir="rtl" class="uneem-field mt-2 resize-none"></textarea></div>
        <div><label class="text-sm font-bold text-text" for="published-at">{copy.publish}</label><input id="published-at" type="datetime-local" bind:value={form.published_at} class="uneem-field mt-2"/></div>
        <div><label class="text-sm font-bold text-text" for="expires-at">{copy.expiry}</label><input id="expires-at" type="datetime-local" bind:value={form.expires_at} class="uneem-field mt-2"/></div>
      </div>
      <div class="mx-4 mb-4 rounded-[18px] bg-surface-level-1 p-4 sm:mx-5 sm:mb-5"><Toggle checked={form.is_active} onToggle={() => form.is_active=!form.is_active} label={copy.active}/></div>
      <div class="flex gap-3 border-t border-border-light p-4 sm:justify-end sm:p-5"><Button variant="secondary" size="lg" className="flex-1 sm:flex-none sm:min-w-28" disabled={saving} on:click={() => showForm=false}>{copy.cancel}</Button><Button size="lg" className="flex-1 sm:flex-none sm:min-w-28" loading={saving} on:click={save}>{copy.save}</Button></div>
    </section>
  {/if}

  {#if loading}
    <div class="space-y-3" aria-busy="true">{#each [1,2,3] as _}<div class="h-28 animate-pulse rounded-[22px] bg-surface-level-1"></div>{/each}</div>
  {:else if announcements.length===0}
    <section class="uneem-empty"><div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-text-muted"><Icon name="bell" size={22}/></div><p class="mt-3 font-bold text-text">{copy.empty}</p><button on:click={openCreate} class="mt-3 min-h-10 text-sm font-bold text-primary">{copy.add}</button></section>
  {:else}
    <div class="space-y-3">
      {#each announcements as item (item.id)}
        <article class="uneem-card" class:opacity-60={!item.is_active}>
          <div class="flex items-start justify-between gap-4"><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><h2 class="truncate font-bold text-text">{ar ? item.title_ar : item.title_en}</h2>{#if !item.is_active}<span class="rounded-full bg-surface-level-1 px-2 py-0.5 text-[10px] font-bold text-text-muted">{copy.archived}</span>{/if}</div><p class="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">{ar ? item.body_ar : item.body_en}</p><p class="mt-2 text-xs text-text-muted">{new Date(item.published_at).toLocaleString(ar?'ar-MA':'en')} · {item.expires_at ? new Date(item.expires_at).toLocaleDateString(ar?'ar-MA':'en') : copy.noExpiry}</p></div><button on:click={() => openEdit(item)} class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-level-1 hover:text-text"><Icon name="edit" size={17}/></button></div>
          <div class="mt-3 border-t border-border-light pt-3"><button on:click={() => setActive(item,!item.is_active)} class={`min-h-10 text-sm font-bold ${item.is_active ? 'text-danger' : 'text-success'}`}>{item.is_active ? copy.archive : copy.activate}</button></div>
        </article>
      {/each}
    </div>
  {/if}
</main>

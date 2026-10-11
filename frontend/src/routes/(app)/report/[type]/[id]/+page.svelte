<script lang="ts">
  import { page } from '$app/stores'
  import { language } from '$lib/stores/ui'
  import { createMyReport, type ReportReason, type ReportTargetType } from '$lib/reportApi'
  import Button from '$lib/components/Button.svelte'
  import ActionLink from '$lib/components/ActionLink.svelte'
  import Icon from '$lib/components/Icon.svelte'

  const validTargets: ReportTargetType[] = ['user', 'match', 'booking', 'facility', 'other']
  const reasons: Array<{ value: ReportReason; en: string; ar: string; targets?: ReportTargetType[] }> = [
    { value:'harassment', en:'Harassment or abuse', ar:'مضايقة أو إساءة', targets:['user','match'] },
    { value:'unsafe_behavior', en:'Unsafe behavior', ar:'سلوك غير آمن', targets:['user','match','facility'] },
    { value:'spam', en:'Spam or misuse', ar:'إزعاج أو سوء استخدام', targets:['user','match'] },
    { value:'fake_identity', en:'Identity concern', ar:'مشكلة في الهوية', targets:['user'] },
    { value:'booking_issue', en:'Booking problem', ar:'مشكلة في الحجز', targets:['booking'] },
    { value:'match_issue', en:'Match problem', ar:'مشكلة في المباراة', targets:['match'] },
    { value:'facility_issue', en:'Facility problem', ar:'مشكلة في المرفق', targets:['facility'] },
    { value:'other', en:'Something else', ar:'سبب آخر' }
  ]
  let reason: ReportReason = 'other'
  let details = ''
  let submitting = false
  let error = ''
  let sent = false
  $: ar = $language === 'ar'
  $: targetId = $page.params.id
  $: targetType = (validTargets.includes($page.params.type as ReportTargetType) ? $page.params.type : 'other') as ReportTargetType
  $: availableReasons = reasons.filter(item => !item.targets || item.targets.includes(targetType))
  $: if (!availableReasons.some(item => item.value === reason)) reason = availableReasons[0].value
  $: backHref = targetType === 'booking' ? `/bookings/${targetId}` : targetType === 'match' ? `/matches/${targetId}` : targetType === 'facility' ? `/pitch/${targetId}` : '/menu'

  async function submitReport() {
    if (!details.trim() || submitting || !targetId) return
    submitting = true
    error = ''
    try { await createMyReport({ targetType, targetId, reason, body:details.trim() }); sent = true; details = '' }
    catch (e) { error = e instanceof Error ? e.message : (ar ? 'تعذر إرسال البلاغ. حاول مجدداً.' : 'Couldn’t send the report. Try again.') }
    finally { submitting = false }
  }
</script>

<svelte:head><title>{ar ? 'الإبلاغ عن مشكلة' : 'Report a problem'} · UNEEM</title></svelte:head>
<div class="uneem-page-narrow !max-w-xl">
  <a href={backHref} class="uneem-text-action mb-6"><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={18}/>{ar ? 'رجوع' : 'Back'}</a>
  <h1 class="uneem-title">{ar ? 'الإبلاغ عن مشكلة' : 'Report a problem'}</h1>
  <p class="mb-7 mt-3 text-sm leading-6 text-text-secondary">{ar ? 'يطلع فريق UNEEM فقط على بلاغك.' : 'Only the UNEEM team can see your report.'}</p>
  {#if sent}
    <section class="rounded-[22px] bg-surface p-6 text-center" role="status">
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-light text-success"><Icon name="check" size={25}/></div>
      <h2 class="mt-5 text-xl font-semibold">{ar ? 'تم إرسال البلاغ' : 'Report sent'}</h2>
      <p class="mb-6 mt-2 text-sm text-text-secondary">{ar ? 'سيراجعه فريقنا.' : 'Our team will review it.'}</p>
      <ActionLink href={backHref} variant="primary" fullWidth>{ar ? 'متابعة' : 'Continue'}</ActionLink>
    </section>
  {:else}
    <form on:submit|preventDefault={submitReport} class="space-y-5">
      {#if error}<p class="rounded-2xl bg-danger-light p-4 text-sm text-danger" role="alert">{error}</p>{/if}
      <label class="block"><span class="text-sm font-medium text-text-secondary">{ar ? 'ماذا حدث؟' : 'What happened?'}</span><select bind:value={reason} disabled={submitting} class="uneem-field mt-2">{#each availableReasons as item}<option value={item.value}>{ar ? item.ar : item.en}</option>{/each}</select></label>
      <label class="block"><span class="text-sm font-medium text-text-secondary">{ar ? 'التفاصيل' : 'Details'}</span><textarea bind:value={details} disabled={submitting} required rows="5" maxlength="4000" class="uneem-field mt-2 resize-y" placeholder={ar ? 'صف المشكلة لمساعدة فريقنا.' : 'Describe the problem for our team.'}></textarea></label>
      <p class="text-xs leading-5 text-text-muted">{ar ? 'لا ترفق كلمات مرور أو صور بطاقة الطالب.' : 'Leave out passwords and student-card images.'}</p>
      <Button type="submit" fullWidth size="lg" loading={submitting} disabled={!details.trim()}>{ar ? 'إرسال البلاغ' : 'Send report'}</Button>
    </form>
  {/if}
</div>

<script lang="ts">
  import { page } from '$app/stores'
  import { language } from '$lib/stores/ui'
  import Icon from '$lib/components/Icon.svelte'

  $: status = $page.status
  $: ar = $language === 'ar'
  $: isNotFound = status === 404
</script>

<svelte:head><title>{isNotFound ? (ar ? 'الصفحة غير موجودة' : 'Page not found') : (ar ? 'حدث خطأ' : 'Something went wrong')} · UNEEM</title></svelte:head>

<main class="grid min-h-screen place-items-center bg-background px-5 py-10">
  <section class="w-full max-w-sm text-center">
    <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-light text-danger">
      <Icon name={isNotFound ? 'search' : 'alert-circle'} size={24} />
    </div>
    <p class="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-text-muted">{status}</p>
    <h1 class="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-text">
      {isNotFound ? (ar ? 'الصفحة غير موجودة' : 'Page not found') : (ar ? 'تعذر فتح الصفحة' : 'Couldn’t open this page')}
    </h1>
    <p class="mt-2 text-sm leading-6 text-text-secondary">
      {isNotFound ? (ar ? 'تأكد من الرابط أو ارجع للرئيسية.' : 'Check the link or go back home.') : (ar ? 'حاول مرة أخرى.' : 'Try again.')}
    </p>
    <div class="mt-6 grid gap-2.5">
      <a href="/home" class="uneem-primary-action">{ar ? 'الرئيسية' : 'Go home'}</a>
      <button on:click={() => window.location.reload()} class="uneem-secondary-action">{ar ? 'إعادة المحاولة' : 'Try again'}</button>
    </div>
  </section>
</main>

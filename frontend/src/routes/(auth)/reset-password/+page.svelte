<script lang="ts">
  import { goto } from '$app/navigation'
  import { updatePassword } from '$lib/auth'
  import { uiState, language } from '$lib/stores/ui'
  import { isValidPassword } from '$lib/utils/cn'
  import TextField from '$lib/components/TextField.svelte'
  import Button from '$lib/components/Button.svelte'
  import Icon from '$lib/components/Icon.svelte'

  let newPassword = ''
  let confirmPassword = ''
  let loading = false
  let error = ''
  let complete = false

  $: copy = $language === 'ar'
    ? {
        title: 'عيّن كلمة مرور جديدة',
        subtitle: 'اختر كلمة مرور قوية ومختلفة عن التي كنت تستخدمها سابقاً.',
        password: 'كلمة المرور الجديدة',
        confirm: 'تأكيد كلمة المرور',
        help: 'استخدم 8 أحرف على الأقل مع رقم ورمز.',
        update: 'تحديث كلمة المرور',
        required: 'أدخل كلمة المرور الجديدة وأكدها.',
        mismatch: 'كلمتا المرور غير متطابقتين.',
        invalid: 'استخدم 8 أحرف على الأقل مع رقم ورمز.',
        generic: 'تعذر تحديث كلمة المرور. قد يكون رابط الاسترجاع منتهياً؛ اطلب رابطاً جديداً أو تواصل مع الدعم.',
        doneTitle: 'تم تحديث كلمة المرور',
        doneBody: 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
        signIn: 'تسجيل الدخول',
        newLink: 'طلب رابط جديد',
        support: 'المساعدة'
      }
    : {
        title: 'Set a new password',
        subtitle: 'Choose a strong password that you have not used for this account before.',
        password: 'New password',
        confirm: 'Confirm password',
        help: 'Use at least 8 characters with a number and symbol.',
        update: 'Update password',
        required: 'Enter and confirm your new password.',
        mismatch: 'Passwords do not match.',
        invalid: 'Use at least 8 characters with a number and symbol.',
        generic: 'We could not update your password. The recovery link may have expired; request a new link or contact support.',
        doneTitle: 'Password updated',
        doneBody: 'You can now sign in with your new password.',
        signIn: 'Sign in',
        newLink: 'Request a new link',
        support: 'Help'
      }

  function toggleLanguage() {
    uiState.setLanguage($language === 'en' ? 'ar' : 'en')
  }

  async function handleReset() {
    error = ''
    if (!newPassword || !confirmPassword) {
      error = copy.required
      return
    }
    if (newPassword !== confirmPassword) {
      error = copy.mismatch
      return
    }
    if (!isValidPassword(newPassword)) {
      error = copy.invalid
      return
    }

    loading = true
    try {
      const result = await updatePassword(newPassword)
      if (result.error) {
        error = copy.generic
        return
      }
      complete = true
      uiState.addToast(copy.doneTitle, 'success')
    } catch {
      error = copy.generic
    } finally {
      loading = false
    }
  }

  async function signIn() {
    await goto('/login')
  }
</script>

<svelte:head>
  <title>{complete ? copy.doneTitle : copy.title} · UNEEM</title>
</svelte:head>

<div class="min-h-screen bg-background px-4 py-8 flex items-center justify-center">
  <button
    type="button"
    on:click={toggleLanguage}
    class="fixed top-4 right-4 z-50 min-w-11 h-11 px-3 rounded-full bg-surface border border-border text-sm font-semibold text-text-secondary hover:text-text transition"
    aria-label="Toggle language"
  >
    {$language === 'ar' ? 'EN' : 'ع'}
  </button>

  <main class="w-full max-w-md">
    <section class="ui-panel p-6 sm:p-7 space-y-6">
      <div class="space-y-4">
        <div class={`w-12 h-12 rounded-2xl flex items-center justify-center ${complete ? 'bg-success-light text-success' : 'bg-primary/10 text-primary'}`}>
          <Icon name={complete ? 'check-circle' : 'key'} size={24} />
        </div>
        <div>
          <h1 class="text-3xl font-semibold tracking-tight text-text">{complete ? copy.doneTitle : copy.title}</h1>
          <p class="mt-2 text-text-secondary leading-relaxed">{complete ? copy.doneBody : copy.subtitle}</p>
        </div>
      </div>

      {#if error}
        <div class="rounded-2xl bg-danger-light p-4 text-sm text-danger leading-relaxed" role="alert">{error}</div>
      {/if}

      {#if complete}
        <Button on:click={signIn} variant="primary" size="lg" className="w-full">{copy.signIn}</Button>
      {:else}
        <form on:submit|preventDefault={handleReset} class="space-y-5">
          <div class="space-y-2">
            <TextField
              label={copy.password}
              type="password"
              bind:value={newPassword}
              disabled={loading}
              required
            />
            <p class="text-xs text-text-muted px-1">{copy.help}</p>
          </div>
          <TextField
            label={copy.confirm}
            type="password"
            bind:value={confirmPassword}
            disabled={loading}
            required
          />
          <Button type="submit" variant="primary" size="lg" {loading} className="w-full">{copy.update}</Button>
        </form>
      {/if}

      <div class="pt-1 flex flex-wrap items-center justify-center gap-4 text-sm font-semibold">
        {#if !complete}
          <a href="/forgot-password" class="text-primary hover:underline">{copy.newLink}</a>
          <span class="text-border">•</span>
        {/if}
        <a href="/help" class="text-text-secondary hover:text-text">{copy.support}</a>
      </div>
    </section>
  </main>
</div>

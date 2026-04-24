<script lang="ts">
  import NeonCard from '$lib/components/NeonCard.svelte'
  import NeonButton from '$lib/components/NeonButton.svelte'
  import TextField from '$lib/components/NeonTextField.svelte'
  import { supabase } from '$lib/supabaseClient'
  import { setUser } from '$lib/stores/auth'
  import { LoginEmailSchema, LoginStudentSchema, sanitizeInput, sanitizeStudentId } from '$lib/validation'
  import { apiFetch } from '$lib/api'
  import { goto } from '$app/navigation'

  let mode: 'email' | 'student' = 'email'
  let email = ''
  let password = ''
  let studentId = ''
  let error = ''
  let loading = false

  async function submit() {
    error = ''
    loading = true
    try {
      if (mode === 'email') {
        LoginEmailSchema.parse({ email, password })
        const res = await supabase.auth.signInWithPassword({ email: sanitizeInput(email), password })
        if (res.error) {
          error = res.error.message
          return
        }
        setUser(res.data.user as any)
        await goto('/home')
      } else {
        LoginStudentSchema.parse({ student_id: studentId })
        const resp = await apiFetch(`/api/login-by-student-id?student_id=${encodeURIComponent(sanitizeStudentId(studentId))}`)
        setUser(resp.user)
        await goto('/home')
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      loading = false
    }
  }
</script>

<NeonCard>
  <form on:submit|preventDefault={submit} class="max-w-md mx-auto p-4">
    <label>
      <select bind:value={mode} class="mb-4">
        <option value="email">Email</option>
        <option value="student">Student ID</option>
      </select>
    </label>

    {#if mode === 'email'}
      <TextField label="Email" type="email" bind:value={email} placeholder="Email" required />
      <TextField label="Password" type="password" bind:value={password} placeholder="Password" required />
    {:else}
      <TextField label="Student ID" bind:value={studentId} placeholder="Student ID" required />
    {/if}

    <div style="margin-top:1rem">
      <NeonButton type="submit" disabled={loading}>{loading ? 'Please wait...' : 'Sign in'}</NeonButton>
    </div>

    {#if error}
      <p class="text-red-600 mt-2">{error}</p>
    {/if}
  </form>
</NeonCard>

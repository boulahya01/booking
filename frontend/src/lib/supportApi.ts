import { supabase } from '$lib/supabaseClient'

export type SupportKind = 'support' | 'appeal' | 'report'
export type SupportStatus = 'open' | 'waiting' | 'resolved'

export type SupportMessage = {
  id: string
  sender_role: 'user' | 'guest' | 'admin'
  body: string
  created_at: string
}

export type SupportThread = {
  id: string
  kind: SupportKind
  status: SupportStatus
  subject: string | null
  created_at: string
  messages: SupportMessage[]
}

function normalizeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (message.includes('invalid_support_message')) return new Error('Write a short message before sending.')
  if (message.includes('invalid_contact_email')) return new Error('Check the contact email and try again.')
  if (message.includes('support_thread_not_found')) return new Error('This support conversation can no longer be opened from this device.')
  return new Error('Support is temporarily unavailable. Please try again.')
}

export async function createAuthenticatedSupportThread(input: {
  kind: SupportKind
  subject?: string
  body: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_my_support_thread', {
    p_kind: input.kind,
    p_subject: input.subject ?? '',
    p_body: input.body
  })
  if (error) throw normalizeError(error)
  return data as string
}

export async function createGuestSupportThread(input: {
  contactEmail?: string
  subject?: string
  body: string
}): Promise<{ threadId: string; accessToken: string }> {
  const { data, error } = await supabase.rpc('create_guest_support_thread', {
    p_contact_email: input.contactEmail ?? '',
    p_subject: input.subject ?? '',
    p_body: input.body
  })
  if (error) throw normalizeError(error)

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.thread_id || !row?.access_token) throw new Error('Support is temporarily unavailable. Please try again.')
  return { threadId: row.thread_id, accessToken: row.access_token }
}

export async function getGuestSupportThread(accessToken: string): Promise<SupportThread | null> {
  const { data, error } = await supabase.rpc('get_guest_support_thread', { p_access_token: accessToken })
  if (error) throw normalizeError(error)
  if (!Array.isArray(data) || data.length === 0) return null

  const first = data[0]
  return {
    id: first.thread_id,
    kind: first.kind,
    status: first.status,
    subject: first.subject,
    created_at: first.created_at,
    messages: data.map((row: any) => ({
      id: row.message_id,
      sender_role: row.sender_role,
      body: row.body,
      created_at: row.message_created_at
    }))
  }
}

export async function addGuestSupportMessage(accessToken: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('add_guest_support_message', {
    p_access_token: accessToken,
    p_body: body
  })
  if (error) throw normalizeError(error)
}

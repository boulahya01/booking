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
  updated_at?: string
  messages: SupportMessage[]
}

export type SupportThreadSummary = {
  id: string
  user_id: string | null
  contact_email: string | null
  kind: SupportKind
  status: SupportStatus
  subject: string | null
  created_at: string
  updated_at: string
  message_count: number
  last_message_at: string | null
}

export type MySupportThreadSummary = Pick<
  SupportThread,
  'id' | 'kind' | 'status' | 'subject' | 'created_at'
> & {
  updated_at: string
  last_message: SupportMessage | null
}

function normalizeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (message.includes('invalid_support_message')) return new Error('Write a short message before sending.')
  if (message.includes('invalid_contact_email')) return new Error('Check the contact email and try again.')
  if (message.includes('support_thread_not_found')) return new Error('This support conversation is no longer available.')
  if (message.includes('admin_required')) return new Error('You do not have permission to manage support conversations.')
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

export async function listMySupportThreads(): Promise<MySupportThreadSummary[]> {
  const { data: threads, error } = await supabase
    .from('support_threads')
    .select('id, kind, status, subject, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(30)

  if (error) throw normalizeError(error)
  if (!threads?.length) return []

  const ids = threads.map((thread) => thread.id)
  const { data: messages, error: messagesError } = await supabase
    .from('support_messages')
    .select('id, thread_id, sender_role, body, created_at')
    .in('thread_id', ids)
    .order('created_at', { ascending: false })

  if (messagesError) throw normalizeError(messagesError)

  const latestByThread = new Map<string, SupportMessage>()
  for (const row of messages ?? []) {
    if (!latestByThread.has(row.thread_id)) {
      latestByThread.set(row.thread_id, {
        id: row.id,
        sender_role: row.sender_role as SupportMessage['sender_role'],
        body: row.body,
        created_at: row.created_at
      })
    }
  }

  return threads.map((thread) => ({
    id: thread.id,
    kind: thread.kind as SupportKind,
    status: thread.status as SupportStatus,
    subject: thread.subject,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
    last_message: latestByThread.get(thread.id) ?? null
  }))
}

export async function getMySupportThread(threadId: string): Promise<SupportThread | null> {
  const { data: thread, error } = await supabase
    .from('support_threads')
    .select('id, kind, status, subject, created_at, updated_at')
    .eq('id', threadId)
    .maybeSingle()

  if (error) throw normalizeError(error)
  if (!thread) return null

  const { data: messages, error: messagesError } = await supabase
    .from('support_messages')
    .select('id, sender_role, body, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (messagesError) throw normalizeError(messagesError)

  return {
    id: thread.id,
    kind: thread.kind as SupportKind,
    status: thread.status as SupportStatus,
    subject: thread.subject,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
    messages: (messages ?? []).map((row) => ({
      id: row.id,
      sender_role: row.sender_role as SupportMessage['sender_role'],
      body: row.body,
      created_at: row.created_at
    }))
  }
}

export async function addAuthenticatedSupportMessage(threadId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('add_my_support_message', {
    p_thread_id: threadId,
    p_body: body
  })
  if (error) throw normalizeError(error)
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

export async function listAdminSupportThreads(status: SupportStatus | null = null): Promise<SupportThreadSummary[]> {
  const { data, error } = await supabase.rpc('admin_list_support_threads', {
    p_status: status,
    p_limit: 50
  })
  if (error) throw normalizeError(error)
  return (data ?? []) as SupportThreadSummary[]
}

export async function getAdminSupportMessages(threadId: string): Promise<SupportMessage[]> {
  const { data, error } = await supabase.rpc('admin_get_support_messages', { p_thread_id: threadId })
  if (error) throw normalizeError(error)
  return (data ?? []) as SupportMessage[]
}

export async function adminReplySupportThread(
  threadId: string,
  body: string,
  nextStatus: SupportStatus = 'waiting'
): Promise<void> {
  const { error } = await supabase.rpc('admin_reply_support_thread', {
    p_thread_id: threadId,
    p_body: body,
    p_next_status: nextStatus
  })
  if (error) throw normalizeError(error)
}

export async function adminSetSupportStatus(threadId: string, status: SupportStatus): Promise<void> {
  const { error } = await supabase.rpc('admin_set_support_status', {
    p_thread_id: threadId,
    p_status: status
  })
  if (error) throw normalizeError(error)
}

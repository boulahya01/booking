import { supabase } from '$lib/supabaseClient'

export type SupportKind = 'support' | 'appeal' | 'report'
export type SupportStatus = 'open' | 'waiting' | 'resolved'
export type ReportTargetType = 'user' | 'match' | 'booking' | 'facility' | 'other'
export type ReportReason = 'harassment' | 'unsafe_behavior' | 'spam' | 'fake_identity' | 'booking_issue' | 'match_issue' | 'facility_issue' | 'other'

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

export type AdminSupportThreadContext = {
  id: string
  user_id: string | null
  contact_email: string | null
  kind: SupportKind
  status: SupportStatus
  subject: string | null
  target_type: ReportTargetType | null
  target_id: string | null
  reason_code: string | null
  created_at: string
  updated_at: string
}

export type MySupportThreadSummary = Pick<
  SupportThread,
  'id' | 'kind' | 'status' | 'subject' | 'created_at'
> & {
  updated_at: string
  last_message: SupportMessage | null
}

function normalizeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String((error as any)?.message ?? error ?? '')
  if (message.includes('invalid_support_message')) return new Error('Write a short message before sending.')
  if (message.includes('invalid_contact_email')) return new Error('Check the contact email and try again.')
  if (message.includes('invalid_report_target')) return new Error('Choose a valid item to report.')
  if (message.includes('invalid_report_reason')) return new Error('Choose a valid report reason.')
  if (message.includes('support_rate_limited')) return new Error('You have sent several requests recently. Try again a little later.')
  if (message.includes('support_temporarily_busy')) return new Error('Support is busy right now. Try again shortly.')
  if (message.includes('support_thread_not_found')) return new Error('This support conversation is no longer available.')
  if (message.includes('admin_required')) return new Error('You do not have permission to manage support conversations.')
  return new Error('Support is temporarily unavailable. Please try again.')
}

export async function createAuthenticatedSupportThread(input: {
  kind: Exclude<SupportKind, 'report'>
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

export async function createAuthenticatedReportThread(input: {
  targetType: ReportTargetType
  targetId: string
  reason: ReportReason
  body: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_my_report_thread', {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason_code: input.reason,
    p_body: input.body
  })
  if (error) throw normalizeError(error)
  return data as string
}

export async function listMySupportThreads(): Promise<MySupportThreadSummary[]> {
  const { data, error } = await supabase.rpc('list_my_support_threads', { p_limit: 30 })
  if (error) throw normalizeError(error)

  return (Array.isArray(data) ? data : []).map((row: any) => ({
    id: row.thread_id,
    kind: row.kind as SupportKind,
    status: row.status as SupportStatus,
    subject: row.subject,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_message: row.last_message_id
      ? {
          id: row.last_message_id,
          sender_role: row.last_sender_role as SupportMessage['sender_role'],
          body: row.last_body,
          created_at: row.last_message_at
        }
      : null
  }))
}

export async function getMySupportThread(threadId: string): Promise<SupportThread | null> {
  const { data, error } = await supabase.rpc('get_my_support_thread', {
    p_thread_id: threadId
  })

  if (error) {
    const raw = String((error as any)?.message || '')
    if (raw.includes('support_thread_not_found')) return null
    throw normalizeError(error)
  }

  if (!Array.isArray(data) || data.length === 0) return null
  const first: any = data[0]

  return {
    id: first.thread_id,
    kind: first.kind as SupportKind,
    status: first.status as SupportStatus,
    subject: first.subject,
    created_at: first.thread_created_at,
    updated_at: first.thread_updated_at,
    messages: data.map((row: any) => ({
      id: row.message_id,
      sender_role: row.sender_role as SupportMessage['sender_role'],
      body: row.body,
      created_at: row.message_created_at
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
  let response: Response
  try {
    response = await fetch('/api/support/guest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contactEmail: input.contactEmail ?? '',
        subject: input.subject ?? '',
        body: input.body
      })
    })
  } catch {
    throw new Error('Support is temporarily unavailable. Please try again.')
  }

  let payload: any = null
  try {
    payload = await response.json()
  } catch {
    // Keep network/proxy failures non-diagnostic in the public Help surface.
  }

  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Support is temporarily unavailable. Please try again.')
  }

  if (!payload?.threadId || !payload?.accessToken) {
    throw new Error('Support is temporarily unavailable. Please try again.')
  }

  return { threadId: payload.threadId, accessToken: payload.accessToken }
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

export async function getAdminSupportThreadContext(threadId: string): Promise<AdminSupportThreadContext | null> {
  const { data, error } = await supabase.rpc('admin_get_support_thread_context', { p_thread_id: threadId })
  if (error) throw normalizeError(error)
  const row = Array.isArray(data) ? data[0] : data
  return row ? (row as AdminSupportThreadContext) : null
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

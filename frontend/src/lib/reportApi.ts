import { supabase } from '$lib/supabaseClient'

export type ReportTargetType = 'user' | 'match' | 'booking' | 'facility' | 'other'
export type ReportReason =
  | 'harassment'
  | 'unsafe_behavior'
  | 'spam'
  | 'fake_identity'
  | 'booking_issue'
  | 'match_issue'
  | 'facility_issue'
  | 'other'

function normalizeReportError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (message.includes('authentication_required')) return new Error('Sign in before sending a report.')
  if (message.includes('invalid_report_target')) return new Error('This item cannot be reported from here.')
  if (message.includes('invalid_report_reason')) return new Error('Choose a valid reason for the report.')
  if (message.includes('invalid_support_message')) return new Error('Add a short explanation before sending.')
  if (message.includes('support_rate_limited')) return new Error('You have sent several requests recently. Try again a little later.')
  return new Error('The report could not be sent. Please try again.')
}

export async function createMyReport(input: {
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

  if (error) throw normalizeReportError(error)
  return data as string
}

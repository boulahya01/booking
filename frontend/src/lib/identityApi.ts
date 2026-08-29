import { supabase } from './supabaseClient'
import { getMyAccountState } from './auth'
import type { AccountState } from './types'
import { sanitizeStudentId } from './validation'

export type VerificationReason =
  | 'student_id_incorrect'
  | 'student_card_unreadable'
  | 'name_mismatch'
  | 'duplicate_student_identity'
  | 'not_a_student_card'
  | 'student_card_expired'

export type IdentityFailureCode =
  | 'session_required'
  | 'invalid_student_id'
  | 'identity_claim_unavailable'
  | 'upload_failed'
  | 'network'
  | 'status_load_failed'
  | 'submission_failed'
  | 'queue_load_failed'
  | 'evidence_load_failed'
  | 'review_failed'

export class IdentityError extends Error {
  code: IdentityFailureCode

  constructor(code: IdentityFailureCode) {
    super(code)
    this.name = 'IdentityError'
    this.code = code
  }
}

export function identityErrorCode(error: unknown): IdentityFailureCode {
  if (error instanceof IdentityError) return error.code
  return 'submission_failed'
}

export type VerificationAttempt = {
  id: string
  user_id: string
  claimed_student_id: string
  card_storage_path: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason_code: VerificationReason | 'superseded_by_resubmission' | null
  submitted_at: string
  reviewed_at: string | null
}

export type VerificationQueueItem = {
  attempt_id: string
  user_id: string
  full_name: string
  email_kind: 'academic' | 'personal'
  claimed_student_id: string
  card_storage_path: string
  submitted_at: string
  previous_reason_code: VerificationReason | null
  attempt_count: number
}

const ALLOWED_CARD_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
])

function looksLikeNetworkFailure(message = ''): boolean {
  const value = message.toLowerCase()
  return value.includes('failed to fetch') || value.includes('network') || value.includes('connection') || value.includes('timeout')
}

function classifySubmissionFailure(message = ''): IdentityFailureCode {
  const value = message.toLowerCase()
  if (value.includes('identity_claim_unavailable') || value.includes('duplicate_student_identity')) return 'identity_claim_unavailable'
  if (value.includes('invalid_student_id')) return 'invalid_student_id'
  if (value.includes('authentication_required') || value.includes('email_confirmation_required') || value.includes('jwt')) return 'session_required'
  if (looksLikeNetworkFailure(value)) return 'network'
  return 'submission_failed'
}

export function validateStudentCard(file: File): string | null {
  if (!ALLOWED_CARD_TYPES.has(file.type)) return 'invalid_type'
  if (file.size <= 0) return 'invalid_image'
  if (file.size > 5 * 1024 * 1024) return 'too_large'
  return null
}

export async function getLatestVerificationAttempt(): Promise<VerificationAttempt | null> {
  const { data, error } = await supabase.rpc('get_my_latest_identity_verification')
  if (error) throw new IdentityError(looksLikeNetworkFailure(error.message) ? 'network' : 'status_load_failed')

  const row: any = Array.isArray(data) ? data[0] : data
  if (!row) return null

  return {
    id: row.attempt_id,
    user_id: row.user_id,
    claimed_student_id: row.claimed_student_id,
    card_storage_path: row.card_storage_path,
    status: row.status,
    reason_code: row.reason_code,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at
  }
}

export async function uploadAndSubmitStudentCard(studentId: string, file: File): Promise<AccountState> {
  const validationError = validateStudentCard(file)
  if (validationError) throw new IdentityError('upload_failed')

  const normalizedStudentId = sanitizeStudentId(studentId)
  if (!/^[A-Z][0-9]{9}$/.test(normalizedStudentId)) throw new IdentityError('invalid_student_id')

  const { data: sessionData, error: userError } = await supabase.auth.getUser()
  const user = sessionData.user
  if (userError || !user) throw new IdentityError('session_required')

  const ext = ALLOWED_CARD_TYPES.get(file.type)!
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`
  const bucket = supabase.storage.from('student-verification')

  const { error: uploadError } = await bucket.upload(path, file, {
    cacheControl: '0',
    contentType: file.type,
    upsert: false
  })

  if (uploadError) {
    throw new IdentityError(looksLikeNetworkFailure(uploadError.message) ? 'network' : 'upload_failed')
  }

  const { error: submitError } = await supabase.rpc('submit_identity_verification', {
    p_student_id: normalizedStudentId,
    p_card_storage_path: path
  })

  if (submitError) {
    await bucket.remove([path])
    throw new IdentityError(classifySubmissionFailure(submitError.message))
  }

  try {
    const state = await getMyAccountState()
    if (!state) throw new IdentityError('status_load_failed')
    return state
  } catch (error) {
    if (error instanceof IdentityError) throw error
    throw new IdentityError('status_load_failed')
  }
}

export async function listVerificationQueue(): Promise<VerificationQueueItem[]> {
  const { data, error } = await supabase.rpc('list_identity_verification_queue')
  if (error) throw new IdentityError(looksLikeNetworkFailure(error.message) ? 'network' : 'queue_load_failed')
  return (data || []) as VerificationQueueItem[]
}

export async function createVerificationEvidenceUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('student-verification')
    .createSignedUrl(path, 300)

  if (error || !data?.signedUrl) {
    throw new IdentityError(error && looksLikeNetworkFailure(error.message) ? 'network' : 'evidence_load_failed')
  }
  return data.signedUrl
}

export async function reviewVerification(
  attemptId: string,
  decision: 'approved' | 'rejected',
  reasonCode: VerificationReason | null = null
): Promise<void> {
  const { data, error } = await supabase.rpc('review_identity_verification', {
    p_attempt_id: attemptId,
    p_decision: decision,
    p_reason_code: reasonCode
  })

  if (error) throw new IdentityError(looksLikeNetworkFailure(error.message) ? 'network' : 'review_failed')

  const row: any = Array.isArray(data) ? data[0] : data
  if (decision === 'approved' && row?.status === 'rejected' && row?.reason_code === 'duplicate_student_identity') {
    throw new IdentityError('identity_claim_unavailable')
  }
}

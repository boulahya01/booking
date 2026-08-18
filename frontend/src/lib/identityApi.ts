import { supabase } from './supabaseClient'
import { getMyAccountState, submitIdentityVerification } from './auth'
import type { AccountState } from './types'

export type VerificationReason =
  | 'student_id_incorrect'
  | 'student_card_unreadable'
  | 'name_mismatch'
  | 'duplicate_student_identity'
  | 'not_a_student_card'
  | 'student_card_expired'

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

export function validateStudentCard(file: File): string | null {
  if (!ALLOWED_CARD_TYPES.has(file.type)) return 'Use a JPG, PNG, or WebP image.'
  if (file.size <= 0) return 'Choose a valid image.'
  if (file.size > 5 * 1024 * 1024) return 'The image must be smaller than 5 MB.'
  return null
}

export async function getLatestVerificationAttempt(): Promise<VerificationAttempt | null> {
  const { data, error } = await supabase.rpc('get_my_latest_identity_verification')
  if (error) throw new Error(error.message)

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
  if (validationError) throw new Error(validationError)

  const { data: sessionData } = await supabase.auth.getUser()
  const user = sessionData.user
  if (!user) throw new Error('Please sign in again.')

  const ext = ALLOWED_CARD_TYPES.get(file.type)!
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`
  const bucket = supabase.storage.from('student-verification')

  const { error: uploadError } = await bucket.upload(path, file, {
    cacheControl: '0',
    contentType: file.type,
    upsert: false
  })

  if (uploadError) throw new Error(uploadError.message)

  const result = await submitIdentityVerification(studentId, path)
  if (result.error) {
    await bucket.remove([path])
    throw new Error(result.error.message)
  }

  const state = await getMyAccountState()
  if (!state) throw new Error('Unable to refresh verification status.')
  return state
}

export async function listVerificationQueue(): Promise<VerificationQueueItem[]> {
  const { data, error } = await supabase.rpc('list_identity_verification_queue')
  if (error) throw new Error(error.message)
  return (data || []) as VerificationQueueItem[]
}

export async function createVerificationEvidenceUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('student-verification')
    .createSignedUrl(path, 300)

  if (error || !data?.signedUrl) throw new Error(error?.message || 'Unable to open student card.')
  return data.signedUrl
}

export async function reviewVerification(
  attemptId: string,
  decision: 'approved' | 'rejected',
  reasonCode: VerificationReason | null = null
): Promise<void> {
  const { error } = await supabase.rpc('review_identity_verification', {
    p_attempt_id: attemptId,
    p_decision: decision,
    p_reason_code: reasonCode
  })

  if (error) throw new Error(error.message)
}

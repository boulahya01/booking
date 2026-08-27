import { supabase } from './supabaseClient'
import type { AccountState, Profile } from './types'

export type SessionContext = {
  profile: Profile
  account: AccountState
}

export async function getMySessionContext(): Promise<SessionContext | null> {
  const { data, error } = await supabase.rpc('get_my_session_context')
  if (error) throw new Error(error.message || 'Unable to restore account')

  const row: any = Array.isArray(data) ? data[0] : data
  if (!row) return null

  const profile: Profile = {
    id: row.user_id,
    student_id: row.student_id || null,
    full_name: row.full_name,
    username: row.username || null,
    role: row.role,
    status: row.access_status,
    email_kind: row.email_kind,
    identity_status: row.identity_status,
    restriction_reason: row.restriction_reason || null,
    verified_student_id_at: row.verified_student_id_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  }

  const account: AccountState = {
    user_id: row.user_id,
    role: row.role,
    access_status: row.access_status,
    email_kind: row.email_kind,
    identity_status: row.identity_status,
    student_id: row.student_id || null,
    restriction_reason: row.restriction_reason || null,
    can_use_sports: Boolean(row.can_use_sports),
    needs_identity_action: Boolean(row.needs_identity_action)
  }

  return { profile, account }
}

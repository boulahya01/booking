export type AccessStatus = 'pending' | 'approved' | 'suspended'
export type IdentityStatus = 'required' | 'pending' | 'verified' | 'rejected' | 'conflict'
export type EmailKind = 'academic' | 'personal'

export type Profile = {
  id: string
  student_id: string | null
  full_name: string
  email?: string
  email_kind?: EmailKind
  identity_status?: IdentityStatus
  restriction_reason?: string | null
  verified_student_id_at?: string | null
  role: 'student' | 'admin'
  status: AccessStatus
  created_at: string
  updated_at: string
}

export type AccountState = {
  user_id: string
  role: 'student' | 'admin'
  access_status: AccessStatus
  email_kind: EmailKind
  identity_status: IdentityStatus
  student_id: string | null
  restriction_reason: string | null
  can_use_sports: boolean
  needs_identity_action: boolean
}

export type Pitch = {
  id: string
  name: string
  location: string
  capacity: number
  open_time: string
  close_time: string
  sort_order?: number
  sport_type?: string
  booking_frequency_days?: number
  booking_frequency_enabled?: boolean
  created_at: string
}

export type Slot = {
  id: string
  pitch_id: string
  datetime_start: string
  datetime_end: string
  capacity: number
  is_available: boolean
  created_at: string
}

export type Booking = {
  id: string
  user_id: string
  slot_id?: string
  pitch_id?: string
  slot_datetime?: string
  slot_datetime_end?: string
  status: 'active' | 'cancelled' | 'completed'
  created_at: string
  updated_at?: string
}

export type SystemNotification = {
  id: string
  key: string
  title_en: string
  title_ar: string
  message_en: string
  message_ar: string
  enabled: boolean
  created_at: string
  expires_at: string | null
  updated_at: string
}

export type UserDismissedNotification = {
  user_id: string
  notification_key: string
  dismissed_at: string
}

export type BookingWithDetails = {
  id: string
  user_id: string
  pitch_id: string | null
  slot_datetime: string | null
  slot_datetime_end: string | null
  status: 'active' | 'cancelled' | 'completed'
  created_at: string
  full_name: string
  student_id: string | null
  email: string
  pitch_name: string
  pitch_location: string
}

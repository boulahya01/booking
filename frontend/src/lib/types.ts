export type Profile = {
  id: string
  student_id: string
  full_name: string
  email?: string
  rejection_reason?: string | null
  verification_notes?: string | null
  role: 'student' | 'admin' | 'moderator'
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  created_at: string
  updated_at: string
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
  student_id: string
  email: string
  pitch_name: string
  pitch_location: string
}

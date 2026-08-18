export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          new_state: Json | null
          previous_state: Json | null
          reason_code: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
          reason_code?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
          reason_code?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_dismissals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body_ar: string
          body_en: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          published_at: string
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          body_ar: string
          body_en: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          published_at?: string
          title_ar: string
          title_en: string
          updated_at?: string
        }
        Update: {
          body_ar?: string
          body_en?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          published_at?: string
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          ends_at: string
          id: string
          pitch_id: string
          starts_at: string
          status: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          ends_at: string
          id?: string
          pitch_id: string
          starts_at: string
          status?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          pitch_id?: string
          starts_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_pitch_id_fkey"
            columns: ["pitch_id"]
            isOneToOne: false
            referencedRelation: "pitches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verification_attempts: {
        Row: {
          card_storage_path: string
          claimed_student_id: string
          created_at: string
          id: string
          reason_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          card_storage_path: string
          claimed_student_id: string
          created_at?: string
          id?: string
          reason_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          card_storage_path?: string
          claimed_student_id?: string
          created_at?: string
          id?: string
          reason_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_verification_attempts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_verification_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participants: {
        Row: {
          joined_at: string
          match_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          match_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          match_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          organizer_id: string
          reserved_spots: number
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          organizer_id: string
          reserved_spots?: number
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          organizer_id?: string
          reserved_spots?: number
          status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "booking_timeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pitches: {
        Row: {
          booking_frequency_days: number
          booking_frequency_enabled: boolean
          booking_window_hours: number
          cancellation_cutoff_minutes: number
          capacity: number
          close_time: string
          created_at: string
          id: string
          is_active: boolean
          location: string
          name: string
          open_time: string
          slot_duration_minutes: number
          sort_order: number
          sport_type: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          booking_frequency_days?: number
          booking_frequency_enabled?: boolean
          booking_window_hours?: number
          cancellation_cutoff_minutes?: number
          capacity?: number
          close_time?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location: string
          name: string
          open_time?: string
          slot_duration_minutes?: number
          sort_order?: number
          sport_type?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          booking_frequency_days?: number
          booking_frequency_enabled?: boolean
          booking_window_hours?: number
          cancellation_cutoff_minutes?: number
          capacity?: number
          close_time?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string
          name?: string
          open_time?: string
          slot_duration_minutes?: number
          sort_order?: number
          sport_type?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_restriction_reason: string | null
          created_at: string
          email_kind: string
          full_name: string
          id: string
          identity_status: string
          restriction_reason: string | null
          role: string
          status: string
          student_id: string | null
          updated_at: string
          username: string | null
          verified_student_id_at: string | null
        }
        Insert: {
          access_restriction_reason?: string | null
          created_at?: string
          email_kind?: string
          full_name: string
          id: string
          identity_status?: string
          restriction_reason?: string | null
          role?: string
          status?: string
          student_id?: string | null
          updated_at?: string
          username?: string | null
          verified_student_id_at?: string | null
        }
        Update: {
          access_restriction_reason?: string | null
          created_at?: string
          email_kind?: string
          full_name?: string
          id?: string
          identity_status?: string
          restriction_reason?: string | null
          role?: string
          status?: string
          student_id?: string | null
          updated_at?: string
          username?: string | null
          verified_student_id_at?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_role: string
          sender_user_id: string | null
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_role: string
          sender_user_id?: string | null
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_role?: string
          sender_user_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_threads: {
        Row: {
          contact_email: string | null
          created_at: string
          guest_token_hash: string | null
          id: string
          kind: string
          reason_code: string | null
          resolved_at: string | null
          status: string
          subject: string | null
          target_id: string | null
          target_type: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          guest_token_hash?: string | null
          id?: string
          kind?: string
          reason_code?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string | null
          target_id?: string | null
          target_type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          guest_token_hash?: string | null
          id?: string
          kind?: string
          reason_code?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string | null
          target_id?: string | null
          target_type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      booking_timeline: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          ends_at: string | null
          id: string | null
          lifecycle_status: string | null
          pitch_id: string | null
          starts_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string | null
          lifecycle_status?: never
          pitch_id?: string | null
          starts_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string | null
          lifecycle_status?: never
          pitch_id?: string | null
          starts_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_pitch_id_fkey"
            columns: ["pitch_id"]
            isOneToOne: false
            referencedRelation: "pitches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_guest_support_message: {
        Args: { p_access_token: string; p_body: string }
        Returns: string
      }
      add_my_support_message: {
        Args: { p_body: string; p_thread_id: string }
        Returns: string
      }
      admin_archive_pitch: {
        Args: { p_pitch_id: string; p_reason_code: string }
        Returns: {
          booking_frequency_days: number
          booking_frequency_enabled: boolean
          booking_window_hours: number
          cancellation_cutoff_minutes: number
          capacity: number
          close_time: string
          created_at: string
          id: string
          is_active: boolean
          location: string
          name: string
          open_time: string
          slot_duration_minutes: number
          sort_order: number
          sport_type: string | null
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pitches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_cancel_booking: {
        Args: { p_booking_id: string; p_reason_code: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          ends_at: string
          id: string
          pitch_id: string
          starts_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_get_support_messages: {
        Args: { p_thread_id: string }
        Returns: {
          body: string
          created_at: string
          id: string
          sender_role: string
        }[]
      }
      admin_get_support_thread_context: {
        Args: { p_thread_id: string }
        Returns: {
          contact_email: string
          created_at: string
          id: string
          kind: string
          reason_code: string
          status: string
          subject: string
          target_id: string
          target_type: string
          updated_at: string
          user_id: string
        }[]
      }
      admin_list_bookings: {
        Args: {
          p_from?: string
          p_lifecycle?: string
          p_limit?: number
          p_offset?: number
          p_pitch_id?: string
          p_query?: string
          p_to?: string
        }
        Returns: {
          booking_id: string
          booking_status: string
          created_at: string
          email: string
          ends_at: string
          full_name: string
          lifecycle_status: string
          pitch_id: string
          pitch_location: string
          pitch_name: string
          starts_at: string
          student_id: string
          total_count: number
          user_id: string
        }[]
      }
      admin_list_matches: {
        Args: never
        Returns: {
          booking_id: string
          capacity: number
          joined_count: number
          match_id: string
          organizer_name: string
          pitch_name: string
          reserved_spots: number
          starts_at: string
          status: string
          visibility: string
        }[]
      }
      admin_list_support_threads: {
        Args: { p_limit?: number; p_status?: string }
        Returns: {
          contact_email: string
          created_at: string
          id: string
          kind: string
          last_message_at: string
          message_count: number
          status: string
          subject: string
          updated_at: string
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_status?: string
        }
        Returns: {
          access_status: string
          created_at: string
          email_kind: string
          full_name: string
          identity_status: string
          restriction_reason: string
          role: string
          student_id: string
          total_count: number
          user_id: string
          username: string
        }[]
      }
      admin_reply_support_thread: {
        Args: { p_body: string; p_next_status?: string; p_thread_id: string }
        Returns: string
      }
      admin_save_pitch: {
        Args: {
          p_booking_frequency_days: number
          p_booking_frequency_enabled: boolean
          p_booking_window_hours: number
          p_cancellation_cutoff_minutes: number
          p_capacity: number
          p_close_time: string
          p_is_active: boolean
          p_location: string
          p_name: string
          p_open_time: string
          p_pitch_id: string
          p_slot_duration_minutes: number
          p_sort_order: number
          p_sport_type: string
          p_timezone?: string
        }
        Returns: {
          booking_frequency_days: number
          booking_frequency_enabled: boolean
          booking_window_hours: number
          cancellation_cutoff_minutes: number
          capacity: number
          close_time: string
          created_at: string
          id: string
          is_active: boolean
          location: string
          name: string
          open_time: string
          slot_duration_minutes: number
          sort_order: number
          sport_type: string | null
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pitches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_support_status: {
        Args: { p_status: string; p_thread_id: string }
        Returns: undefined
      }
      admin_set_user_access: {
        Args: {
          p_next_status: string
          p_reason_code: string
          p_user_id: string
        }
        Returns: {
          access_status: string
          restriction_reason: string
          user_id: string
        }[]
      }
      cancel_booking: {
        Args: { p_booking_id: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          ends_at: string
          id: string
          pitch_id: string
          starts_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_booking: {
        Args: { p_pitch_id: string; p_starts_at: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          ends_at: string
          id: string
          pitch_id: string
          starts_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_guest_support_thread: {
        Args: { p_body: string; p_contact_email: string; p_subject: string }
        Returns: {
          access_token: string
          thread_id: string
        }[]
      }
      create_my_report_thread: {
        Args: {
          p_body: string
          p_reason_code: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      create_my_support_thread: {
        Args: { p_body: string; p_kind: string; p_subject: string }
        Returns: string
      }
      create_open_match: {
        Args: { p_booking_id: string; p_reserved_spots?: number }
        Returns: {
          booking_id: string
          created_at: string
          id: string
          organizer_id: string
          reserved_spots: number
          status: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_guest_support_thread: {
        Args: { p_access_token: string }
        Returns: {
          body: string
          created_at: string
          kind: string
          message_created_at: string
          message_id: string
          sender_role: string
          status: string
          subject: string
          thread_id: string
        }[]
      }
      get_match_roster: {
        Args: { p_match_id: string }
        Returns: {
          full_name: string
          joined_at: string
          member_role: string
          user_id: string
          username: string
        }[]
      }
      get_my_account_state: {
        Args: never
        Returns: {
          access_status: string
          can_use_sports: boolean
          email_kind: string
          identity_status: string
          needs_identity_action: boolean
          restriction_reason: string
          role: string
          student_id: string
          user_id: string
        }[]
      }
      get_my_latest_identity_verification: {
        Args: never
        Returns: {
          attempt_id: string
          card_storage_path: string
          claimed_student_id: string
          reason_code: string
          reviewed_at: string
          status: string
          submitted_at: string
          user_id: string
        }[]
      }
      get_my_session_context: {
        Args: never
        Returns: {
          access_status: string
          can_use_sports: boolean
          created_at: string
          email_kind: string
          full_name: string
          identity_status: string
          needs_identity_action: boolean
          restriction_reason: string
          role: string
          student_id: string
          updated_at: string
          user_id: string
          username: string
          verified_student_id_at: string
        }[]
      }
      get_my_support_thread: {
        Args: { p_thread_id: string }
        Returns: {
          body: string
          kind: string
          message_created_at: string
          message_id: string
          sender_role: string
          status: string
          subject: string
          thread_created_at: string
          thread_id: string
          thread_updated_at: string
        }[]
      }
      get_next_booking: {
        Args: never
        Returns: {
          booking_id: string
          booking_status: string
          cancelled_at: string
          created_at: string
          ends_at: string
          lifecycle_status: string
          pitch_capacity: number
          pitch_id: string
          pitch_location: string
          pitch_name: string
          starts_at: string
        }[]
      }
      get_pitch_availability:
        | {
            Args: { p_pitch_id: string }
            Returns: {
              booked_by_me: boolean
              booker_name: string
              booking_id: string
              ends_at: string
              is_available: boolean
              starts_at: string
            }[]
          }
        | {
            Args: { p_local_date: string; p_pitch_id: string }
            Returns: {
              booker_name: string
              ends_at: string
              is_available: boolean
              starts_at: string
            }[]
          }
      join_open_match: {
        Args: { p_match_id: string }
        Returns: {
          joined_at: string
          match_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "match_participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_open_match: { Args: { p_match_id: string }; Returns: undefined }
      list_identity_verification_queue: {
        Args: never
        Returns: {
          attempt_count: number
          attempt_id: string
          card_storage_path: string
          claimed_student_id: string
          email_kind: string
          full_name: string
          previous_reason_code: string
          submitted_at: string
          user_id: string
        }[]
      }
      list_my_bookings: {
        Args: { p_limit?: number }
        Returns: {
          booking_id: string
          booking_status: string
          cancelled_at: string
          created_at: string
          ends_at: string
          lifecycle_status: string
          pitch_capacity: number
          pitch_id: string
          pitch_location: string
          pitch_name: string
          starts_at: string
        }[]
      }
      list_my_matches: {
        Args: never
        Returns: {
          booking_id: string
          capacity: number
          ends_at: string
          joined_count: number
          location: string
          match_id: string
          member_role: string
          organizer_name: string
          pitch_name: string
          reserved_spots: number
          sport_type: string
          starts_at: string
          visibility: string
        }[]
      }
      list_my_support_threads: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          kind: string
          last_body: string
          last_message_at: string
          last_message_id: string
          last_sender_role: string
          status: string
          subject: string
          thread_id: string
          updated_at: string
        }[]
      }
      list_open_matches: {
        Args: never
        Returns: {
          booking_id: string
          capacity: number
          ends_at: string
          joined_by_me: boolean
          joined_count: number
          location: string
          match_id: string
          organized_by_me: boolean
          organizer_id: string
          organizer_name: string
          organizer_username: string
          pitch_id: string
          pitch_name: string
          reserved_spots: number
          sport_type: string
          spots_left: number
          starts_at: string
        }[]
      }
      review_identity_verification: {
        Args: {
          p_attempt_id: string
          p_decision: string
          p_reason_code?: string
        }
        Returns: {
          card_storage_path: string
          claimed_student_id: string
          created_at: string
          id: string
          reason_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "identity_verification_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_match_visibility: {
        Args: { p_match_id: string; p_visibility: string }
        Returns: {
          booking_id: string
          created_at: string
          id: string
          organizer_id: string
          reserved_spots: number
          status: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_identity_verification: {
        Args: { p_card_storage_path: string; p_student_id: string }
        Returns: {
          card_storage_path: string
          claimed_student_id: string
          created_at: string
          id: string
          reason_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "identity_verification_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_match_reserved_spots: {
        Args: { p_match_id: string; p_reserved_spots: number }
        Returns: {
          booking_id: string
          created_at: string
          id: string
          organizer_id: string
          reserved_spots: number
          status: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_my_profile: {
        Args: { p_full_name: string }
        Returns: {
          access_restriction_reason: string | null
          created_at: string
          email_kind: string
          full_name: string
          id: string
          identity_status: string
          restriction_reason: string | null
          role: string
          status: string
          student_id: string | null
          updated_at: string
          username: string | null
          verified_student_id_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

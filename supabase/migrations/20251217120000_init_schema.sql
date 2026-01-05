-- =====================================================
-- PHASE 1: Initial Database Schema
-- Tables: profiles, pitches, slots, bookings
-- =====================================================

-- =====================================================
-- PROFILES TABLE
-- Stores user profile data linked to auth.users
-- Tracks student ID, role, and approval status
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'moderator')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PITCHES TABLE
-- Stores football pitch information
-- Basic pitch details (name, location, capacity)
-- =====================================================
CREATE TABLE IF NOT EXISTS pitches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- SLOTS TABLE
-- Stores available time slots for each pitch
-- Each slot represents a bookable time period
-- =====================================================
CREATE TABLE IF NOT EXISTS slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  datetime_start TIMESTAMP WITH TIME ZONE NOT NULL,
  datetime_end TIMESTAMP WITH TIME ZONE NOT NULL,
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_slot_time CHECK (datetime_start < datetime_end)
);

-- =====================================================
-- BOOKINGS TABLE
-- Stores user bookings for slots
-- Includes unique constraint to prevent double-booking
-- =====================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT no_double_booking UNIQUE (slot_id, user_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_student_id ON profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_slots_pitch_id ON slots(pitch_id);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

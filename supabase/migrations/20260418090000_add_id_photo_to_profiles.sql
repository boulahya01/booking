-- Add ID photo and verification columns to profiles
-- Generated: 2026-04-18
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unsubmitted' CHECK (verification_status IN ('unsubmitted','pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON public.profiles (verification_status);

COMMIT;

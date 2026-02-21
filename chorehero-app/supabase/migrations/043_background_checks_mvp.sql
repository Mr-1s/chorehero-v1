-- Migration 043: Background checks MVP (manual review flow)
-- Create background_checks table for ID/selfie verification docs
-- Note: Create storage bucket 'verification-docs' in Supabase Dashboard > Storage

CREATE TABLE IF NOT EXISTS public.background_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  id_front_url TEXT NOT NULL,
  id_back_url TEXT NOT NULL,
  selfie_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_background_checks_cleaner_id ON public.background_checks(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_background_checks_status ON public.background_checks(status);

ALTER TABLE public.background_checks ENABLE ROW LEVEL SECURITY;

-- Cleaners can insert their own verification requests
CREATE POLICY "Cleaners can insert own background check"
  ON public.background_checks FOR INSERT
  WITH CHECK (auth.uid() = cleaner_id);

-- Cleaners can view their own
CREATE POLICY "Cleaners can view own background check"
  ON public.background_checks FOR SELECT
  USING (auth.uid() = cleaner_id);

-- Add onboarding_complete to cleaner_profiles if missing
ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

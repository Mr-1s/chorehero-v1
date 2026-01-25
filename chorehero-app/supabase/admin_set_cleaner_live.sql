-- Admin helper: promote cleaner from STAGING to LIVE
-- Replace :cleaner_id with the target user id

UPDATE public.users
SET cleaner_onboarding_state = 'LIVE'
WHERE id = :cleaner_id
  AND role = 'cleaner';

UPDATE public.cleaner_profiles
SET verification_status = 'verified'
WHERE user_id = :cleaner_id;

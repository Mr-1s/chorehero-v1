-- Auto-promote cleaners to LIVE when all requirements are met
CREATE OR REPLACE FUNCTION auto_promote_cleaner_if_ready()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_is_ready BOOLEAN;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  SELECT
    (
      u.role = 'cleaner' AND
      u.cleaner_onboarding_state = 'STAGING' AND
      cp.verification_status = 'verified' AND
      cp.background_check_status = 'cleared' AND
      cp.service_radius_km IS NOT NULL AND
      cp.video_profile_url IS NOT NULL
    )
  INTO v_is_ready
  FROM public.users u
  JOIN public.cleaner_profiles cp ON cp.user_id = u.id
  WHERE u.id = v_user_id;

  IF v_is_ready THEN
    UPDATE public.users
    SET cleaner_onboarding_state = 'LIVE'
    WHERE id = v_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_promote_cleaner_trigger ON public.cleaner_profiles;
CREATE TRIGGER auto_promote_cleaner_trigger
  AFTER INSERT OR UPDATE ON public.cleaner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_promote_cleaner_if_ready();
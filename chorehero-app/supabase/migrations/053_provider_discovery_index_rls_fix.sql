-- Fix: refresh_provider_discovery_index is called by triggers on users/cleaner_profiles.
-- When a user upserts their record, the trigger runs in the user's context and the INSERT
-- into provider_discovery_index fails RLS (no policy allows authenticated INSERT).
-- Run the function as SECURITY DEFINER so it bypasses RLS.
CREATE OR REPLACE FUNCTION public.refresh_provider_discovery_index(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.provider_discovery_index (
    provider_id,
    provider_name,
    provider_avatar_url,
    service_tags,
    geohash,
    price_tiers,
    ranking_signals,
    provider_state,
    updated_at
  )
  SELECT
    u.id,
    u.name,
    u.avatar_url,
    COALESCE(cp.specialties, '{}'),
    NULL,
    ARRAY[COALESCE(cp.hourly_rate::integer, 0)],
    jsonb_build_object(
      'avg_rating', COALESCE(cp.rating_average, 0),
      'response_time_minutes', NULL,
      'completion_rate', NULL
    ),
    CASE
      WHEN u.role = 'cleaner' AND u.cleaner_onboarding_state = 'LIVE' THEN 'LIVE'
      ELSE 'INACTIVE'
    END,
    NOW()
  FROM public.users u
  LEFT JOIN public.cleaner_profiles cp ON cp.user_id = u.id
  WHERE u.id = p_user_id
  ON CONFLICT (provider_id) DO UPDATE SET
    provider_name = EXCLUDED.provider_name,
    provider_avatar_url = EXCLUDED.provider_avatar_url,
    service_tags = EXCLUDED.service_tags,
    geohash = EXCLUDED.geohash,
    price_tiers = EXCLUDED.price_tiers,
    ranking_signals = EXCLUDED.ranking_signals,
    provider_state = EXCLUDED.provider_state,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

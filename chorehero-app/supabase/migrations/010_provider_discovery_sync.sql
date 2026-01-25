-- Sync Provider Discovery Index from users + cleaner_profiles
CREATE OR REPLACE FUNCTION refresh_provider_discovery_index(p_user_id UUID)
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_discovery_index_from_users()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_provider_discovery_index(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_discovery_index_from_cleaner_profiles()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_provider_discovery_index(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_discovery_index_users_trigger ON public.users;
CREATE TRIGGER sync_discovery_index_users_trigger
AFTER INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION sync_discovery_index_from_users();

DROP TRIGGER IF EXISTS sync_discovery_index_cleaners_trigger ON public.cleaner_profiles;
CREATE TRIGGER sync_discovery_index_cleaners_trigger
AFTER INSERT OR UPDATE ON public.cleaner_profiles
FOR EACH ROW
EXECUTE FUNCTION sync_discovery_index_from_cleaner_profiles();

-- Backfill all existing cleaners
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.users WHERE role = 'cleaner' LOOP
    PERFORM refresh_provider_discovery_index(r.id);
  END LOOP;
END $$;

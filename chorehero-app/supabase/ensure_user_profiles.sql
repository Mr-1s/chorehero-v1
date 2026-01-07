-- Quick fix to ensure all authenticated users have proper profiles
-- This will help resolve cleaner account access issues

-- Create missing user profiles for any authenticated users
INSERT INTO public.users (id, email, name, role, avatar_url, profile_completed)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data->>'role', 'customer'),
  au.raw_user_meta_data->>'avatar_url',
  true
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  avatar_url = EXCLUDED.avatar_url,
  profile_completed = true;

-- Create cleaner profiles for users with cleaner role
INSERT INTO public.cleaner_profiles (user_id, hourly_rate, bio, verification_status, is_available)
SELECT 
  u.id,
  50.00,
  'Professional cleaner ready to help!',
  'verified',
  true
FROM public.users u
LEFT JOIN public.cleaner_profiles cp ON u.id = cp.user_id
WHERE u.role = 'cleaner' AND cp.user_id IS NULL;

-- Create customer profiles for users with customer role
INSERT INTO public.customer_profiles (user_id)
SELECT 
  u.id
FROM public.users u
LEFT JOIN public.customer_profiles cp ON u.id = cp.user_id
WHERE u.role = 'customer' AND cp.user_id IS NULL;

-- Update all users to have completed profiles
UPDATE public.users SET profile_completed = true WHERE profile_completed = false;

SELECT 
  'Profile fix complete! ' || 
  (SELECT COUNT(*) FROM public.users) || ' users, ' ||
  (SELECT COUNT(*) FROM public.cleaner_profiles) || ' cleaners, ' ||
  (SELECT COUNT(*) FROM public.customer_profiles) || ' customers.' as result;
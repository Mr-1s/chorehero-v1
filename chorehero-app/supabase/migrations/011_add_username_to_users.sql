-- Add username to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
  ON public.users (username)
  WHERE username IS NOT NULL;

-- Ensure content_posts.user_id has a foreign key to public.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'content_posts_user_id_fkey'
  ) THEN
    ALTER TABLE public.content_posts
      ADD CONSTRAINT content_posts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

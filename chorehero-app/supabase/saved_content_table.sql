-- Create saved_content table for bookmarked videos/content
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.saved_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique constraint (user can't save same content twice)
  UNIQUE(user_id, content_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_saved_content_user_id ON public.saved_content(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_content_content_id ON public.saved_content(content_id);
CREATE INDEX IF NOT EXISTS idx_saved_content_created_at ON public.saved_content(created_at DESC);

-- Enable RLS
ALTER TABLE public.saved_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own saved content
CREATE POLICY "Users can view own saved content"
  ON public.saved_content
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can save content
CREATE POLICY "Users can save content"
  ON public.saved_content
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unsave their own content
CREATE POLICY "Users can unsave own content"
  ON public.saved_content
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.saved_content TO authenticated;
GRANT SELECT ON public.saved_content TO anon;

-- Add follower_count and following_count to cleaner_profiles if not exists
ALTER TABLE public.cleaner_profiles
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;

ALTER TABLE public.cleaner_profiles
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Create a function to update follower counts
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment follower count for the person being followed
    UPDATE cleaner_profiles 
    SET follower_count = COALESCE(follower_count, 0) + 1
    WHERE user_id = NEW.following_id;
    
    -- Increment following count for the follower
    UPDATE cleaner_profiles 
    SET following_count = COALESCE(following_count, 0) + 1
    WHERE user_id = NEW.follower_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement follower count
    UPDATE cleaner_profiles 
    SET follower_count = GREATEST(COALESCE(follower_count, 0) - 1, 0)
    WHERE user_id = OLD.following_id;
    
    -- Decrement following count
    UPDATE cleaner_profiles 
    SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0)
    WHERE user_id = OLD.follower_id;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for follower counts (drop if exists first)
DROP TRIGGER IF EXISTS update_follower_counts_trigger ON public.user_follows;
CREATE TRIGGER update_follower_counts_trigger
  AFTER INSERT OR DELETE ON public.user_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follower_counts();

-- Initialize existing follower counts
UPDATE cleaner_profiles cp
SET follower_count = (
  SELECT COUNT(*) FROM user_follows WHERE following_id = cp.user_id
);

UPDATE cleaner_profiles cp
SET following_count = (
  SELECT COUNT(*) FROM user_follows WHERE follower_id = cp.user_id
);

COMMENT ON TABLE public.saved_content IS 'Stores bookmarked/saved content for users';

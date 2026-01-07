-- Content Tables Migration (Standalone)
-- Add tables for User Generated Content (UGC) system

-- Content posts table for videos/photos uploaded by cleaners
CREATE TABLE IF NOT EXISTS public.content_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('video', 'photo', 'before_after')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  secondary_media_url TEXT, -- For before/after posts
  duration_seconds INTEGER, -- For videos
  location_name VARCHAR(255),
  tags TEXT[],
  status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content interactions (likes, views, etc.)
CREATE TABLE IF NOT EXISTS public.content_interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_post_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE NOT NULL,
  interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('like', 'view', 'share')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_post_id, interaction_type)
);

-- Content comments
CREATE TABLE IF NOT EXISTS public.content_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_post_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE NOT NULL,
  parent_comment_id UUID REFERENCES public.content_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User follows (for following other cleaners)
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

-- Content notifications
CREATE TABLE IF NOT EXISTS public.content_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_post_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE,
  notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN ('like', 'comment', 'follow', 'mention')),
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_posts_user_id ON public.content_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_status ON public.content_posts(status);
CREATE INDEX IF NOT EXISTS idx_content_posts_published_at ON public.content_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_posts_content_type ON public.content_posts(content_type);

CREATE INDEX IF NOT EXISTS idx_content_interactions_user_id ON public.content_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_content_post_id ON public.content_interactions(content_post_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_type ON public.content_interactions(interaction_type);

CREATE INDEX IF NOT EXISTS idx_content_comments_content_post_id ON public.content_comments(content_post_id);
CREATE INDEX IF NOT EXISTS idx_content_comments_user_id ON public.content_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_content_comments_parent_id ON public.content_comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON public.user_follows(following_id);

CREATE INDEX IF NOT EXISTS idx_content_notifications_user_id ON public.content_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_content_notifications_is_read ON public.content_notifications(is_read);

-- RLS (Row Level Security) Policies
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_notifications ENABLE ROW LEVEL SECURITY;

-- Content posts policies
CREATE POLICY "Content posts are viewable by everyone" ON public.content_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Users can insert their own content posts" ON public.content_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content posts" ON public.content_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content posts" ON public.content_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Content interactions policies
CREATE POLICY "Users can view all interactions" ON public.content_interactions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own interactions" ON public.content_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions" ON public.content_interactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions" ON public.content_interactions
  FOR DELETE USING (auth.uid() = user_id);

-- Content comments policies
CREATE POLICY "Comments are viewable by everyone" ON public.content_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments" ON public.content_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.content_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.content_comments
  FOR DELETE USING (auth.uid() = user_id);

-- User follows policies
CREATE POLICY "Users can view all follows" ON public.user_follows
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own follows" ON public.user_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete their own follows" ON public.user_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Content notifications policies
CREATE POLICY "Users can view their own notifications" ON public.content_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.content_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_posts_updated_at BEFORE UPDATE ON public.content_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_comments_updated_at BEFORE UPDATE ON public.content_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update content interaction counts
CREATE OR REPLACE FUNCTION update_content_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update like count
  IF TG_OP = 'INSERT' AND NEW.interaction_type = 'like' THEN
    UPDATE public.content_posts 
    SET like_count = like_count + 1 
    WHERE id = NEW.content_post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.interaction_type = 'like' THEN
    UPDATE public.content_posts 
    SET like_count = GREATEST(like_count - 1, 0) 
    WHERE id = OLD.content_post_id;
  END IF;
  
  -- Update view count
  IF TG_OP = 'INSERT' AND NEW.interaction_type = 'view' THEN
    UPDATE public.content_posts 
    SET view_count = view_count + 1 
    WHERE id = NEW.content_post_id;
  END IF;
  
  -- Update share count
  IF TG_OP = 'INSERT' AND NEW.interaction_type = 'share' THEN
    UPDATE public.content_posts 
    SET share_count = share_count + 1 
    WHERE id = NEW.content_post_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_interaction_counts
  AFTER INSERT OR DELETE ON public.content_interactions
  FOR EACH ROW EXECUTE FUNCTION update_content_counts();

-- Function to update comment counts
CREATE OR REPLACE FUNCTION update_comment_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.content_posts 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.content_post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.content_posts 
    SET comment_count = GREATEST(comment_count - 1, 0) 
    WHERE id = OLD.content_post_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_comment_counts
  AFTER INSERT OR DELETE ON public.content_comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_counts(); 
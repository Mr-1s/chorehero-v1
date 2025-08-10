-- User-Generated Content Schema for ChoreHero
-- This extends the existing schema to support personal content uploads, likes, and comments

-- Create custom types for content
CREATE TYPE content_type AS ENUM ('video', 'image', 'before_after');
CREATE TYPE content_status AS ENUM ('draft', 'published', 'hidden', 'flagged');
CREATE TYPE interaction_type AS ENUM ('like', 'love', 'wow', 'laugh');

-- Content posts table - user-generated content from cleaners
CREATE TABLE public.content_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content_type content_type NOT NULL,
  status content_status DEFAULT 'published',
  
  -- Media URLs
  media_url TEXT NOT NULL, -- Primary video/image URL
  thumbnail_url TEXT, -- Thumbnail for videos
  secondary_media_url TEXT, -- For before/after posts
  
  -- Content metadata
  duration_seconds INTEGER, -- For videos
  file_size_bytes BIGINT,
  original_filename VARCHAR(255),
  
  -- Engagement metrics
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  
  -- Content details
  location_name VARCHAR(255), -- e.g., "Kitchen Deep Clean"
  tags TEXT[], -- Array of tags like ["deep-clean", "kitchen", "before-after"]
  
  -- Moderation
  is_featured BOOLEAN DEFAULT false,
  flagged_at TIMESTAMP WITH TIME ZONE,
  flagged_reason TEXT,
  moderator_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Content interactions (likes, reactions)
CREATE TABLE public.content_interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  interaction_type interaction_type NOT NULL DEFAULT 'like',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one interaction per user per content
  UNIQUE(content_id, user_id)
);

-- Content comments
CREATE TABLE public.content_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  parent_comment_id UUID REFERENCES public.content_comments(id) ON DELETE CASCADE, -- For replies
  
  -- Comment content
  text TEXT NOT NULL,
  
  -- Engagement
  like_count INTEGER DEFAULT 0,
  
  -- Moderation
  is_flagged BOOLEAN DEFAULT false,
  flagged_at TIMESTAMP WITH TIME ZONE,
  flagged_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comment likes (separate from content likes)
CREATE TABLE public.comment_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  comment_id UUID REFERENCES public.content_comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one like per user per comment
  UNIQUE(comment_id, user_id)
);

-- Content views tracking
CREATE TABLE public.content_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- NULL for anonymous views
  ip_address INET,
  user_agent TEXT,
  duration_seconds INTEGER, -- How long they watched
  completed_view BOOLEAN DEFAULT false, -- Did they watch to completion
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Track unique views per user
  UNIQUE(content_id, user_id, DATE(created_at))
);

-- User follows (customers following cleaners)
CREATE TABLE public.user_follows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL, -- Customer
  following_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL, -- Cleaner
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique follows
  UNIQUE(follower_id, following_id),
  
  -- Prevent self-follows
  CHECK(follower_id != following_id)
);

-- Notifications for content interactions
CREATE TABLE public.content_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- Who performed the action
  content_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.content_comments(id) ON DELETE CASCADE,
  
  -- Notification details
  type VARCHAR(50) NOT NULL, -- 'like', 'comment', 'follow', 'mention'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- State
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_content_posts_user_id ON public.content_posts(user_id);
CREATE INDEX idx_content_posts_status ON public.content_posts(status);
CREATE INDEX idx_content_posts_created_at ON public.content_posts(created_at DESC);
CREATE INDEX idx_content_posts_featured ON public.content_posts(is_featured) WHERE is_featured = true;
CREATE INDEX idx_content_posts_tags ON public.content_posts USING GIN(tags);

CREATE INDEX idx_content_interactions_content_id ON public.content_interactions(content_id);
CREATE INDEX idx_content_interactions_user_id ON public.content_interactions(user_id);

CREATE INDEX idx_content_comments_content_id ON public.content_comments(content_id);
CREATE INDEX idx_content_comments_user_id ON public.content_comments(user_id);
CREATE INDEX idx_content_comments_parent ON public.content_comments(parent_comment_id);

CREATE INDEX idx_content_views_content_id ON public.content_views(content_id);
CREATE INDEX idx_content_views_created_at ON public.content_views(created_at DESC);

CREATE INDEX idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON public.user_follows(following_id);

CREATE INDEX idx_content_notifications_recipient ON public.content_notifications(recipient_id);
CREATE INDEX idx_content_notifications_unread ON public.content_notifications(recipient_id) WHERE is_read = false;

-- Functions to automatically update counters
CREATE OR REPLACE FUNCTION update_content_interaction_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.content_posts 
    SET like_count = like_count + 1 
    WHERE id = NEW.content_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.content_posts 
    SET like_count = like_count - 1 
    WHERE id = OLD.content_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_content_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.content_posts 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.content_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.content_posts 
    SET comment_count = comment_count - 1 
    WHERE id = OLD.content_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.content_comments 
    SET like_count = like_count + 1 
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.content_comments 
    SET like_count = like_count - 1 
    WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_update_content_interaction_count
  AFTER INSERT OR DELETE ON public.content_interactions
  FOR EACH ROW EXECUTE FUNCTION update_content_interaction_count();

CREATE TRIGGER trigger_update_content_comment_count
  AFTER INSERT OR DELETE ON public.content_comments
  FOR EACH ROW EXECUTE FUNCTION update_content_comment_count();

CREATE TRIGGER trigger_update_comment_like_count
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION update_comment_like_count();

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_content_posts_updated_at
  BEFORE UPDATE ON public.content_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_content_comments_updated_at
  BEFORE UPDATE ON public.content_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_notifications ENABLE ROW LEVEL SECURITY;

-- Content posts policies
CREATE POLICY "Public can view published content" ON public.content_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Users can manage their own content" ON public.content_posts
  FOR ALL USING (auth.uid() = user_id);

-- Interaction policies
CREATE POLICY "Users can manage their own interactions" ON public.content_interactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view interactions" ON public.content_interactions
  FOR SELECT USING (true);

-- Comment policies
CREATE POLICY "Anyone can view comments on published content" ON public.content_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.content_posts 
      WHERE id = content_id AND status = 'published'
    )
  );

CREATE POLICY "Users can manage their own comments" ON public.content_comments
  FOR ALL USING (auth.uid() = user_id);

-- Comment likes policies
CREATE POLICY "Users can manage their own comment likes" ON public.comment_likes
  FOR ALL USING (auth.uid() = user_id);

-- Views policies
CREATE POLICY "Users can create views" ON public.content_views
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own view history" ON public.content_views
  FOR SELECT USING (auth.uid() = user_id);

-- Follows policies
CREATE POLICY "Users can manage their own follows" ON public.user_follows
  FOR ALL USING (auth.uid() = follower_id);

CREATE POLICY "Users can see their followers" ON public.user_follows
  FOR SELECT USING (auth.uid() = following_id OR auth.uid() = follower_id);

-- Notifications policies
CREATE POLICY "Users can manage their own notifications" ON public.content_notifications
  FOR ALL USING (auth.uid() = recipient_id); 
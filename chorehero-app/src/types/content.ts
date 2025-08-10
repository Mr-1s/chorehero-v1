// User-Generated Content Types for ChoreHero

export type ContentType = 'video' | 'image' | 'before_after';
export type ContentStatus = 'draft' | 'published' | 'hidden' | 'flagged';
export type InteractionType = 'like' | 'love' | 'wow' | 'laugh';

export interface ContentPost {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  content_type: ContentType;
  status: ContentStatus;
  
  // Media URLs
  media_url: string;
  thumbnail_url?: string;
  secondary_media_url?: string; // For before/after posts
  
  // Content metadata
  duration_seconds?: number;
  file_size_bytes?: number;
  original_filename?: string;
  
  // Engagement metrics
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  
  // Content details
  location_name?: string;
  tags: string[];
  
  // Moderation
  is_featured: boolean;
  flagged_at?: string;
  flagged_reason?: string;
  moderator_notes?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;
  
  // Populated fields
  user?: {
    id: string;
    name: string;
    avatar_url?: string;
    role: 'cleaner' | 'customer';
  };
  
  // User interaction state
  user_has_liked?: boolean;
  user_interaction_type?: InteractionType;
  is_following_user?: boolean;
}

export interface ContentInteraction {
  id: string;
  content_id: string;
  user_id: string;
  interaction_type: InteractionType;
  created_at: string;
}

export interface ContentComment {
  id: string;
  content_id: string;
  user_id: string;
  parent_comment_id?: string;
  text: string;
  like_count: number;
  is_flagged: boolean;
  flagged_at?: string;
  flagged_reason?: string;
  created_at: string;
  updated_at: string;
  
  // Populated fields
  user?: {
    id: string;
    name: string;
    avatar_url?: string;
    role: 'cleaner' | 'customer';
  };
  
  // Nested replies
  replies?: ContentComment[];
  
  // User interaction state
  user_has_liked?: boolean;
}

export interface CommentLike {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
}

export interface ContentView {
  id: string;
  content_id: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  duration_seconds?: number;
  completed_view: boolean;
  created_at: string;
}

export interface UserFollow {
  id: string;
  follower_id: string; // Customer
  following_id: string; // Cleaner
  created_at: string;
  
  // Populated fields
  follower?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  following?: {
    id: string;
    name: string;
    avatar_url?: string;
    cleaner_profile?: {
      rating_average: number;
      total_jobs: number;
      specialties: string[];
    };
  };
}

export interface ContentNotification {
  id: string;
  recipient_id: string;
  actor_id?: string;
  content_id?: string;
  comment_id?: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  title: string;
  message: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  
  // Populated fields
  actor?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  content?: {
    id: string;
    title: string;
    thumbnail_url?: string;
  };
}

// Request/Response types
export interface CreateContentRequest {
  title: string;
  description?: string;
  content_type: ContentType;
  media_url: string;
  thumbnail_url?: string;
  secondary_media_url?: string;
  duration_seconds?: number;
  location_name?: string;
  tags: string[];
  status?: ContentStatus;
}

export interface UpdateContentRequest {
  title?: string;
  description?: string;
  location_name?: string;
  tags?: string[];
  status?: ContentStatus;
}

export interface ContentFeedResponse {
  posts: ContentPost[];
  has_more: boolean;
  next_cursor?: string;
  total_count?: number;
}

export interface ContentCommentsResponse {
  comments: ContentComment[];
  has_more: boolean;
  next_cursor?: string;
  total_count: number;
}

export interface UserProfileResponse {
  user: {
    id: string;
    name: string;
    avatar_url?: string;
    role: 'cleaner' | 'customer';
    created_at: string;
  };
  cleaner_profile?: {
    rating_average: number;
    total_jobs: number;
    specialties: string[];
    bio?: string;
    years_experience?: number;
  };
  stats: {
    posts_count: number;
    followers_count: number;
    following_count: number;
    total_likes: number;
    total_views: number;
  };
  recent_posts: ContentPost[];
  is_following?: boolean;
}

export interface ContentAnalytics {
  total_posts: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  followers_count: number;
  
  // Time-based analytics
  views_this_week: number;
  likes_this_week: number;
  new_followers_this_week: number;
  
  // Top performing content
  top_posts: ContentPost[];
  
  // Engagement metrics
  average_engagement_rate: number;
  best_posting_times: string[];
  popular_tags: Array<{ tag: string; count: number }>;
}

// Upload-related types
export interface ContentUploadProgress {
  uploadId: string;
  progress: number; // 0-100
  stage: 'uploading' | 'processing' | 'generating_thumbnail' | 'completed' | 'error';
  bytesTransferred: number;
  totalBytes: number;
  error?: string;
}

export interface ContentUploadResponse {
  success: boolean;
  upload_id?: string;
  media_url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  error?: string;
}

// Feed and discovery types
export interface FeedFilter {
  content_type?: ContentType;
  tags?: string[];
  user_id?: string;
  following_only?: boolean;
  featured_only?: boolean;
  date_range?: {
    start: string;
    end: string;
  };
}

export interface ContentSearchRequest {
  query?: string;
  filters?: FeedFilter;
  sort_by?: 'recent' | 'popular' | 'views' | 'likes';
  limit?: number;
  cursor?: string;
}

// Real-time events
export interface ContentEvent {
  type: 'new_post' | 'new_like' | 'new_comment' | 'new_follow';
  data: ContentPost | ContentInteraction | ContentComment | UserFollow;
  timestamp: string;
}

export interface LiveContentStats {
  content_id: string;
  current_viewers: number;
  live_likes: number;
  live_comments: ContentComment[];
} 
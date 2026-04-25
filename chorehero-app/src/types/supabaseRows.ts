/**
 * Shared row shapes for Supabase responses. Used by services that previously
 * cast PostgREST results to `any`. Keep this thin — only fields the services
 * actually read. If a screen needs more, extend it locally.
 *
 * Naming: `<TableName>Row` matches the underlying public.* table.
 */

export interface UserRow {
  id: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  role: 'customer' | 'cleaner' | 'admin' | null;
  created_at?: string;
}

export interface CleanerProfileRow {
  user_id: string;
  hourly_rate: number | null;
  rating_average: number | null;
  total_jobs: number | null;
  bio: string | null;
  specialties: string[] | null;
  is_available: boolean | null;
  service_radius_km: number | null;
  verification_status: 'pending' | 'verified' | 'rejected' | null;
  background_check_status: 'pending' | 'cleared' | 'verified' | 'failed' | null;
  background_check_date: string | null;
  video_profile_url: string | null;
}

export interface ContentPostRow {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  content_type: 'video' | 'image' | string;
  media_url: string;
  thumbnail_url: string | null;
  status: 'draft' | 'published' | 'archived' | string;
  is_bookable: boolean | null;
  base_price_cents: number | null;
  estimated_hours: number | null;
  package_type: 'fixed' | 'estimate' | 'hourly' | 'contact' | null;
  service_id: string | null;
  pro_service_id: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  view_count: number | null;
  like_count: number | null;
  created_at: string;
  published_at: string | null;
  // Embeds (only present when joined)
  user?: UserRow & { cleaner_profiles?: CleanerProfileRow | null };
}

/** Minimal "anything we joined to a content post" shape used by enrichers. */
export type ContentPostWithUser = ContentPostRow & {
  user?: (UserRow & { cleaner_profiles?: CleanerProfileRow | null }) | null;
};

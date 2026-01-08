-- Migration: Add booking attribution to track which bookings came from content
-- Run this in your Supabase SQL Editor

-- Add source_content_id to bookings table for attribution tracking
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS source_content_id UUID REFERENCES public.content_posts(id) ON DELETE SET NULL;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_bookings_source_content_id ON public.bookings(source_content_id);

-- Add a view for content performance analytics
CREATE OR REPLACE VIEW public.content_analytics AS
SELECT 
  cp.id,
  cp.user_id,
  cp.title,
  cp.content_type,
  cp.media_url,
  cp.thumbnail_url,
  cp.status,
  cp.published_at,
  cp.created_at,
  cp.view_count,
  cp.like_count,
  cp.share_count,
  cp.comment_count,
  COALESCE(booking_stats.booking_count, 0) as bookings_generated,
  COALESCE(booking_stats.total_revenue, 0) as revenue_generated,
  CASE 
    WHEN cp.view_count > 0 THEN ROUND((COALESCE(booking_stats.booking_count, 0)::numeric / cp.view_count::numeric) * 100, 2)
    ELSE 0 
  END as conversion_rate
FROM public.content_posts cp
LEFT JOIN (
  SELECT 
    source_content_id,
    COUNT(*) as booking_count,
    SUM(total_amount) as total_revenue
  FROM public.bookings
  WHERE source_content_id IS NOT NULL
    AND status IN ('confirmed', 'in_progress', 'completed')
  GROUP BY source_content_id
) booking_stats ON cp.id = booking_stats.source_content_id
WHERE cp.status = 'published';

-- Grant access to the view
GRANT SELECT ON public.content_analytics TO authenticated;
GRANT SELECT ON public.content_analytics TO anon;

-- Comment for documentation
COMMENT ON COLUMN public.bookings.source_content_id IS 'Reference to the content post that led to this booking (for attribution tracking)';
COMMENT ON VIEW public.content_analytics IS 'Analytics view combining content posts with their booking performance metrics';



-- User Tutorial Progress Schema
-- Tracks user progress through guided tutorials

-- Create user_tutorial_progress table
CREATE TABLE IF NOT EXISTS public.user_tutorial_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tutorial_id VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    skipped BOOLEAN NOT NULL DEFAULT FALSE,
    time_spent_seconds INTEGER DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tutorial_progress_user_id ON public.user_tutorial_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tutorial_progress_tutorial_id ON public.user_tutorial_progress(tutorial_id);
CREATE INDEX IF NOT EXISTS idx_user_tutorial_progress_completed_at ON public.user_tutorial_progress(completed_at);

-- Create unique constraint to prevent duplicate progress entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tutorial_progress_unique 
ON public.user_tutorial_progress(user_id, tutorial_id);

-- Enable RLS
ALTER TABLE public.user_tutorial_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own tutorial progress" ON public.user_tutorial_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tutorial progress" ON public.user_tutorial_progress
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tutorial progress" ON public.user_tutorial_progress
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow service role to read all tutorial progress for analytics
CREATE POLICY "Service role can read all tutorial progress" ON public.user_tutorial_progress
    FOR SELECT USING (auth.role() = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_tutorial_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_user_tutorial_progress_updated_at
    BEFORE UPDATE ON public.user_tutorial_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_user_tutorial_progress_updated_at();

-- Create view for tutorial analytics
CREATE OR REPLACE VIEW public.tutorial_analytics AS
SELECT 
    tutorial_id,
    version,
    COUNT(*) as total_users,
    COUNT(CASE WHEN skipped = false THEN 1 END) as completed_count,
    COUNT(CASE WHEN skipped = true THEN 1 END) as skipped_count,
    ROUND(
        (COUNT(CASE WHEN skipped = false THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
        2
    ) as completion_rate,
    ROUND(
        (COUNT(CASE WHEN skipped = true THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
        2
    ) as skip_rate,
    AVG(time_spent_seconds) as avg_time_spent_seconds,
    MIN(completed_at) as first_completion,
    MAX(completed_at) as last_completion
FROM public.user_tutorial_progress
GROUP BY tutorial_id, version
ORDER BY tutorial_id, version;

-- Grant access to the view
GRANT SELECT ON public.tutorial_analytics TO authenticated;
GRANT SELECT ON public.tutorial_analytics TO service_role;

-- Insert sample tutorial progress for testing (optional)
-- This would typically be populated by the app
/*
INSERT INTO public.user_tutorial_progress (user_id, tutorial_id, version, skipped) VALUES
    ('11111111-1111-1111-1111-111111111111', 'customer_welcome', 1, false),
    ('22222222-2222-2222-2222-222222222222', 'cleaner_welcome', 1, false),
    ('33333333-3333-3333-3333-333333333333', 'customer_welcome', 1, true),
    ('44444444-4444-4444-4444-444444444444', 'first_booking', 1, false)
ON CONFLICT (user_id, tutorial_id) DO NOTHING;
*/

-- Create function to get user's tutorial status
CREATE OR REPLACE FUNCTION get_user_tutorial_status(target_user_id UUID)
RETURNS TABLE (
    tutorial_id VARCHAR(100),
    completed BOOLEAN,
    skipped BOOLEAN,
    completed_at TIMESTAMP WITH TIME ZONE,
    version INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        utp.tutorial_id,
        NOT utp.skipped as completed,
        utp.skipped,
        utp.completed_at,
        utp.version
    FROM public.user_tutorial_progress utp
    WHERE utp.user_id = target_user_id
    ORDER BY utp.completed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_user_tutorial_status(UUID) TO authenticated;

COMMENT ON TABLE public.user_tutorial_progress IS 'Tracks user progress through guided tutorials for onboarding and feature discovery';
COMMENT ON COLUMN public.user_tutorial_progress.tutorial_id IS 'Identifier for the specific tutorial (e.g., customer_welcome, first_booking)';
COMMENT ON COLUMN public.user_tutorial_progress.version IS 'Version of the tutorial (allows for tutorial updates)';
COMMENT ON COLUMN public.user_tutorial_progress.skipped IS 'Whether the user skipped the tutorial instead of completing it';
COMMENT ON COLUMN public.user_tutorial_progress.time_spent_seconds IS 'Total time user spent in the tutorial (optional)';
COMMENT ON VIEW public.tutorial_analytics IS 'Analytics view showing completion rates and metrics for all tutorials';

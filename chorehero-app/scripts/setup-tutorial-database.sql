-- Quick Tutorial Database Setup
-- Run this in your Supabase SQL editor

-- Create user_tutorial_progress table
CREATE TABLE IF NOT EXISTS public.user_tutorial_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tutorial_id VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    skipped BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_tutorial_progress_user_id ON public.user_tutorial_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tutorial_progress_tutorial_id ON public.user_tutorial_progress(tutorial_id);

-- Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tutorial_progress_unique 
ON public.user_tutorial_progress(user_id, tutorial_id);

-- Enable RLS
ALTER TABLE public.user_tutorial_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own tutorial progress" ON public.user_tutorial_progress
    FOR ALL USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.user_tutorial_progress TO authenticated;

-- Verify setup
SELECT 'Tutorial database setup complete!' as status;

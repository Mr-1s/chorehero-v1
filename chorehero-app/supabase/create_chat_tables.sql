-- Minimal Chat Tables Creation
-- Copy and paste this into Supabase SQL Editor and run it

-- First, let's see what tables exist
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%chat%';

-- Create the chat_rooms table (very basic version)
CREATE TABLE public.chat_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    participants TEXT[] NOT NULL,
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the chat_messages table (very basic version)
CREATE TABLE public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Simple policies (allow authenticated users to do everything for now)
CREATE POLICY "Enable all access for authenticated users" ON public.chat_rooms
    FOR ALL USING (auth.role() = 'authenticated');
    
CREATE POLICY "Enable all access for authenticated users" ON public.chat_messages
    FOR ALL USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT ALL ON public.chat_rooms TO authenticated;
GRANT ALL ON public.chat_messages TO authenticated;

-- Verify tables were created
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('chat_rooms', 'chat_messages');

-- Show success message
SELECT 'Chat tables created successfully!' as result;
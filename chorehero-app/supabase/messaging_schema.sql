-- Messaging System Database Schema
-- Run this in your Supabase SQL editor to create the messaging tables

-- Create chat_rooms table
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    participants TEXT[] NOT NULL,
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'booking_update')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_rooms_participants ON public.chat_rooms USING GIN (participants);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_message_at ON public.chat_rooms (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON public.chat_messages (room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read ON public.chat_messages (is_read) WHERE is_read = FALSE;

-- Enable Row Level Security (RLS)
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for chat_rooms
-- Users can only see rooms they participate in
CREATE POLICY "Users can view their own chat rooms" ON public.chat_rooms
    FOR SELECT USING (auth.uid()::text = ANY(participants));

-- Users can create chat rooms (will be validated in application logic)
CREATE POLICY "Users can create chat rooms" ON public.chat_rooms
    FOR INSERT WITH CHECK (auth.uid()::text = ANY(participants));

-- Users can update rooms they participate in (for last_message updates)
CREATE POLICY "Users can update their chat rooms" ON public.chat_rooms
    FOR UPDATE USING (auth.uid()::text = ANY(participants));

-- Create RLS policies for chat_messages
-- Users can view messages in rooms they participate in
CREATE POLICY "Users can view messages in their rooms" ON public.chat_messages
    FOR SELECT USING (
        auth.uid()::text IN (
            SELECT unnest(participants) 
            FROM public.chat_rooms 
            WHERE id = room_id
        )
    );

-- Users can send messages to rooms they participate in
CREATE POLICY "Users can send messages to their rooms" ON public.chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        auth.uid()::text IN (
            SELECT unnest(participants) 
            FROM public.chat_rooms 
            WHERE id = room_id
        )
    );

-- Users can update their own messages (for read status, etc.)
CREATE POLICY "Users can update messages in their rooms" ON public.chat_messages
    FOR UPDATE USING (
        auth.uid()::text IN (
            SELECT unnest(participants) 
            FROM public.chat_rooms 
            WHERE id = room_id
        )
    );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_chat_rooms_updated_at 
    BEFORE UPDATE ON public.chat_rooms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON public.chat_messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to update chat room's last_message when a message is inserted
CREATE OR REPLACE FUNCTION update_chat_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_rooms 
    SET 
        last_message = NEW.content,
        last_message_at = NEW.created_at
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update last_message
CREATE TRIGGER update_chat_room_last_message_trigger
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_chat_room_last_message();

-- Grant necessary permissions
GRANT ALL ON public.chat_rooms TO authenticated;
GRANT ALL ON public.chat_messages TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Optional: Create a view for easier querying of chat rooms with participant details
CREATE OR REPLACE VIEW public.chat_rooms_with_participants AS
SELECT 
    cr.*,
    json_agg(
        json_build_object(
            'id', u.id,
            'name', u.name,
            'avatar_url', u.avatar_url,
            'role', u.role
        )
    ) as participant_details
FROM public.chat_rooms cr
LEFT JOIN public.users u ON u.id::text = ANY(cr.participants)
GROUP BY cr.id, cr.participants, cr.last_message, cr.last_message_at, cr.created_at, cr.updated_at, cr.booking_id;

-- Grant access to the view
GRANT SELECT ON public.chat_rooms_with_participants TO authenticated;

-- Insert some sample data for testing (optional)
-- NOTE: Replace these UUIDs with actual user IDs from your users table
/*
INSERT INTO public.chat_rooms (participants, last_message, last_message_at) VALUES
    (ARRAY['user1-uuid-here', 'user2-uuid-here'], 'Hello! Ready to start cleaning?', NOW() - INTERVAL '1 hour'),
    (ARRAY['user3-uuid-here', 'user4-uuid-here'], 'Great service, thank you!', NOW() - INTERVAL '2 hours');
*/
-- Create chat_threads and chat_messages if missing (e.g. when using partial schema setup)
-- Fixes: "Could not find the table 'public.chat_threads' in the schema cache"

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('text', 'image', 'location', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.chat_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT UNIQUE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users(id) NOT NULL,
  cleaner_id UUID REFERENCES public.users(id) NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  message_type message_type DEFAULT 'text',
  content TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON public.chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS chat_threads_conversation_id_idx ON public.chat_threads(conversation_id);

DROP TRIGGER IF EXISTS update_chat_threads_updated_at ON public.chat_threads;
CREATE TRIGGER update_chat_threads_updated_at BEFORE UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat threads" ON public.chat_threads;
CREATE POLICY "Users can view own chat threads" ON public.chat_threads FOR SELECT USING (auth.uid() = customer_id OR auth.uid() = cleaner_id);

DROP POLICY IF EXISTS "Users can create chat threads" ON public.chat_threads;
CREATE POLICY "Users can create chat threads" ON public.chat_threads FOR INSERT WITH CHECK (
  (auth.uid() = customer_id OR auth.uid() = cleaner_id) AND EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = chat_threads.booking_id AND (bookings.customer_id = auth.uid() OR bookings.cleaner_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can update own chat threads" ON public.chat_threads;
CREATE POLICY "Users can update own chat threads" ON public.chat_threads FOR UPDATE USING (auth.uid() = customer_id OR auth.uid() = cleaner_id);

DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view own chat messages" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chat_threads WHERE chat_threads.id = chat_messages.thread_id AND (chat_threads.customer_id = auth.uid() OR chat_threads.cleaner_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can send chat messages" ON public.chat_messages;
CREATE POLICY "Users can send chat messages" ON public.chat_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.chat_threads WHERE chat_threads.id = chat_messages.thread_id AND (chat_threads.customer_id = auth.uid() OR chat_threads.cleaner_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can update chat messages" ON public.chat_messages;
CREATE POLICY "Users can update chat messages" ON public.chat_messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.chat_threads WHERE chat_threads.id = chat_messages.thread_id AND (chat_threads.customer_id = auth.uid() OR chat_threads.cleaner_id = auth.uid()))
);

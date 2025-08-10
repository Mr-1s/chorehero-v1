-- Check which chat tables actually exist in your database
-- Run this in Supabase SQL Editor

-- Check for chat_threads table
SELECT 'chat_threads' as table_name, EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'chat_threads'
) as exists;

-- Check for chat_rooms table  
SELECT 'chat_rooms' as table_name, EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'chat_rooms'
) as exists;

-- Check for chat_messages table
SELECT 'chat_messages' as table_name, EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'chat_messages'
) as exists;

-- Show all chat-related tables
SELECT table_name, column_name, data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name LIKE '%chat%'
ORDER BY table_name, ordinal_position;
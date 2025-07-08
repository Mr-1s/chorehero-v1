#!/bin/bash

echo "🚀 ChoreHero Supabase Setup Helper"
echo "=================================="
echo ""
echo "This script will show you what to copy into your Supabase SQL Editor"
echo ""

echo "📊 STEP 1: Copy this schema setup (creates all tables):"
echo "------------------------------------------------------"
echo "File: supabase/schema.sql"
echo "📋 Copy the entire file contents and paste into Supabase SQL Editor"
echo ""

echo "🔒 STEP 2: Copy this security setup (Row Level Security):"
echo "--------------------------------------------------------"  
echo "File: supabase/rls_policies.sql"
echo "📋 Copy the entire file contents and paste into Supabase SQL Editor"
echo ""

echo "✅ After running both files, your database will have:"
echo "- 15+ tables for the complete marketplace"
echo "- User authentication & profiles"
echo "- Booking & payment system"
echo "- Real-time chat & notifications"
echo "- Location tracking & maps"
echo "- Rating & review system"
echo "- Complete security policies"
echo ""

echo "🔧 Then update your .env file with:"
echo "EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
echo "EXPO_PUBLIC_DEV_MODE=false"
echo ""

echo "🎉 Ready to test your production app!" 
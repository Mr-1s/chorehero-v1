# Verification Docs Storage Bucket

For the MVP background check flow, create a storage bucket in Supabase:

1. Go to **Supabase Dashboard** → **Storage**
2. Click **New bucket**
3. Name: `verification-docs`
4. **Private** (recommended – ID photos should not be public)
5. Create bucket

Then add RLS policy so cleaners can upload their own docs:

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own verification docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'verification-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can read their own
CREATE POLICY "Users can read own verification docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'verification-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

Path format: `{userId}/id-front.jpg`, `{userId}/id-back.jpg`, `{userId}/selfie.jpg`

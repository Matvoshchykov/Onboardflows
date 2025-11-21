-- Storage policies for the 'uploads' bucket
-- Run this SQL in your Supabase SQL Editor after creating the 'uploads' bucket
-- This allows public read access and upload access to the bucket

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Public read access for uploads bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public upload access for uploads bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public update access for uploads bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access for uploads bucket" ON storage.objects;

-- Policy: Allow public read access to all files in uploads bucket
-- This allows anyone (including unauthenticated users) to read files
CREATE POLICY "Public read access for uploads bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');

-- Policy: Allow public upload access (anyone can upload)
-- This allows anyone (including unauthenticated users) to upload files
CREATE POLICY "Public upload access for uploads bucket"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'uploads');

-- Policy: Allow public update access
CREATE POLICY "Public update access for uploads bucket"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'uploads')
WITH CHECK (bucket_id = 'uploads');

-- Policy: Allow public delete access
CREATE POLICY "Public delete access for uploads bucket"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'uploads');


# Storage Setup Instructions

## Creating the Supabase Storage Bucket

The file upload feature requires a Supabase Storage bucket named `uploads`. You can create it in two ways:

### Option 1: Automatic Setup (Recommended)

Run the setup API endpoint:

```bash
curl -X POST http://localhost:3000/api/setup-storage
```

Or visit this URL in your browser while your dev server is running:
```
http://localhost:3000/api/setup-storage
```

### Option 2: Manual Setup

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Enter the bucket name: `uploads`
5. **Important:** Toggle **"Public bucket"** to ON (this allows public access to uploaded files)
6. Click **"Create bucket"**

### Bucket Configuration

- **Name:** `uploads`
- **Public:** Yes (required for file previews to work)
- **File size limit:** 10MB (default)
- **Allowed MIME types:** All (null)

### Folder Structure

The bucket will automatically organize files into folders:
- `uploads/files/` - Files uploaded via the file-upload component
- `uploads/videos/` - Videos uploaded via the video-step component  
- `uploads/images/` - Images uploaded via the image component

### Troubleshooting

If you get a "Bucket not found" error:
1. Make sure the bucket name is exactly `uploads` (case-sensitive)
2. Ensure the bucket is set to **Public**
3. Check that your Supabase credentials are correct in `.env.local`

### Storage Policies (IMPORTANT!)

After creating the bucket, you **must** set up Row Level Security (RLS) policies to allow file uploads. You have two options:

#### Option 1: Run SQL Script (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the file `supabase/storage-policies.sql` from this project
4. Copy **ALL** the SQL code (including the DROP statements)
5. Paste into the SQL Editor
6. Click **Run** to execute

**Important:** The SQL script includes `TO public` which explicitly allows unauthenticated users to access the bucket. This is required for the uploads to work.

This will create policies that allow:
- Public read access (anyone can view/download files)
- Public upload access (anyone can upload files)
- Public update/delete access

**After running the SQL, test it:**
- Visit `http://localhost:3000/api/test-storage` in your browser
- This will verify that the bucket and policies are set up correctly

#### Option 2: Manual Setup via Dashboard

1. Go to **Storage** in your Supabase dashboard
2. Click on the **"uploads"** bucket
3. Go to the **Policies** tab
4. Click **"New Policy"** and create these policies:

   **Policy 1: Public Read**
   - Policy name: "Public read access"
   - Allowed operation: SELECT
   - Target roles: **public** (important!)
   - USING expression: `bucket_id = 'uploads'`

   **Policy 2: Public Upload**
   - Policy name: "Public upload access"
   - Allowed operation: INSERT
   - Target roles: **public** (important!)
   - WITH CHECK expression: `bucket_id = 'uploads'`

   **Policy 3: Public Update**
   - Policy name: "Public update access"
   - Allowed operation: UPDATE
   - Target roles: **public** (important!)
   - USING expression: `bucket_id = 'uploads'`
   - WITH CHECK expression: `bucket_id = 'uploads'`

   **Policy 4: Public Delete**
   - Policy name: "Public delete access"
   - Allowed operation: DELETE
   - Target roles: **public** (important!)
   - USING expression: `bucket_id = 'uploads'`

**Note:** Make sure to set "Target roles" to **public** for all policies. This allows unauthenticated users to upload files.

### Troubleshooting RLS Errors

If you see "new row violates row-level security policy" error:
1. Make sure you've run the storage policies SQL script
2. Verify the policies exist in Storage > Policies for the "uploads" bucket
3. Check that the bucket is set to **Public**


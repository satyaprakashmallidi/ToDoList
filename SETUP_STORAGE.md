# File Sharing Setup Guide

## Supabase Storage Setup

The file sharing feature requires a Supabase Storage bucket to be created. Follow these steps:

### 1. Create Storage Bucket

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Storage**
   - Click on "Storage" in the left sidebar
   - Click "Create a new bucket"

3. **Create the bucket**
   - **Name**: `chat-files`
   - **Public**: ✅ **Check this box** (files need to be publicly accessible)
   - **File size limit**: Leave default or set to your preference (e.g., 50MB)
   - **Allowed MIME types**: Leave empty for all types, or specify if needed

### 2. Set Storage Policies (Important!)

After creating the bucket, you need to set up Row Level Security policies:

1. **Go to Storage Policies**
   - In Storage section, click on "Policies"
   - Select the `chat-files` bucket

2. **Create Upload Policy**
   - Click "New Policy"
   - **Policy Name**: `Users can upload their own files`
   - **Allowed Operations**: `INSERT`
   - **Target Roles**: `authenticated`
   - **Using Expression**:
   ```sql
   (bucket_id = 'chat-files') AND (auth.uid()::text = (storage.foldername(name))[1])
   ```

3. **Create Download Policy**
   - Click "New Policy"
   - **Policy Name**: `Anyone can view uploaded files`
   - **Allowed Operations**: `SELECT`
   - **Target Roles**: `public`
   - **Using Expression**:
   ```sql
   bucket_id = 'chat-files'
   ```

### 3. Alternative: Quick SQL Setup

You can also run this SQL in the Supabase SQL editor:

```sql
-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true);

-- Create upload policy (users can upload to their own folder)
CREATE POLICY "Users can upload their own files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create download policy (anyone can view files)
CREATE POLICY "Anyone can view uploaded files" ON storage.objects
FOR SELECT USING (bucket_id = 'chat-files');
```

### 4. Test the Setup

1. **Try uploading a file** in the chat application
2. **Check the browser console** for detailed upload logs
3. **Verify the file appears** in Storage > chat-files bucket

### Troubleshooting

If files still don't upload:

1. **Check browser console** - detailed error messages are logged
2. **Verify bucket is public** - Private buckets won't work
3. **Check policies** - Make sure both upload and download policies exist
4. **File size limits** - Check if files exceed bucket limits
5. **CORS settings** - May need to be configured for file uploads

### Fallback Behavior

If storage setup fails, the app will:
- Fall back to blob URLs (temporary, local-only)
- Show warnings in console
- Files will still appear in chat but won't persist across sessions
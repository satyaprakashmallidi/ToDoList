# Supabase Storage Setup for Chat File Sharing

## Problem Fixed
Files shared in chat were using temporary blob URLs that only worked in the sender's browser. This caused "network error" when recipients tried to download files. Now files are uploaded to Supabase Storage with permanent URLs that work for all users.

## Setup Instructions

### Step 1: Create Storage Bucket

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Configure the bucket:
   - **Name**: `chat-files`
   - **Public bucket**: Toggle ON (this allows anyone with the URL to download files)
   - **File size limit**: 50MB (or adjust as needed)
   - **Allowed MIME types**: Leave empty to allow all file types
5. Click **"Create bucket"**

### Step 2: Apply Storage Policies

1. In Supabase Dashboard, go to **SQL Editor**
2. Open the file `sql/chat-storage-setup.sql` from this project
3. Copy and run the SQL to set up proper policies
4. This will ensure:
   - Users can upload files to their own folder
   - Anyone can view/download shared files (public bucket)
   - Users can delete their own files

### Step 3: Test File Sharing

1. Start the application: `npm run dev`
2. Log in and navigate to Chat
3. Test file sharing:
   - Click the paperclip icon or drag & drop files
   - Send images, videos, documents, etc.
   - Verify files upload successfully
   - Have another user download the files
   - Files should now download without network errors

## How It Works

### File Upload Flow
1. User selects files via paperclip button or drag & drop
2. Files are uploaded to Supabase Storage in path: `{user_id}/{timestamp}-{filename}`
3. Public URLs are generated for each file
4. URLs are stored in message content as JSON
5. Recipients can view/download files using the permanent URLs

### Fallback Mechanism
If Supabase Storage is not configured, the app falls back to blob URLs with a warning in console. This ensures the app still works during development, but files won't be accessible to other users.

### File Types Supported
- 📷 Images (PNG, JPG, GIF, etc.) - inline preview
- 🎥 Videos (MP4, MOV, etc.) - inline player
- 🎵 Audio (MP3, WAV, etc.) - inline player
- 📄 Documents (PDF, DOC, XLS, etc.) - icon with download
- 📊 Data files (CSV, JSON, etc.) - icon with download
- 📦 Any other file type - generic icon with download

## Troubleshooting

### "Storage bucket not found" Error
- Make sure you created the bucket named exactly `chat-files`
- Check that your Supabase project is active (not paused)

### Files Upload But Can't Download
- Verify the bucket is set as PUBLIC
- Check that storage policies are applied correctly
- Ensure your Supabase URL and anon key are correct in `.env`

### File Size Errors
- Default limit is 50MB per file
- Adjust in Supabase Dashboard > Storage > chat-files > Edit

### CORS Issues
- Supabase handles CORS automatically for public buckets
- If issues persist, check Supabase Dashboard > Settings > API

## Security Notes

### Public Bucket Approach (Current)
- **Pros**: Simple, no authentication needed for downloads
- **Cons**: Anyone with URL can access files
- **Use Case**: Good for non-sensitive file sharing

### Private Bucket Alternative
If you need more security:
1. Set bucket as PRIVATE in Supabase
2. Use signed URLs with expiration
3. Track file permissions in database
4. See commented section in `sql/chat-storage-setup.sql`

## Next Steps

After setup:
1. ✅ Files will upload to Supabase Storage
2. ✅ URLs will be permanent and shareable
3. ✅ All users can download shared files
4. ✅ No more "network error" issues

For production:
- Consider implementing file type restrictions
- Add file size validation before upload
- Implement file cleanup for old messages
- Add virus scanning for uploaded files (Supabase extension)
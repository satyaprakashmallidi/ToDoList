-- Profile Update SQL Queries
-- These queries handle updating user profile data for the Profile webpage

-- ============================================================
-- 1. UPDATE BASIC PROFILE INFORMATION
-- Updates the core profile fields in the profiles table
-- ============================================================

-- Update basic profile data (name, full_name, updated_at)
UPDATE profiles 
SET 
  name = $1,                    -- nickname or firstName if nickname is empty
  full_name = $2,               -- "firstName lastName" combined
  updated_at = NOW()
WHERE id = $3;                  -- user.id from auth

-- Example usage:
-- name: nickName.trim() || firstName.trim()
-- full_name: `${firstName.trim()} ${lastName.trim()}`.trim()
-- id: user.id

-- ============================================================
-- 2. UPDATE EXTENDED PROFILE INFORMATION
-- Updates additional profile fields (may require table structure changes)
-- ============================================================

-- Update extended profile fields (if columns exist in profiles table)
UPDATE profiles 
SET 
  first_name = $1,              -- firstName from form
  last_name = $2,               -- lastName from form  
  gender = $3,                  -- selected gender
  country = $4,                 -- selected country
  language = $5,                -- selected language
  time_zone = $6,               -- selected timezone
  updated_at = NOW()
WHERE id = $7;                  -- user.id from auth

-- Example usage:
-- first_name: firstName.trim() || null
-- last_name: lastName.trim() || null
-- gender: gender || null
-- country: country || null
-- language: language || null
-- time_zone: timeZone || null
-- id: user.id

-- ============================================================
-- 3. UPSERT PROFILE (INSERT OR UPDATE)
-- Ensures profile exists, creates if needed, updates if exists
-- ============================================================

-- Upsert profile data (recommended approach)
INSERT INTO profiles (
  id, 
  name, 
  full_name, 
  first_name, 
  last_name, 
  gender, 
  country, 
  language, 
  time_zone, 
  created_at, 
  updated_at
) 
VALUES (
  $1,                           -- user.id
  $2,                           -- name
  $3,                           -- full_name
  $4,                           -- first_name
  $5,                           -- last_name
  $6,                           -- gender
  $7,                           -- country
  $8,                           -- language
  $9,                           -- time_zone
  NOW(),
  NOW()
)
ON CONFLICT (id) 
DO UPDATE SET
  name = EXCLUDED.name,
  full_name = EXCLUDED.full_name,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  gender = EXCLUDED.gender,
  country = EXCLUDED.country,
  language = EXCLUDED.language,
  time_zone = EXCLUDED.time_zone,
  updated_at = NOW();

-- ============================================================
-- 4. MANAGE ADDITIONAL EMAIL ADDRESSES
-- Handle multiple email addresses per user
-- ============================================================

-- Insert new email address
INSERT INTO user_emails (
  user_id,
  email,
  is_verified,
  created_at
) 
VALUES (
  $1,                           -- user.id
  $2,                           -- email address
  false,                        -- default unverified
  NOW()
);

-- Remove email address
DELETE FROM user_emails 
WHERE user_id = $1 AND email = $2;

-- Get all user emails
SELECT email, is_verified, created_at 
FROM user_emails 
WHERE user_id = $1 
ORDER BY created_at DESC;

-- ============================================================
-- 5. NOTIFICATION MANAGEMENT
-- Handle user notifications (if using database instead of localStorage)
-- ============================================================

-- Insert new notification
INSERT INTO notifications (
  user_id,
  type,
  title,
  content,
  source_user_name,
  is_read,
  link,
  created_at
) 
VALUES (
  $1,                           -- user_id
  $2,                           -- type ('message', 'task', 'channel', 'like')
  $3,                           -- title
  $4,                           -- content
  $5,                           -- source_user_name
  false,                        -- default unread
  $6,                           -- link
  NOW()
);

-- Mark notification as read
UPDATE notifications 
SET is_read = true 
WHERE id = $1 AND user_id = $2;

-- Mark all notifications as read
UPDATE notifications 
SET is_read = true 
WHERE user_id = $1 AND is_read = false;

-- Get user notifications
SELECT 
  id,
  type,
  title,
  content,
  source_user_name,
  is_read,
  link,
  created_at
FROM notifications 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT $2;

-- Delete all notifications for user
DELETE FROM notifications WHERE user_id = $1;

-- ============================================================
-- 6. TABLE CREATION QUERIES (IF NEEDED)
-- Create tables if they don't exist
-- ============================================================

-- Extended profiles table structure (if not exists)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer-not-to-say')),
  country TEXT,
  language TEXT,
  time_zone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User emails table
CREATE TABLE IF NOT EXISTS user_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'task', 'channel', 'like', 'system')),
  title TEXT NOT NULL,
  content TEXT,
  source_user_name TEXT,
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- Ensure users can only access their own data
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User emails RLS policies
CREATE POLICY "Users can manage own emails" ON user_emails
  FOR ALL USING (auth.uid() = user_id);

-- Notifications RLS policies
CREATE POLICY "Users can manage own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 8. INDEXES FOR PERFORMANCE
-- Optimize query performance
-- ============================================================

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_emails_user_id ON user_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread ON notifications(user_id) WHERE is_read = false;

-- ============================================================
-- 9. EXAMPLE USAGE IN TYPESCRIPT/JAVASCRIPT
-- How to use these queries in your Supabase client
-- ============================================================

/*
// TypeScript/JavaScript usage examples:

// 1. Update basic profile
const { error } = await supabase
  .from('profiles')
  .update({
    name: nickName.trim() || firstName.trim(),
    full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
    updated_at: new Date().toISOString()
  })
  .eq('id', user.id);

// 2. Upsert extended profile
const { error } = await supabase
  .from('profiles')
  .upsert({
    id: user.id,
    name: nickName.trim() || firstName.trim(),
    full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
    first_name: firstName.trim() || null,
    last_name: lastName.trim() || null,
    gender: gender || null,
    country: country || null,
    language: language || null,
    time_zone: timeZone || null
  });

// 3. Add email
const { error } = await supabase
  .from('user_emails')
  .insert({
    user_id: user.id,
    email: newEmail.trim(),
    is_verified: false
  });

// 4. Remove email
const { error } = await supabase
  .from('user_emails')
  .delete()
  .eq('user_id', user.id)
  .eq('email', emailToRemove);

// 5. Get user data
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();

const { data: emails } = await supabase
  .from('user_emails')
  .select('email, is_verified, created_at')
  .eq('user_id', user.id);

const { data: notifications } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
*/
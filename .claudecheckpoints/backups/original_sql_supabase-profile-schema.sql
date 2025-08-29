-- ============================================================
-- SUPABASE PROFILE DATA MIGRATION - COMPLETE SCHEMA
-- Migrate all profile data from localStorage to Supabase database
-- ============================================================

-- ============================================================
-- 1. DROP EXISTING TABLES (IF RECREATING)
-- ============================================================
-- Uncomment these lines if you need to recreate tables
-- DROP TABLE IF EXISTS notifications CASCADE;
-- DROP TABLE IF EXISTS user_emails CASCADE;
-- DROP TABLE IF EXISTS user_preferences CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================
-- 2. CREATE EXTENDED PROFILES TABLE
-- Store all profile information including localStorage data
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  -- Primary key linked to auth.users
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic profile info
  email TEXT, -- Copy from auth.users for quick access
  name TEXT, -- Nickname/display name
  full_name TEXT, -- Full name combination
  
  -- Extended profile info (from localStorage)
  first_name TEXT,
  last_name TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer-not-to-say')),
  country TEXT,
  language TEXT,
  time_zone TEXT,
  
  -- Additional profile fields
  avatar_url TEXT,
  bio TEXT,
  phone TEXT,
  date_of_birth DATE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. CREATE USER EMAILS TABLE
-- Store additional email addresses (from localStorage)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique email per user
  UNIQUE(user_id, email)
);

-- ============================================================
-- 4. CREATE NOTIFICATIONS TABLE
-- Store user notifications (from localStorage)
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification details
  type TEXT NOT NULL CHECK (type IN ('message', 'task', 'channel', 'like', 'system')),
  title TEXT NOT NULL,
  content TEXT,
  source_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_user_name TEXT, -- Cached name for performance
  
  -- Status and metadata
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- ============================================================
-- 5. CREATE USER PREFERENCES TABLE
-- Store user app preferences and settings
-- ============================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Preference categories
  category TEXT NOT NULL, -- 'theme', 'notifications', 'privacy', etc.
  key TEXT NOT NULL, -- Specific setting key
  value JSONB, -- Setting value (flexible JSON)
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique preference per user
  UNIQUE(user_id, category, key)
);

-- ============================================================
-- 6. ENABLE ROW LEVEL SECURITY (RLS)
-- Protect user data with proper access controls
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. CREATE RLS POLICIES
-- Define who can access what data
-- ============================================================

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE USING (auth.uid() = id);

-- USER EMAILS POLICIES
CREATE POLICY "Users can manage own emails" ON user_emails
  FOR ALL USING (auth.uid() = user_id);

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true); -- Allow system to create notifications

CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- USER PREFERENCES POLICIES
CREATE POLICY "Users can manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 8. CREATE PERFORMANCE INDEXES
-- Optimize database queries
-- ============================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name);

-- User emails indexes
CREATE INDEX IF NOT EXISTS idx_user_emails_user_id ON user_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emails_email ON user_emails(email);
CREATE INDEX IF NOT EXISTS idx_user_emails_primary ON user_emails(user_id, is_primary) WHERE is_primary = true;

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- User preferences indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_category ON user_preferences(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at ON user_preferences(updated_at DESC);

-- ============================================================
-- 9. CREATE TRIGGERS FOR AUTO-TIMESTAMPS
-- Automatically update timestamps
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_emails_updated_at 
  BEFORE UPDATE ON user_emails 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
  BEFORE UPDATE ON user_preferences 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 10. CREATE FUNCTIONS FOR PROFILE OPERATIONS
-- Helper functions for common operations
-- ============================================================

-- Function to create or update complete profile
CREATE OR REPLACE FUNCTION upsert_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_language TEXT DEFAULT NULL,
  p_time_zone TEXT DEFAULT NULL
)
RETURNS profiles AS $$
DECLARE
  result profiles;
  computed_full_name TEXT;
  computed_name TEXT;
BEGIN
  -- Compute derived fields
  computed_full_name := TRIM(CONCAT(p_first_name, ' ', p_last_name));
  computed_name := COALESCE(p_name, p_first_name, SPLIT_PART(p_email, '@', 1));
  
  -- Upsert profile
  INSERT INTO profiles (
    id, email, first_name, last_name, name, full_name,
    gender, country, language, time_zone
  ) VALUES (
    p_user_id, p_email, p_first_name, p_last_name, computed_name, computed_full_name,
    p_gender, p_country, p_language, p_time_zone
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    gender = EXCLUDED.gender,
    country = EXCLUDED.country,
    language = EXCLUDED.language,
    time_zone = EXCLUDED.time_zone,
    updated_at = NOW()
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add user email
CREATE OR REPLACE FUNCTION add_user_email(
  p_user_id UUID,
  p_email TEXT,
  p_is_primary BOOLEAN DEFAULT false
)
RETURNS user_emails AS $$
DECLARE
  result user_emails;
BEGIN
  -- If setting as primary, unset other primary emails
  IF p_is_primary THEN
    UPDATE user_emails 
    SET is_primary = false 
    WHERE user_id = p_user_id AND is_primary = true;
  END IF;
  
  -- Insert new email
  INSERT INTO user_emails (user_id, email, is_primary)
  VALUES (p_user_id, p_email, p_is_primary)
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_content TEXT DEFAULT NULL,
  p_source_user_name TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS notifications AS $$
DECLARE
  result notifications;
BEGIN
  INSERT INTO notifications (
    user_id, type, title, content, source_user_name, link, priority
  ) VALUES (
    p_user_id, p_type, p_title, p_content, p_source_user_name, p_link, p_priority
  )
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 11. SAMPLE DATA MIGRATION QUERIES
-- Examples of how to migrate localStorage data
-- ============================================================

-- Example: Migrate profile data from localStorage
-- (Run this in your application, not directly in SQL)
/*
-- JavaScript/TypeScript code to migrate localStorage to Supabase:

const migrateProfileData = async (userId) => {
  try {
    // Get data from localStorage
    const profileData = localStorage.getItem(`profile_${userId}`);
    const emailData = localStorage.getItem(`emails_${userId}`);
    const notificationData = localStorage.getItem(`notifications_${userId}`);
    
    if (profileData) {
      const profile = JSON.parse(profileData);
      
      // Migrate profile data
      const { error: profileError } = await supabase
        .rpc('upsert_user_profile', {
          p_user_id: userId,
          p_email: user.email,
          p_first_name: profile.firstName,
          p_last_name: profile.lastName,
          p_gender: profile.gender,
          p_country: profile.country,
          p_language: profile.language,
          p_time_zone: profile.timeZone
        });
      
      if (!profileError) {
        localStorage.removeItem(`profile_${userId}`);
        console.log('Profile migrated to Supabase');
      }
    }
    
    if (emailData) {
      const emails = JSON.parse(emailData);
      
      // Migrate email data
      for (const email of emails) {
        await supabase.rpc('add_user_email', {
          p_user_id: userId,
          p_email: email,
          p_is_primary: false
        });
      }
      
      localStorage.removeItem(`emails_${userId}`);
      console.log('Emails migrated to Supabase');
    }
    
    if (notificationData) {
      const notifications = JSON.parse(notificationData);
      
      // Migrate notifications
      for (const notification of notifications) {
        await supabase.rpc('create_notification', {
          p_user_id: userId,
          p_type: notification.type,
          p_title: notification.title,
          p_content: notification.content,
          p_source_user_name: notification.source_user_name,
          p_link: notification.link
        });
      }
      
      localStorage.removeItem(`notifications_${userId}`);
      console.log('Notifications migrated to Supabase');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
};
*/

-- ============================================================
-- 12. CLEANUP OLD DATA (OPTIONAL)
-- Remove old or expired data
-- ============================================================

-- Create function to cleanup expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications 
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to cleanup old read notifications (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_read_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications 
  WHERE is_read = true 
    AND read_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 13. GRANT PERMISSIONS (IF NEEDED)
-- Grant necessary permissions to authenticated users
-- ============================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions on tables
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON user_emails TO authenticated;
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON user_preferences TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION upsert_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_email TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;

-- ============================================================
-- MIGRATION COMPLETE
-- Your Supabase database is now ready to store all profile data!
-- 
-- Next steps:
-- 1. Run this SQL in your Supabase SQL editor
-- 2. Update your Profile.tsx component to use Supabase instead of localStorage
-- 3. Test the migration with a few users
-- 4. Deploy to production
-- ============================================================
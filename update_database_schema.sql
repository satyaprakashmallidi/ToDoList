-- =====================================================
-- Update Database Schema for ToDoList Application
-- =====================================================

-- Add missing columns to profiles table if they don't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update the handle_new_user function to include full_name and avatar_url
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, name, avatar_url)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update profiles for existing users who might not have full_name
UPDATE profiles 
SET full_name = COALESCE(full_name, name, split_part(email, '@', 1))
WHERE full_name IS NULL;

-- Ensure all required columns exist in tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Ensure all required indexes exist
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name);
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_url ON profiles(avatar_url);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema has been updated successfully!';
    RAISE NOTICE 'Added full_name and avatar_url columns to profiles table';
    RAISE NOTICE 'Updated handle_new_user function';
    RAISE NOTICE 'All existing profiles now have full_name populated';
END $$;
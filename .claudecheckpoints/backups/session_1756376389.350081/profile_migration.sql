-- Add new columns to profiles table for enhanced profile information
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS language TEXT,
ADD COLUMN IF NOT EXISTS time_zone TEXT;

-- Add comments for the new columns
COMMENT ON COLUMN profiles.first_name IS 'User first name';
COMMENT ON COLUMN profiles.last_name IS 'User last name';
COMMENT ON COLUMN profiles.gender IS 'User gender (male, female, other, prefer-not-to-say)';
COMMENT ON COLUMN profiles.country IS 'User country code (us, in, uk, ca, au, de, fr, other)';
COMMENT ON COLUMN profiles.language IS 'User preferred language (en, es, fr, de, zh, hi, other)';
COMMENT ON COLUMN profiles.time_zone IS 'User time zone (UTC-8, UTC-5, UTC+0, UTC+5:30, UTC+8, other)';
-- RLS Policies for user_status table
-- This table is specifically for tracking timer/work session status

-- Enable RLS if not already enabled
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all team member status" ON user_status;
DROP POLICY IF EXISTS "Users can manage their own status" ON user_status;

-- Create RLS policies
-- Users can read all team members' status (for team visibility)
CREATE POLICY "Users can view all team member status" ON user_status
  FOR SELECT USING (true);

-- Users can only insert/update/delete their own status
CREATE POLICY "Users can manage their own status" ON user_status
  FOR ALL USING (auth.uid() = user_id);

-- Create or replace function to automatically update timestamps
CREATE OR REPLACE FUNCTION update_user_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_active = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function already exists from your table creation, but ensure trigger is set
DROP TRIGGER IF EXISTS update_user_status_updated_at_trigger ON user_status;
CREATE TRIGGER update_user_status_updated_at_trigger
  BEFORE UPDATE ON user_status
  FOR EACH ROW
  EXECUTE FUNCTION update_user_status_updated_at();

-- Function to cleanup inactive users (set them offline after 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_inactive_status()
RETURNS void AS $$
BEGIN
  UPDATE user_status 
  SET status = 'offline', updated_at = NOW()
  WHERE status != 'offline' 
    AND last_active < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON user_status TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Note: Both tables serve different purposes:
-- user_presence: General app presence (online/offline/idle/dnd)
-- user_status: Timer/work session tracking (online/break/offline with activity)
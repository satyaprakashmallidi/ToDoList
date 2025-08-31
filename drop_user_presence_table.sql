-- Optional: Drop user_presence table if not needed
-- Only run this if you're sure user_presence is not used elsewhere in your application

-- Drop the table (this will also drop all associated policies, triggers, and indexes)
DROP TABLE IF EXISTS user_presence CASCADE;

-- Note: The user_status table is sufficient for tracking team member work sessions
-- user_status tracks: online/break/offline status with work activity (focus, relax, etc.)
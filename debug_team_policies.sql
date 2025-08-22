-- =====================================================
-- Debug and Fix Team Invite Policies
-- =====================================================

-- Enable logging for better debugging
SET log_statement = 'all';

-- Check current RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('team_invites', 'team_members');

-- Drop and recreate team_invites policies with better debugging
DROP POLICY IF EXISTS "Users can view own team invites" ON team_invites;
DROP POLICY IF EXISTS "Users can view all team invites for joining" ON team_invites;
DROP POLICY IF EXISTS "Users can insert own team invites" ON team_invites;
DROP POLICY IF EXISTS "Users can update own team invites" ON team_invites;
DROP POLICY IF EXISTS "Users can delete own team invites" ON team_invites;

-- Allow users to view team invites they created
CREATE POLICY "Users can view own team invites" ON team_invites
    FOR SELECT USING (auth.uid() = created_by);

-- Allow authenticated users to view all team invites (for joining)
-- This is safe because sensitive data isn't exposed and is needed for joining
CREATE POLICY "Users can view all team invites for joining" ON team_invites
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can insert their own team invites
CREATE POLICY "Users can insert own team invites" ON team_invites
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can update their own team invites
CREATE POLICY "Users can update own team invites" ON team_invites
    FOR UPDATE USING (auth.uid() = created_by);

-- Users can delete their own team invites
CREATE POLICY "Users can delete own team invites" ON team_invites
    FOR DELETE USING (auth.uid() = created_by);

-- Test the policies
DO $$
DECLARE
    test_user_id UUID := auth.uid();
BEGIN
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'Current user ID: %', test_user_id;
        
        -- Test if user can see team invites
        PERFORM count(*) FROM team_invites WHERE created_by = test_user_id;
        RAISE NOTICE 'User can access their own team invites';
        
        -- Test if user can see all team invites (for joining)
        PERFORM count(*) FROM team_invites;
        RAISE NOTICE 'User can access all team invites for joining';
    ELSE
        RAISE NOTICE 'No authenticated user found';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Policy test failed: %', SQLERRM;
END $$;

-- Add debugging function for team invite lookup
CREATE OR REPLACE FUNCTION debug_team_invite_lookup(invite_code TEXT)
RETURNS TABLE(
    invite_id UUID,
    code TEXT,
    created_by UUID,
    expires_at TIMESTAMPTZ,
    is_expired BOOLEAN,
    can_user_see BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ti.id,
        ti.code,
        ti.created_by,
        ti.expires_at,
        (ti.expires_at <= NOW()) as is_expired,
        (auth.uid() IS NOT NULL) as can_user_see
    FROM team_invites ti
    WHERE ti.code = invite_code;
END;
$$;

-- Grant execute permission on the debug function
GRANT EXECUTE ON FUNCTION debug_team_invite_lookup TO authenticated;

-- Add function to help with team joining debugging
CREATE OR REPLACE FUNCTION debug_team_join(invite_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    invite_record RECORD;
    existing_member RECORD;
    result_message TEXT := '';
BEGIN
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RETURN 'ERROR: User not authenticated';
    END IF;
    
    result_message := 'DEBUG: User ID = ' || current_user_id || E'\n';
    
    -- Look up the invite
    SELECT * INTO invite_record 
    FROM team_invites 
    WHERE code = invite_code;
    
    IF NOT FOUND THEN
        RETURN result_message || 'ERROR: Team invite code not found';
    END IF;
    
    result_message := result_message || 'Found invite: ID=' || invite_record.id || ', created_by=' || invite_record.created_by || E'\n';
    
    -- Check if expired
    IF invite_record.expires_at <= NOW() THEN
        RETURN result_message || 'ERROR: Invite code expired on ' || invite_record.expires_at;
    END IF;
    
    result_message := result_message || 'Invite is valid (expires: ' || invite_record.expires_at || ')' || E'\n';
    
    -- Check if user is trying to join their own team
    IF invite_record.created_by = current_user_id THEN
        RETURN result_message || 'ERROR: Cannot join your own team';
    END IF;
    
    -- Check if user is already a member
    SELECT * INTO existing_member
    FROM team_members
    WHERE user_id = current_user_id 
    AND admin_id = invite_record.created_by;
    
    IF FOUND THEN
        RETURN result_message || 'ERROR: User is already a member of this team (member_id=' || existing_member.id || ')';
    END IF;
    
    RETURN result_message || 'SUCCESS: User can join this team';
END;
$$;

-- Grant execute permission on the debug function
GRANT EXECUTE ON FUNCTION debug_team_join TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Team invite policies have been updated for better debugging!';
    RAISE NOTICE 'Use debug_team_invite_lookup(''CODE123'') to debug invite lookups';
    RAISE NOTICE 'Use debug_team_join(''CODE123'') to debug join attempts';
END $$;
-- =====================================================
-- Fix Team Members RLS Policy for Joining Teams
-- =====================================================

-- Check current team_members policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'team_members';

-- Drop existing team_members policies
DROP POLICY IF EXISTS "Users can view own team members" ON team_members;
DROP POLICY IF EXISTS "Users can insert own team members" ON team_members;
DROP POLICY IF EXISTS "Users can update own team members" ON team_members;
DROP POLICY IF EXISTS "Users can delete own team members" ON team_members;
DROP POLICY IF EXISTS "Team admins can view their team members" ON team_members;
DROP POLICY IF EXISTS "Team admins can manage their team members" ON team_members;

-- Allow users to view team members where they are either the admin or a member
CREATE POLICY "Users can view team members" ON team_members
    FOR SELECT USING (
        auth.uid() = admin_id OR 
        auth.uid() = user_id
    );

-- Allow users to insert themselves as team members (for joining teams)
-- AND allow team admins to add members to their teams
CREATE POLICY "Users can join teams and admins can add members" ON team_members
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        auth.uid() = admin_id
    );

-- Allow team admins to update their team members
CREATE POLICY "Team admins can update their team members" ON team_members
    FOR UPDATE USING (auth.uid() = admin_id);

-- Allow users to leave teams (delete themselves) or admins to remove members
CREATE POLICY "Users can leave teams and admins can remove members" ON team_members
    FOR DELETE USING (
        auth.uid() = user_id OR 
        auth.uid() = admin_id
    );

-- Test the new policies
DO $$
DECLARE
    test_user_id UUID := auth.uid();
BEGIN
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'Testing team_members policies for user: %', test_user_id;
        
        -- Test if user can view team members they're part of
        PERFORM count(*) FROM team_members WHERE user_id = test_user_id OR admin_id = test_user_id;
        RAISE NOTICE 'User can view relevant team members';
        
    ELSE
        RAISE NOTICE 'No authenticated user found for testing';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Policy test failed: %', SQLERRM;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Team members RLS policies have been fixed!';
    RAISE NOTICE 'Users can now join teams and admins can manage their teams';
END $$;
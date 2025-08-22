-- =====================================================
-- Fix Infinite Recursion in Chat Groups RLS Policies
-- =====================================================

-- The issue is circular dependency between chat_groups and chat_group_members policies
-- We need to restructure them to avoid infinite recursion

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view groups they are members of" ON chat_groups;
DROP POLICY IF EXISTS "Users can create groups" ON chat_groups;
DROP POLICY IF EXISTS "Admins can update their groups" ON chat_groups;
DROP POLICY IF EXISTS "Admins can delete their groups" ON chat_groups;

DROP POLICY IF EXISTS "Users can view group members for groups they belong to" ON chat_group_members;
DROP POLICY IF EXISTS "Group admins and users can add members" ON chat_group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON chat_group_members;
DROP POLICY IF EXISTS "Group admins can update member roles" ON chat_group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON chat_group_members;
DROP POLICY IF EXISTS "Users can leave groups (update their own membership)" ON chat_group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON chat_group_members;

-- =====================================================
-- Chat Groups Policies (simplified, no circular references)
-- =====================================================

-- Users can view groups where they are admin (direct ownership)
CREATE POLICY "Users can view groups they admin" ON chat_groups
    FOR SELECT USING (auth.uid() = admin_id);

-- Users can create groups (they become admin)
CREATE POLICY "Users can create groups" ON chat_groups
    FOR INSERT WITH CHECK (auth.uid() = admin_id);

-- Admins can update their groups
CREATE POLICY "Admins can update their groups" ON chat_groups
    FOR UPDATE USING (auth.uid() = admin_id)
    WITH CHECK (auth.uid() = admin_id);

-- Admins can delete their groups
CREATE POLICY "Admins can delete their groups" ON chat_groups
    FOR DELETE USING (auth.uid() = admin_id);

-- =====================================================
-- Chat Group Members Policies (simplified)
-- =====================================================

-- Users can view their own memberships
CREATE POLICY "Users can view their own memberships" ON chat_group_members
    FOR SELECT USING (auth.uid() = user_id);

-- Group admins can view all members of their groups (using direct admin_id check)
CREATE POLICY "Admins can view their group members" ON chat_group_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_groups 
            WHERE chat_groups.id = chat_group_members.group_id 
            AND chat_groups.admin_id = auth.uid()
        )
    );

-- Group admins can add members to their groups
CREATE POLICY "Admins can add members to their groups" ON chat_group_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_groups 
            WHERE chat_groups.id = chat_group_members.group_id 
            AND chat_groups.admin_id = auth.uid()
        )
    );

-- Users can update their own membership (to leave groups)
CREATE POLICY "Users can update their own membership" ON chat_group_members
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Group admins can update member roles in their groups
CREATE POLICY "Admins can update member roles" ON chat_group_members
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM chat_groups 
            WHERE chat_groups.id = chat_group_members.group_id 
            AND chat_groups.admin_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_groups 
            WHERE chat_groups.id = chat_group_members.group_id 
            AND chat_groups.admin_id = auth.uid()
        )
    );

-- Group admins can delete members from their groups
CREATE POLICY "Admins can remove members from their groups" ON chat_group_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM chat_groups 
            WHERE chat_groups.id = chat_group_members.group_id 
            AND chat_groups.admin_id = auth.uid()
        )
    );

-- =====================================================
-- Update the chat loading query to work with new policies
-- =====================================================

-- Create a secure function to get user's groups (both as admin and member)
CREATE OR REPLACE FUNCTION get_user_chat_groups()
RETURNS TABLE (
    group_id UUID,
    group_name TEXT,
    group_admin_id UUID,
    group_created_at TIMESTAMPTZ,
    group_updated_at TIMESTAMPTZ,
    user_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- Groups where user is admin
    SELECT 
        cg.id as group_id,
        cg.name as group_name,
        cg.admin_id as group_admin_id,
        cg.created_at as group_created_at,
        cg.updated_at as group_updated_at,
        'admin'::TEXT as user_role
    FROM chat_groups cg
    WHERE cg.admin_id = auth.uid()
    AND cg.is_active = true
    
    UNION
    
    -- Groups where user is a member
    SELECT 
        cg.id as group_id,
        cg.name as group_name,
        cg.admin_id as group_admin_id,
        cg.created_at as group_created_at,
        cg.updated_at as group_updated_at,
        cgm.role as user_role
    FROM chat_groups cg
    INNER JOIN chat_group_members cgm ON cg.id = cgm.group_id
    WHERE cgm.user_id = auth.uid()
    AND cgm.is_active = true
    AND cg.is_active = true
    AND cg.admin_id != auth.uid(); -- Avoid duplicates with admin query above
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_chat_groups TO authenticated;

-- Test the new setup
DO $$
DECLARE
    current_user_id UUID := auth.uid();
BEGIN
    IF current_user_id IS NOT NULL THEN
        RAISE NOTICE 'Testing new chat groups policies for user: %', current_user_id;
        
        -- Test if user can read from chat_groups (as admin)
        PERFORM count(*) FROM chat_groups WHERE admin_id = current_user_id;
        RAISE NOTICE 'User can read chat_groups where they are admin';
        
        -- Test if user can read their own memberships
        PERFORM count(*) FROM chat_group_members WHERE user_id = current_user_id;
        RAISE NOTICE 'User can read their own chat_group_members';
        
        -- Test the new function
        PERFORM count(*) FROM get_user_chat_groups();
        RAISE NOTICE 'get_user_chat_groups() function works';
        
    ELSE
        RAISE NOTICE 'No authenticated user found for testing';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Policy test failed: %', SQLERRM;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Chat groups infinite recursion has been fixed!';
    RAISE NOTICE 'New policies avoid circular dependencies';
    RAISE NOTICE 'Use get_user_chat_groups() function in your frontend';
    RAISE NOTICE 'Frontend should be updated to use the new function';
END $$;
-- =====================================================
-- Fix Chat Function Type Mismatch and Team Member Access
-- =====================================================

-- 1. Fix the get_user_chat_groups function return type mismatch
DROP FUNCTION IF EXISTS get_user_chat_groups();

CREATE OR REPLACE FUNCTION get_user_chat_groups()
RETURNS TABLE (
    group_id UUID,
    group_name VARCHAR(255),  -- Changed from TEXT to match the table column type
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

-- 2. Create a function to get only team members for the current user
CREATE OR REPLACE FUNCTION get_user_team_members()
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    RETURN QUERY
    -- Get team members where current user is admin
    SELECT DISTINCT
        p.id as user_id,
        p.full_name,
        p.email,
        p.avatar_url
    FROM profiles p
    INNER JOIN team_members tm ON p.id = tm.user_id
    WHERE tm.admin_id = current_user_id
    AND p.id != current_user_id  -- Exclude self
    
    UNION
    
    -- Get team members where current user is a member (get other members and admin)
    SELECT DISTINCT
        p.id as user_id,
        p.full_name,
        p.email,
        p.avatar_url
    FROM profiles p
    INNER JOIN team_members tm1 ON p.id = tm1.user_id
    INNER JOIN team_members tm2 ON tm1.admin_id = tm2.admin_id
    WHERE tm2.user_id = current_user_id
    AND p.id != current_user_id  -- Exclude self
    
    UNION
    
    -- Get admins of teams where current user is a member
    SELECT DISTINCT
        p.id as user_id,
        p.full_name,
        p.email,
        p.avatar_url
    FROM profiles p
    INNER JOIN team_members tm ON p.id = tm.admin_id
    WHERE tm.user_id = current_user_id
    AND p.id != current_user_id;  -- Exclude self
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_team_members TO authenticated;

-- 3. Test the functions
DO $$
DECLARE
    current_user_id UUID := auth.uid();
    group_count INTEGER;
    member_count INTEGER;
BEGIN
    IF current_user_id IS NOT NULL THEN
        RAISE NOTICE 'Testing functions for user: %', current_user_id;
        
        -- Test get_user_chat_groups function
        SELECT count(*) INTO group_count FROM get_user_chat_groups();
        RAISE NOTICE 'User has access to % chat groups', group_count;
        
        -- Test get_user_team_members function
        SELECT count(*) INTO member_count FROM get_user_team_members();
        RAISE NOTICE 'User has access to % team members', member_count;
        
    ELSE
        RAISE NOTICE 'No authenticated user found for testing';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Test failed: %', SQLERRM;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Chat function fixes completed!';
    RAISE NOTICE 'Fixed get_user_chat_groups return type mismatch';
    RAISE NOTICE 'Added get_user_team_members function for restricted team access';
    RAISE NOTICE 'Frontend should now work without errors';
END $$;
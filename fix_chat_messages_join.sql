-- =====================================================
-- Fix Chat Messages Foreign Key Join Issue
-- =====================================================

-- The error is that Supabase can't find the foreign key relationship 
-- between group_messages and profiles. Let's fix this.

-- First, let's create a view that joins group_messages with profiles
CREATE OR REPLACE VIEW group_messages_with_sender AS
SELECT 
    gm.id,
    gm.group_id,
    gm.sender_id,
    gm.content,
    gm.message_type,
    gm.file_url,
    gm.file_name,
    gm.file_size,
    gm.reply_to_id,
    gm.is_edited,
    gm.is_deleted,
    gm.deleted_by,
    gm.deleted_at,
    gm.created_at,
    gm.updated_at,
    p.full_name AS sender_full_name,
    p.email AS sender_email,
    p.avatar_url AS sender_avatar_url
FROM group_messages gm
LEFT JOIN profiles p ON gm.sender_id = p.id;

-- Grant permissions on the view
GRANT SELECT ON group_messages_with_sender TO authenticated;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_group_messages_with_profiles(UUID);

-- Create an RPC function to get messages with sender info
CREATE OR REPLACE FUNCTION get_group_messages_with_profiles(p_group_id UUID)
RETURNS TABLE (
    id UUID,
    group_id UUID,
    sender_id UUID,
    content TEXT,
    message_type VARCHAR(50),
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    reply_to_id UUID,
    is_edited BOOLEAN,
    is_deleted BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    sender_full_name TEXT,
    sender_email TEXT,
    sender_avatar_url TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user has access to this group
    IF NOT EXISTS (
        SELECT 1 FROM chat_groups cg
        WHERE cg.id = p_group_id 
        AND (cg.admin_id = auth.uid() OR EXISTS (
            SELECT 1 FROM chat_group_members cgm
            WHERE cgm.group_id = p_group_id 
            AND cgm.user_id = auth.uid() 
            AND cgm.is_active = true
        ))
    ) THEN
        RAISE EXCEPTION 'Access denied to this group';
    END IF;

    RETURN QUERY
    SELECT 
        gm.id,
        gm.group_id,
        gm.sender_id,
        gm.content,
        gm.message_type,
        gm.file_url,
        gm.file_name,
        gm.file_size,
        gm.reply_to_id,
        gm.is_edited,
        gm.is_deleted,
        gm.created_at,
        gm.updated_at,
        p.full_name,
        p.email,
        p.avatar_url
    FROM group_messages gm
    LEFT JOIN profiles p ON gm.sender_id = p.id
    WHERE gm.group_id = p_group_id
    AND gm.is_deleted = false
    ORDER BY gm.created_at ASC;
END;
$$;

-- Drop the existing function first (if it exists with different signature)
DROP FUNCTION IF EXISTS get_user_chat_groups();

-- Create the updated get_user_chat_groups function to include member count
CREATE OR REPLACE FUNCTION get_user_chat_groups()
RETURNS TABLE (
    group_id UUID,
    group_name VARCHAR(255),
    group_description TEXT,
    group_admin_id UUID,
    group_avatar_url TEXT,
    group_is_active BOOLEAN,
    group_created_at TIMESTAMP WITH TIME ZONE,
    group_updated_at TIMESTAMP WITH TIME ZONE,
    user_role VARCHAR(50),
    user_joined_at TIMESTAMP WITH TIME ZONE,
    member_count BIGINT,
    last_message_content TEXT,
    last_message_time TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH user_groups AS (
        SELECT DISTINCT
            g.id as group_id,
            g.name as group_name,
            g.description as group_description,
            g.admin_id as group_admin_id,
            g.avatar_url as group_avatar_url,
            g.is_active as group_is_active,
            g.created_at as group_created_at,
            g.updated_at as group_updated_at,
            CASE 
                WHEN g.admin_id = auth.uid() THEN 'admin'
                ELSE COALESCE(gm.role, 'member')
            END as user_role,
            COALESCE(gm.joined_at, g.created_at) as user_joined_at
        FROM chat_groups g
        LEFT JOIN chat_group_members gm ON g.id = gm.group_id AND gm.user_id = auth.uid()
        WHERE g.is_active = true
        AND (
            g.admin_id = auth.uid() 
            OR (gm.user_id = auth.uid() AND gm.is_active = true)
        )
    ),
    group_counts AS (
        SELECT 
            g.id as group_id,
            COUNT(DISTINCT all_members.user_id) as total_members
        FROM chat_groups g
        LEFT JOIN LATERAL (
            -- Get all unique members (including admin)
            SELECT g.admin_id as user_id
            UNION
            SELECT cgm.user_id
            FROM chat_group_members cgm
            WHERE cgm.group_id = g.id 
            AND cgm.is_active = true
        ) all_members ON true
        WHERE g.is_active = true
        GROUP BY g.id
    ),
    last_messages AS (
        SELECT DISTINCT ON (gm.group_id)
            gm.group_id,
            gm.content,
            gm.created_at
        FROM group_messages gm
        WHERE gm.is_deleted = false
        ORDER BY gm.group_id, gm.created_at DESC
    )
    SELECT 
        ug.group_id,
        ug.group_name,
        ug.group_description,
        ug.group_admin_id,
        ug.group_avatar_url,
        ug.group_is_active,
        ug.group_created_at,
        ug.group_updated_at,
        ug.user_role,
        ug.user_joined_at,
        COALESCE(gc.total_members, 1) as member_count,
        lm.content as last_message_content,
        lm.created_at as last_message_time
    FROM user_groups ug
    LEFT JOIN group_counts gc ON ug.group_id = gc.group_id
    LEFT JOIN last_messages lm ON ug.group_id = lm.group_id
    ORDER BY COALESCE(lm.created_at, ug.group_updated_at) DESC;
END;
$$;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS delete_chat_group(UUID);

-- Create a function to delete a group (only for admins)
CREATE OR REPLACE FUNCTION delete_chat_group(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    -- Check if the user is the admin of the group
    SELECT EXISTS(
        SELECT 1 FROM chat_groups 
        WHERE id = p_group_id 
        AND admin_id = auth.uid()
        AND is_active = true
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only group admin can delete the group';
    END IF;

    -- Soft delete the group
    UPDATE chat_groups 
    SET is_active = false,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_group_id;

    -- Deactivate all group members
    UPDATE chat_group_members
    SET is_active = false,
        left_at = CURRENT_TIMESTAMP
    WHERE group_id = p_group_id;

    -- Optionally, mark all messages as deleted (uncomment if needed)
    -- UPDATE group_messages
    -- SET is_deleted = true,
    --     deleted_by = auth.uid(),
    --     deleted_at = CURRENT_TIMESTAMP
    -- WHERE group_id = p_group_id;

    RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_group_messages_with_profiles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_chat_groups() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_chat_group(UUID) TO authenticated;

-- Test the functions
DO $$
BEGIN
    RAISE NOTICE 'Chat message join fixes applied successfully!';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  - get_group_messages_with_profiles(group_id)';
    RAISE NOTICE '  - get_user_chat_groups() (updated with member_count)';
    RAISE NOTICE '  - delete_chat_group(group_id)';
END $$;
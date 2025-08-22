-- =====================================================
-- Fix Chat Groups RLS Policies and Ensure Schema Exists
-- =====================================================

-- First, ensure all tables exist with proper structure
CREATE TABLE IF NOT EXISTS chat_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chat_groups_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 255)
);

CREATE TABLE IF NOT EXISTS chat_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'admin', 'member'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Constraints
    UNIQUE(group_id, user_id),
    CONSTRAINT chat_group_members_role_check CHECK (role IN ('admin', 'member'))
);

-- Enable RLS on all tables
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view groups they are members of" ON chat_groups;
DROP POLICY IF EXISTS "Users can create groups" ON chat_groups;
DROP POLICY IF EXISTS "Admins can update their groups" ON chat_groups;
DROP POLICY IF EXISTS "Admins can delete their groups" ON chat_groups;

DROP POLICY IF EXISTS "Users can view group members for groups they belong to" ON chat_group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON chat_group_members;
DROP POLICY IF EXISTS "Group admins can update member roles" ON chat_group_members;
DROP POLICY IF EXISTS "Users can leave groups (update their own membership)" ON chat_group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON chat_group_members;

-- Chat Groups Policies
CREATE POLICY "Users can view groups they are members of" ON chat_groups
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            admin_id = auth.uid() OR
            id IN (
                SELECT group_id FROM chat_group_members 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

CREATE POLICY "Users can create groups" ON chat_groups
    FOR INSERT WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Admins can update their groups" ON chat_groups
    FOR UPDATE USING (admin_id = auth.uid())
    WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can delete their groups" ON chat_groups
    FOR DELETE USING (admin_id = auth.uid());

-- Chat Group Members Policies
CREATE POLICY "Users can view group members for groups they belong to" ON chat_group_members
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR
            group_id IN (
                SELECT id FROM chat_groups WHERE admin_id = auth.uid()
            ) OR
            group_id IN (
                SELECT group_id FROM chat_group_members 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

CREATE POLICY "Group admins and users can add members" ON chat_group_members
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND (
            group_id IN (
                SELECT id FROM chat_groups 
                WHERE admin_id = auth.uid()
            ) OR
            user_id = auth.uid()
        )
    );

CREATE POLICY "Group admins can update member roles" ON chat_group_members
    FOR UPDATE USING (
        group_id IN (
            SELECT id FROM chat_groups 
            WHERE admin_id = auth.uid()
        )
    )
    WITH CHECK (
        group_id IN (
            SELECT id FROM chat_groups 
            WHERE admin_id = auth.uid()
        )
    );

CREATE POLICY "Users can leave groups" ON chat_group_members
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Group admins can remove members" ON chat_group_members
    FOR DELETE USING (
        group_id IN (
            SELECT id FROM chat_groups 
            WHERE admin_id = auth.uid()
        )
    );

-- Ensure the create_chat_group function exists and works
CREATE OR REPLACE FUNCTION create_chat_group(
    group_name TEXT,
    group_description TEXT DEFAULT NULL,
    member_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_group_id UUID;
    member_id UUID;
    current_user_id UUID;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to create a group';
    END IF;
    
    -- Create the group
    INSERT INTO chat_groups (name, description, admin_id)
    VALUES (group_name, group_description, current_user_id)
    RETURNING id INTO new_group_id;
    
    -- Add the creator as an admin member
    INSERT INTO chat_group_members (group_id, user_id, role)
    VALUES (new_group_id, current_user_id, 'admin');
    
    -- Add other members
    FOREACH member_id IN ARRAY member_ids
    LOOP
        -- Only add valid user IDs that exist in auth.users
        IF EXISTS (SELECT 1 FROM auth.users WHERE id = member_id) THEN
            INSERT INTO chat_group_members (group_id, user_id, role)
            VALUES (new_group_id, member_id, 'member')
            ON CONFLICT (group_id, user_id) DO NOTHING;
        END IF;
    END LOOP;
    
    RETURN new_group_id;
END;
$$;

-- Ensure the leave_chat_group function exists
CREATE OR REPLACE FUNCTION leave_chat_group(group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to leave a group';
    END IF;
    
    -- Update membership to inactive
    UPDATE chat_group_members 
    SET is_active = false, left_at = CURRENT_TIMESTAMP
    WHERE group_id = leave_chat_group.group_id 
    AND user_id = current_user_id 
    AND is_active = true;
    
    RETURN FOUND;
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_chat_group TO authenticated;
GRANT EXECUTE ON FUNCTION leave_chat_group TO authenticated;

-- Grant permissions on tables
GRANT ALL ON chat_groups TO authenticated;
GRANT ALL ON chat_group_members TO authenticated;

-- Test the setup
DO $$
DECLARE
    current_user_id UUID := auth.uid();
BEGIN
    IF current_user_id IS NOT NULL THEN
        RAISE NOTICE 'Chat groups setup complete for user: %', current_user_id;
        
        -- Test if user can read from chat_groups
        PERFORM count(*) FROM chat_groups WHERE admin_id = current_user_id;
        RAISE NOTICE 'User can read chat_groups table';
        
        -- Test if user can read from chat_group_members
        PERFORM count(*) FROM chat_group_members WHERE user_id = current_user_id;
        RAISE NOTICE 'User can read chat_group_members table';
        
    ELSE
        RAISE NOTICE 'No authenticated user found for testing';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Test failed: %', SQLERRM;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Chat groups RLS policies have been fixed!';
    RAISE NOTICE 'Tables: chat_groups, chat_group_members are ready';
    RAISE NOTICE 'Functions: create_chat_group, leave_chat_group are available';
    RAISE NOTICE 'All necessary permissions granted to authenticated users';
END $$;
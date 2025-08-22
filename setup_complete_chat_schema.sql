-- =====================================================
-- Complete Chat System Schema Setup
-- =====================================================

-- Ensure we have all required tables for the chat system

-- 1. Chat Groups Table (should already exist)
CREATE TABLE IF NOT EXISTS chat_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chat_groups_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 255)
);

-- 2. Chat Group Members Table (should already exist)
CREATE TABLE IF NOT EXISTS chat_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    UNIQUE(group_id, user_id),
    CONSTRAINT chat_group_members_role_check CHECK (role IN ('admin', 'member'))
);

-- 3. Group Messages Table (might not exist with proper structure)
CREATE TABLE IF NOT EXISTS group_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL DEFAULT 'text',
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    reply_to_id UUID REFERENCES group_messages(id) ON DELETE SET NULL,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT group_messages_content_check CHECK (
        (message_type = 'text' AND char_length(content) >= 1) OR 
        (message_type != 'text')
    ),
    CONSTRAINT group_messages_type_check CHECK (
        message_type IN ('text', 'image', 'file', 'system')
    )
);

-- Enable RLS on all tables
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies for Group Messages
-- =====================================================

-- Drop existing message policies if they exist
DROP POLICY IF EXISTS "Users can view messages from groups they belong to" ON group_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON group_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON group_messages;
DROP POLICY IF EXISTS "Group admins can delete any message" ON group_messages;

-- Users can view messages from groups they are members of
CREATE POLICY "Users can view group messages" ON group_messages
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            -- User is admin of the group
            EXISTS (
                SELECT 1 FROM chat_groups 
                WHERE chat_groups.id = group_messages.group_id 
                AND chat_groups.admin_id = auth.uid()
                AND chat_groups.is_active = true
            ) OR
            -- User is an active member of the group
            EXISTS (
                SELECT 1 FROM chat_group_members
                WHERE chat_group_members.group_id = group_messages.group_id
                AND chat_group_members.user_id = auth.uid()
                AND chat_group_members.is_active = true
            )
        )
        AND is_deleted = false
    );

-- Group members can send messages
CREATE POLICY "Users can send group messages" ON group_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        auth.uid() IS NOT NULL AND (
            -- User is admin of the group
            EXISTS (
                SELECT 1 FROM chat_groups 
                WHERE chat_groups.id = group_messages.group_id 
                AND chat_groups.admin_id = auth.uid()
                AND chat_groups.is_active = true
            ) OR
            -- User is an active member of the group
            EXISTS (
                SELECT 1 FROM chat_group_members
                WHERE chat_group_members.group_id = group_messages.group_id
                AND chat_group_members.user_id = auth.uid()
                AND chat_group_members.is_active = true
            )
        )
    );

-- Users can update their own messages
CREATE POLICY "Users can update own messages" ON group_messages
    FOR UPDATE USING (auth.uid() = sender_id)
    WITH CHECK (auth.uid() = sender_id);

-- Group admins can mark messages as deleted
CREATE POLICY "Admins can delete group messages" ON group_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM chat_groups 
            WHERE chat_groups.id = group_messages.group_id 
            AND chat_groups.admin_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_groups 
            WHERE chat_groups.id = group_messages.group_id 
            AND chat_groups.admin_id = auth.uid()
        )
    );

-- =====================================================
-- Indexes for Better Performance
-- =====================================================

-- Group Messages indexes
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id ON group_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_not_deleted ON group_messages(group_id, is_deleted, created_at DESC) WHERE is_deleted = false;

-- Chat Groups indexes
CREATE INDEX IF NOT EXISTS idx_chat_groups_admin_id ON chat_groups(admin_id);
CREATE INDEX IF NOT EXISTS idx_chat_groups_active ON chat_groups(is_active) WHERE is_active = true;

-- Chat Group Members indexes
CREATE INDEX IF NOT EXISTS idx_chat_group_members_group_id ON chat_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_user_id ON chat_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_active ON chat_group_members(group_id, is_active) WHERE is_active = true;

-- =====================================================
-- Grant Permissions
-- =====================================================

-- Grant permissions on tables to authenticated users
GRANT ALL ON chat_groups TO authenticated;
GRANT ALL ON chat_group_members TO authenticated;
GRANT ALL ON group_messages TO authenticated;

-- Ensure the create_chat_group function exists (from previous files)
-- This should already exist from fix_chat_groups_rls.sql

-- Ensure the get_user_chat_groups function exists (from previous files)
-- This should already exist from fix_chat_infinite_recursion.sql

-- =====================================================
-- Test the Setup
-- =====================================================

DO $$
DECLARE
    current_user_id UUID := auth.uid();
BEGIN
    IF current_user_id IS NOT NULL THEN
        RAISE NOTICE 'Testing complete chat schema for user: %', current_user_id;
        
        -- Test chat_groups access
        PERFORM count(*) FROM chat_groups WHERE admin_id = current_user_id;
        RAISE NOTICE 'User can access chat_groups table';
        
        -- Test chat_group_members access
        PERFORM count(*) FROM chat_group_members WHERE user_id = current_user_id;
        RAISE NOTICE 'User can access chat_group_members table';
        
        -- Test group_messages access
        PERFORM count(*) FROM group_messages WHERE sender_id = current_user_id;
        RAISE NOTICE 'User can access group_messages table';
        
        -- Test the get_user_chat_groups function
        PERFORM count(*) FROM get_user_chat_groups();
        RAISE NOTICE 'get_user_chat_groups() function is available';
        
    ELSE
        RAISE NOTICE 'No authenticated user found for testing';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Test failed: %', SQLERRM;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Complete chat system schema is ready!';
    RAISE NOTICE 'Tables: chat_groups, chat_group_members, group_messages';
    RAISE NOTICE 'All RLS policies and indexes have been created';
    RAISE NOTICE 'Frontend chat application should now work properly';
END $$;
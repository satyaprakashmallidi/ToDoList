-- =====================================================
-- Chat Groups and Group Messages Schema for Supabase
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. Chat Groups Table
-- =====================================================
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

-- =====================================================
-- 2. Chat Group Members Table (Junction Table)
-- =====================================================
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

-- =====================================================
-- 3. Group Messages Table
-- =====================================================
CREATE TABLE IF NOT EXISTS group_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL DEFAULT 'text', -- 'text', 'image', 'file', 'system'
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
    
    -- Constraints
    CONSTRAINT group_messages_content_check CHECK (
        (message_type = 'text' AND char_length(content) >= 1) OR 
        (message_type != 'text')
    ),
    CONSTRAINT group_messages_type_check CHECK (
        message_type IN ('text', 'image', 'file', 'system')
    )
);

-- =====================================================
-- 4. Message Read Status Table
-- =====================================================
CREATE TABLE IF NOT EXISTS group_message_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(message_id, user_id)
);

-- =====================================================
-- 5. Group Activity Log Table
-- =====================================================
CREATE TABLE IF NOT EXISTS group_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- 'joined', 'left', 'kicked', 'promoted', 'demoted', 'message_deleted'
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- For actions affecting other users
    target_message_id UUID REFERENCES group_messages(id) ON DELETE SET NULL, -- For message-related actions
    metadata JSONB, -- Additional data for the action
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT group_activity_action_check CHECK (
        action IN ('joined', 'left', 'kicked', 'promoted', 'demoted', 'message_deleted', 'group_created', 'group_updated')
    )
);

-- =====================================================
-- 6. Indexes for Performance
-- =====================================================

-- Chat Groups indexes
CREATE INDEX IF NOT EXISTS idx_chat_groups_admin_id ON chat_groups(admin_id);
CREATE INDEX IF NOT EXISTS idx_chat_groups_created_at ON chat_groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_groups_active ON chat_groups(is_active) WHERE is_active = true;

-- Chat Group Members indexes
CREATE INDEX IF NOT EXISTS idx_chat_group_members_group_id ON chat_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_user_id ON chat_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_active ON chat_group_members(group_id, is_active) WHERE is_active = true;

-- Group Messages indexes
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id ON group_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_reply_to ON group_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_messages_not_deleted ON group_messages(group_id, is_deleted, created_at DESC) WHERE is_deleted = false;

-- Message Reads indexes
CREATE INDEX IF NOT EXISTS idx_group_message_reads_message_id ON group_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_group_message_reads_user_id ON group_message_reads(user_id);

-- Activity Log indexes
CREATE INDEX IF NOT EXISTS idx_group_activity_log_group_id ON group_activity_log(group_id);
CREATE INDEX IF NOT EXISTS idx_group_activity_log_user_id ON group_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_group_activity_log_created_at ON group_activity_log(group_id, created_at DESC);

-- =====================================================
-- 7. Triggers for Updated At
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_chat_groups_updated_at BEFORE UPDATE ON chat_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_group_messages_updated_at BEFORE UPDATE ON group_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_activity_log ENABLE ROW LEVEL SECURITY;

-- Chat Groups Policies
CREATE POLICY "Users can view groups they are members of" ON chat_groups
    FOR SELECT USING (
        id IN (
            SELECT group_id FROM chat_group_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can create groups" ON chat_groups
    FOR INSERT WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can update their groups" ON chat_groups
    FOR UPDATE USING (admin_id = auth.uid())
    WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can delete their groups" ON chat_groups
    FOR DELETE USING (admin_id = auth.uid());

-- Chat Group Members Policies
CREATE POLICY "Users can view group members for groups they belong to" ON chat_group_members
    FOR SELECT USING (
        group_id IN (
            SELECT group_id FROM chat_group_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Group admins can add members" ON chat_group_members
    FOR INSERT WITH CHECK (
        group_id IN (
            SELECT id FROM chat_groups 
            WHERE admin_id = auth.uid()
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

CREATE POLICY "Users can leave groups (update their own membership)" ON chat_group_members
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Group admins can remove members" ON chat_group_members
    FOR DELETE USING (
        group_id IN (
            SELECT id FROM chat_groups 
            WHERE admin_id = auth.uid()
        )
    );

-- Group Messages Policies
CREATE POLICY "Users can view messages from groups they belong to" ON group_messages
    FOR SELECT USING (
        group_id IN (
            SELECT group_id FROM chat_group_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
        AND is_deleted = false
    );

CREATE POLICY "Group members can send messages" ON group_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        group_id IN (
            SELECT group_id FROM chat_group_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can update their own messages" ON group_messages
    FOR UPDATE USING (sender_id = auth.uid())
    WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Group admins can delete any message" ON group_messages
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

-- Message Reads Policies
CREATE POLICY "Users can view read status for messages in their groups" ON group_message_reads
    FOR SELECT USING (
        message_id IN (
            SELECT id FROM group_messages 
            WHERE group_id IN (
                SELECT group_id FROM chat_group_members 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

CREATE POLICY "Users can mark messages as read" ON group_message_reads
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        message_id IN (
            SELECT id FROM group_messages 
            WHERE group_id IN (
                SELECT group_id FROM chat_group_members 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

-- Activity Log Policies
CREATE POLICY "Users can view activity logs for groups they belong to" ON group_activity_log
    FOR SELECT USING (
        group_id IN (
            SELECT group_id FROM chat_group_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can insert activity logs" ON group_activity_log
    FOR INSERT WITH CHECK (true); -- This would typically be done by a service role

-- =====================================================
-- 9. Views for Common Queries
-- =====================================================

-- View to get groups with member count and last activity
CREATE OR REPLACE VIEW group_overview AS
SELECT 
    g.id,
    g.name,
    g.description,
    g.admin_id,
    g.avatar_url,
    g.created_at,
    g.updated_at,
    COUNT(DISTINCT gm.user_id) FILTER (WHERE gm.is_active = true) as member_count,
    MAX(msg.created_at) as last_message_at,
    COUNT(DISTINCT msg.id) FILTER (WHERE msg.is_deleted = false) as message_count
FROM chat_groups g
LEFT JOIN chat_group_members gm ON g.id = gm.group_id
LEFT JOIN group_messages msg ON g.id = msg.group_id
WHERE g.is_active = true
GROUP BY g.id, g.name, g.description, g.admin_id, g.avatar_url, g.created_at, g.updated_at;

-- View to get unread message counts per user per group
CREATE OR REPLACE VIEW user_unread_counts AS
SELECT 
    gm.user_id,
    gm.group_id,
    COUNT(msg.id) FILTER (
        WHERE msg.created_at > COALESCE(
            (SELECT MAX(read_at) FROM group_message_reads gmr 
             WHERE gmr.user_id = gm.user_id AND gmr.message_id = msg.id), 
            gm.joined_at
        )
        AND msg.sender_id != gm.user_id
        AND msg.is_deleted = false
    ) as unread_count
FROM chat_group_members gm
LEFT JOIN group_messages msg ON gm.group_id = msg.group_id
WHERE gm.is_active = true
GROUP BY gm.user_id, gm.group_id;

-- =====================================================
-- 10. Functions for Common Operations
-- =====================================================

-- Function to create a new group with the creator as admin
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
BEGIN
    -- Create the group
    INSERT INTO chat_groups (name, description, admin_id)
    VALUES (group_name, group_description, auth.uid())
    RETURNING id INTO new_group_id;
    
    -- Add the creator as an admin member
    INSERT INTO chat_group_members (group_id, user_id, role)
    VALUES (new_group_id, auth.uid(), 'admin');
    
    -- Add other members
    FOREACH member_id IN ARRAY member_ids
    LOOP
        INSERT INTO chat_group_members (group_id, user_id, role)
        VALUES (new_group_id, member_id, 'member')
        ON CONFLICT (group_id, user_id) DO NOTHING;
    END LOOP;
    
    -- Log the group creation
    INSERT INTO group_activity_log (group_id, user_id, action)
    VALUES (new_group_id, auth.uid(), 'group_created');
    
    RETURN new_group_id;
END;
$$;

-- Function to leave a group
CREATE OR REPLACE FUNCTION leave_chat_group(group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update membership to inactive
    UPDATE chat_group_members 
    SET is_active = false, left_at = CURRENT_TIMESTAMP
    WHERE group_id = leave_chat_group.group_id 
    AND user_id = auth.uid() 
    AND is_active = true;
    
    -- Log the action
    INSERT INTO group_activity_log (group_id, user_id, action)
    VALUES (group_id, auth.uid(), 'left');
    
    RETURN FOUND;
END;
$$;

-- Function to kick a member (admin only)
CREATE OR REPLACE FUNCTION kick_group_member(
    group_id UUID,
    target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the current user is admin of the group
    IF NOT EXISTS (
        SELECT 1 FROM chat_groups 
        WHERE id = group_id AND admin_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Only group admin can kick members';
    END IF;
    
    -- Update membership to inactive
    UPDATE chat_group_members 
    SET is_active = false, left_at = CURRENT_TIMESTAMP
    WHERE group_id = kick_group_member.group_id 
    AND user_id = target_user_id 
    AND is_active = true;
    
    -- Log the action
    INSERT INTO group_activity_log (group_id, user_id, action, target_user_id)
    VALUES (group_id, auth.uid(), 'kicked', target_user_id);
    
    RETURN FOUND;
END;
$$;

-- =====================================================
-- 11. Sample Data (Optional - Remove in Production)
-- =====================================================

-- Note: This section is for development/testing only
-- Remove this section when deploying to production

/*
-- Insert sample users (This would be handled by Supabase Auth in real scenarios)
-- INSERT INTO auth.users (id, email) VALUES 
--     ('11111111-1111-1111-1111-111111111111', 'admin@example.com'),
--     ('22222222-2222-2222-2222-222222222222', 'user1@example.com'),
--     ('33333333-3333-3333-3333-333333333333', 'user2@example.com');

-- Sample group creation
-- SELECT create_chat_group(
--     'Development Team',
--     'Discuss development tasks and updates',
--     ARRAY['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']::UUID[]
-- );
*/

-- =====================================================
-- END OF SCHEMA
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE 'Chat Groups schema has been successfully created!';
    RAISE NOTICE 'Tables created: chat_groups, chat_group_members, group_messages, group_message_reads, group_activity_log';
    RAISE NOTICE 'Views created: group_overview, user_unread_counts';
    RAISE NOTICE 'Functions created: create_chat_group, leave_chat_group, kick_group_member';
END $$;
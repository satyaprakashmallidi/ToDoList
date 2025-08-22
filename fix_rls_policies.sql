-- =====================================================
-- Fix RLS Policies for ToDoList Application
-- =====================================================

-- Enable RLS on all tables if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;

DROP POLICY IF EXISTS "Users can view subtasks of own tasks" ON subtasks;
DROP POLICY IF EXISTS "Users can insert subtasks for own tasks" ON subtasks;
DROP POLICY IF EXISTS "Users can update subtasks of own tasks" ON subtasks;
DROP POLICY IF EXISTS "Users can delete subtasks of own tasks" ON subtasks;

DROP POLICY IF EXISTS "Users can view own todo lists" ON todo_lists;
DROP POLICY IF EXISTS "Users can insert own todo lists" ON todo_lists;
DROP POLICY IF EXISTS "Users can update own todo lists" ON todo_lists;
DROP POLICY IF EXISTS "Users can delete own todo lists" ON todo_lists;

DROP POLICY IF EXISTS "Users can view own todo list items" ON todo_list_items;
DROP POLICY IF EXISTS "Users can insert own todo list items" ON todo_list_items;
DROP POLICY IF EXISTS "Users can update own todo list items" ON todo_list_items;
DROP POLICY IF EXISTS "Users can delete own todo list items" ON todo_list_items;

DROP POLICY IF EXISTS "Users can view own task sessions" ON task_sessions;
DROP POLICY IF EXISTS "Users can insert own task sessions" ON task_sessions;
DROP POLICY IF EXISTS "Users can update own task sessions" ON task_sessions;
DROP POLICY IF EXISTS "Users can delete own task sessions" ON task_sessions;

DROP POLICY IF EXISTS "Users can view own team invites" ON team_invites;
DROP POLICY IF EXISTS "Users can insert own team invites" ON team_invites;
DROP POLICY IF EXISTS "Users can update own team invites" ON team_invites;
DROP POLICY IF EXISTS "Users can delete own team invites" ON team_invites;

DROP POLICY IF EXISTS "Users can view team members where they are involved" ON team_members;
DROP POLICY IF EXISTS "Users can insert team members where they are admin" ON team_members;
DROP POLICY IF EXISTS "Users can update team members where they are admin" ON team_members;
DROP POLICY IF EXISTS "Users can delete team members where they are admin" ON team_members;

-- =====================================================
-- PROFILES TABLE POLICIES
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can view all profiles (for team member selection)
CREATE POLICY "Users can view all profiles" ON profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- TASKS TABLE POLICIES
-- =====================================================

-- Users can view their own tasks
CREATE POLICY "Users can view own tasks" ON tasks
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own tasks
CREATE POLICY "Users can insert own tasks" ON tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own tasks
CREATE POLICY "Users can update own tasks" ON tasks
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own tasks
CREATE POLICY "Users can delete own tasks" ON tasks
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- SUBTASKS TABLE POLICIES
-- =====================================================

-- Users can view subtasks of their own tasks
CREATE POLICY "Users can view subtasks of own tasks" ON subtasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = subtasks.task_id 
            AND tasks.user_id = auth.uid()
        )
    );

-- Users can insert subtasks for their own tasks
CREATE POLICY "Users can insert subtasks for own tasks" ON subtasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = subtasks.task_id 
            AND tasks.user_id = auth.uid()
        )
    );

-- Users can update subtasks of their own tasks
CREATE POLICY "Users can update subtasks of own tasks" ON subtasks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = subtasks.task_id 
            AND tasks.user_id = auth.uid()
        )
    );

-- Users can delete subtasks of their own tasks
CREATE POLICY "Users can delete subtasks of own tasks" ON subtasks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = subtasks.task_id 
            AND tasks.user_id = auth.uid()
        )
    );

-- =====================================================
-- TODO_LISTS TABLE POLICIES
-- =====================================================

-- Users can view their own todo lists
CREATE POLICY "Users can view own todo lists" ON todo_lists
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own todo lists
CREATE POLICY "Users can insert own todo lists" ON todo_lists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own todo lists
CREATE POLICY "Users can update own todo lists" ON todo_lists
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own todo lists
CREATE POLICY "Users can delete own todo lists" ON todo_lists
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- TODO_LIST_ITEMS TABLE POLICIES
-- =====================================================

-- Users can view todo list items for their own lists
CREATE POLICY "Users can view own todo list items" ON todo_list_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM todo_lists 
            WHERE todo_lists.id = todo_list_items.list_id 
            AND todo_lists.user_id = auth.uid()
        )
    );

-- Users can insert todo list items for their own lists
CREATE POLICY "Users can insert own todo list items" ON todo_list_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM todo_lists 
            WHERE todo_lists.id = todo_list_items.list_id 
            AND todo_lists.user_id = auth.uid()
        )
    );

-- Users can update todo list items for their own lists
CREATE POLICY "Users can update own todo list items" ON todo_list_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM todo_lists 
            WHERE todo_lists.id = todo_list_items.list_id 
            AND todo_lists.user_id = auth.uid()
        )
    );

-- Users can delete todo list items for their own lists
CREATE POLICY "Users can delete own todo list items" ON todo_list_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM todo_lists 
            WHERE todo_lists.id = todo_list_items.list_id 
            AND todo_lists.user_id = auth.uid()
        )
    );

-- =====================================================
-- TASK_SESSIONS TABLE POLICIES
-- =====================================================

-- Users can view task sessions for their own tasks
CREATE POLICY "Users can view own task sessions" ON task_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_sessions.task_id 
            AND tasks.user_id = auth.uid()
        )
    );

-- Users can insert task sessions for their own tasks
CREATE POLICY "Users can insert own task sessions" ON task_sessions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_sessions.task_id 
            AND tasks.user_id = auth.uid()
        )
    );

-- Users can update task sessions for their own tasks
CREATE POLICY "Users can update own task sessions" ON task_sessions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_sessions.task_id 
            AND tasks.user_id = auth.uid()
        )
    );

-- Users can delete task sessions for their own tasks
CREATE POLICY "Users can delete own task sessions" ON task_sessions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_sessions.task_id 
            AND tasks.user_id = auth.uid()
        )
    );

-- =====================================================
-- TEAM_INVITES TABLE POLICIES
-- =====================================================

-- Users can view their own team invites
CREATE POLICY "Users can view own team invites" ON team_invites
    FOR SELECT USING (auth.uid() = created_by);

-- Users can insert their own team invites
CREATE POLICY "Users can insert own team invites" ON team_invites
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can update their own team invites
CREATE POLICY "Users can update own team invites" ON team_invites
    FOR UPDATE USING (auth.uid() = created_by);

-- Users can delete their own team invites
CREATE POLICY "Users can delete own team invites" ON team_invites
    FOR DELETE USING (auth.uid() = created_by);

-- =====================================================
-- TEAM_MEMBERS TABLE POLICIES
-- =====================================================

-- Users can view team members where they are involved (as member or admin)
CREATE POLICY "Users can view team members where they are involved" ON team_members
    FOR SELECT USING (
        auth.uid() = user_id OR auth.uid() = admin_id
    );

-- Users can insert team members where they are admin
CREATE POLICY "Users can insert team members where they are admin" ON team_members
    FOR INSERT WITH CHECK (auth.uid() = admin_id);

-- Users can update team members where they are admin
CREATE POLICY "Users can update team members where they are admin" ON team_members
    FOR UPDATE USING (auth.uid() = admin_id);

-- Users can delete team members where they are admin
CREATE POLICY "Users can delete team members where they are admin" ON team_members
    FOR DELETE USING (auth.uid() = admin_id);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions on all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions on specific tables
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON tasks TO authenticated;
GRANT ALL ON subtasks TO authenticated;
GRANT ALL ON todo_lists TO authenticated;
GRANT ALL ON todo_list_items TO authenticated;
GRANT ALL ON task_sessions TO authenticated;
GRANT ALL ON team_invites TO authenticated;
GRANT ALL ON team_members TO authenticated;

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_deleted ON tasks(user_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_order ON subtasks(task_id, order_index);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

CREATE INDEX IF NOT EXISTS idx_todo_lists_user_id ON todo_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_list_items_list_id ON todo_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_task_sessions_task_id ON task_sessions(task_id);

CREATE INDEX IF NOT EXISTS idx_team_invites_created_by ON team_invites(created_by);
CREATE INDEX IF NOT EXISTS idx_team_invites_code ON team_invites(code);
CREATE INDEX IF NOT EXISTS idx_team_invites_expires_at ON team_invites(expires_at);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_admin_id ON team_members(admin_id);
CREATE INDEX IF NOT EXISTS idx_team_members_invite_id ON team_members(team_invite_id);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'RLS policies have been successfully created for all tables!';
    RAISE NOTICE 'Tables secured: profiles, tasks, subtasks, todo_lists, todo_list_items, task_sessions, team_invites, team_members';
    RAISE NOTICE 'All users can now access their own data based on auth.uid()';
END $$;
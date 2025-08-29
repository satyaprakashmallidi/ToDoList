export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          name: string | null
          first_name: string | null
          last_name: string | null
          gender: string | null
          country: string | null
          language: string | null
          time_zone: string | null
          role: 'user' | 'admin' | null
          avatar_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          name?: string | null
          first_name?: string | null
          last_name?: string | null
          gender?: string | null
          country?: string | null
          language?: string | null
          time_zone?: string | null
          role?: 'user' | 'admin' | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          name?: string | null
          first_name?: string | null
          last_name?: string | null
          gender?: string | null
          country?: string | null
          language?: string | null
          time_zone?: string | null
          role?: 'user' | 'admin' | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          status: 'open' | 'in_progress' | 'completed' | null
          priority: 'low' | 'medium' | 'high' | null
          start_date: string | null
          end_date: string | null
          created_at: string | null
          updated_at: string | null
          is_deleted: boolean | null
          due_date: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          status?: 'open' | 'in_progress' | 'completed' | null
          priority?: 'low' | 'medium' | 'high' | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_deleted?: boolean | null
          due_date?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          status?: 'open' | 'in_progress' | 'completed' | null
          priority?: 'low' | 'medium' | 'high' | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_deleted?: boolean | null
          due_date?: string | null
        }
      }
      subtasks: {
        Row: {
          id: string
          task_id: string
          title: string
          description: string | null
          status: 'open' | 'completed' | null
          order_index: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          task_id: string
          title: string
          description?: string | null
          status?: 'open' | 'completed' | null
          order_index?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          title?: string
          description?: string | null
          status?: 'open' | 'completed' | null
          order_index?: number
          created_at?: string | null
          updated_at?: string | null
        }
      }
      todo_lists: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name?: string
          description?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      todo_list_items: {
        Row: {
          id: string
          list_id: string
          task_id: string
          planned_start: string | null
          order_index: number
          created_at: string | null
        }
        Insert: {
          id?: string
          list_id: string
          task_id: string
          planned_start?: string | null
          order_index?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          list_id?: string
          task_id?: string
          planned_start?: string | null
          order_index?: number
          created_at?: string | null
        }
      }
      task_sessions: {
        Row: {
          id: string
          task_id: string
          started_at: string
          ended_at: string | null
          duration_seconds: number | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          task_id: string
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number | null
          notes?: string | null
          created_at?: string | null
        }
      }
      team_invites: {
        Row: {
          id: string
          code: string
          created_by: string
          expires_at: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          code: string
          created_by: string
          expires_at: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          created_by?: string
          expires_at?: string
          created_at?: string | null
          updated_at?: string | null
        }
      }
      team_members: {
        Row: {
          id: string
          user_id: string
          team_invite_id: string
          admin_id: string
          joined_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          team_invite_id: string
          admin_id: string
          joined_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          team_invite_id?: string
          admin_id?: string
          joined_at?: string | null
        }
      }
      chat_groups: {
        Row: {
          id: string
          name: string
          description: string | null
          admin_id: string
          avatar_url: string | null
          is_active: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          admin_id: string
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          admin_id?: string
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
      chat_group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          role: 'admin' | 'member'
          joined_at: string | null
          left_at: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          role?: 'admin' | 'member'
          joined_at?: string | null
          left_at?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string
          role?: 'admin' | 'member'
          joined_at?: string | null
          left_at?: string | null
          is_active?: boolean
        }
      }
      group_messages: {
        Row: {
          id: string
          group_id: string
          sender_id: string
          content: string
          message_type: 'text' | 'image' | 'file' | 'system'
          file_url: string | null
          file_name: string | null
          file_size: number | null
          reply_to_id: string | null
          is_edited: boolean
          is_deleted: boolean
          deleted_by: string | null
          deleted_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          group_id: string
          sender_id: string
          content: string
          message_type?: 'text' | 'image' | 'file' | 'system'
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          reply_to_id?: string | null
          is_edited?: boolean
          is_deleted?: boolean
          deleted_by?: string | null
          deleted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          group_id?: string
          sender_id?: string
          content?: string
          message_type?: 'text' | 'image' | 'file' | 'system'
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          reply_to_id?: string | null
          is_edited?: boolean
          is_deleted?: boolean
          deleted_by?: string | null
          deleted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      user_emails: {
        Row: {
          id: string
          user_id: string
          email: string
          is_verified: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          is_verified?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          is_verified?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
  }
}
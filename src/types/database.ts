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
      channels: {
        Row: {
          id: string
          team_invite_id: string | null
          name: string
          description: string | null
          channel_type: 'text' | 'voice' | 'announcement' | null
          category: string | null
          is_private: boolean | null
          is_archived: boolean | null
          created_by: string | null
          settings: Record<string, unknown> | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          team_invite_id?: string | null
          name: string
          description?: string | null
          channel_type?: 'text' | 'voice' | 'announcement' | null
          category?: string | null
          is_private?: boolean | null
          is_archived?: boolean | null
          created_by?: string | null
          settings?: Record<string, unknown> | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          team_invite_id?: string | null
          name?: string
          description?: string | null
          channel_type?: 'text' | 'voice' | 'announcement' | null
          category?: string | null
          is_private?: boolean | null
          is_archived?: boolean | null
          created_by?: string | null
          settings?: Record<string, unknown> | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      channel_members: {
        Row: {
          id: string
          channel_id: string | null
          user_id: string | null
          role: 'admin' | 'moderator' | 'member' | null
          can_post: boolean | null
          can_manage: boolean | null
          added_by: string | null
          joined_at: string | null
          left_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          channel_id?: string | null
          user_id?: string | null
          role?: 'admin' | 'moderator' | 'member' | null
          can_post?: boolean | null
          can_manage?: boolean | null
          added_by?: string | null
          joined_at?: string | null
          left_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          channel_id?: string | null
          user_id?: string | null
          role?: 'admin' | 'moderator' | 'member' | null
          can_post?: boolean | null
          can_manage?: boolean | null
          added_by?: string | null
          joined_at?: string | null
          left_at?: string | null
          created_at?: string | null
        }
      }
      channel_messages: {
        Row: {
          id: string
          channel_id: string
          sender_id: string
          content: string
          message_type: 'text' | 'image' | 'file' | 'system' | null
          file_url: string | null
          file_name: string | null
          file_size: number | null
          reply_to_id: string | null
          is_edited: boolean | null
          is_deleted: boolean | null
          deleted_by: string | null
          deleted_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          channel_id: string
          sender_id: string
          content: string
          message_type?: 'text' | 'image' | 'file' | 'system' | null
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          reply_to_id?: string | null
          is_edited?: boolean | null
          is_deleted?: boolean | null
          deleted_by?: string | null
          deleted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          channel_id?: string
          sender_id?: string
          content?: string
          message_type?: 'text' | 'image' | 'file' | 'system' | null
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          reply_to_id?: string | null
          is_edited?: boolean | null
          is_deleted?: boolean | null
          deleted_by?: string | null
          deleted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      conversations: {
        Row: {
          id: string
          created_at: string | null
          updated_at: string | null
          last_message_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string | null
          updated_at?: string | null
          last_message_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string | null
          updated_at?: string | null
          last_message_at?: string | null
        }
      }
      direct_conversations: {
        Row: {
          id: string
          user1_id: string | null
          user2_id: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user1_id?: string | null
          user2_id?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user1_id?: string | null
          user2_id?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      direct_messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          message_type: string | null
          file_url: string | null
          file_name: string | null
          file_size: number | null
          reply_to_id: string | null
          is_edited: boolean | null
          is_deleted: boolean | null
          deleted_by: string | null
          deleted_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          message_type?: string | null
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          reply_to_id?: string | null
          is_edited?: boolean | null
          is_deleted?: boolean | null
          deleted_by?: string | null
          deleted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          message_type?: string | null
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          reply_to_id?: string | null
          is_edited?: boolean | null
          is_deleted?: boolean | null
          deleted_by?: string | null
          deleted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "direct_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      posts: {
        Row: {
          id: string
          author_id: string | null
          channel_id: string | null
          title: string | null
          content: string
          post_type: 'update' | 'announcement' | 'idea' | 'discussion' | null
          tags: string[] | null
          is_published: boolean | null
          is_pinned: boolean | null
          view_count: number | null
          created_at: string | null
          updated_at: string | null
          published_at: string | null
        }
        Insert: {
          id?: string
          author_id?: string | null
          channel_id?: string | null
          title?: string | null
          content: string
          post_type?: 'update' | 'announcement' | 'idea' | 'discussion' | null
          tags?: string[] | null
          is_published?: boolean | null
          is_pinned?: boolean | null
          view_count?: number | null
          created_at?: string | null
          updated_at?: string | null
          published_at?: string | null
        }
        Update: {
          id?: string
          author_id?: string | null
          channel_id?: string | null
          title?: string | null
          content?: string
          post_type?: 'update' | 'announcement' | 'idea' | 'discussion' | null
          tags?: string[] | null
          is_published?: boolean | null
          is_pinned?: boolean | null
          view_count?: number | null
          created_at?: string | null
          updated_at?: string | null
          published_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          }
        ]
      }
      post_comments: {
        Row: {
          id: string
          post_id: string | null
          author_id: string | null
          content: string
          reply_to_id: string | null
          is_edited: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          post_id?: string | null
          author_id?: string | null
          content: string
          reply_to_id?: string | null
          is_edited?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          post_id?: string | null
          author_id?: string | null
          content?: string
          reply_to_id?: string | null
          is_edited?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          }
        ]
      }
      post_reactions: {
        Row: {
          id: string
          post_id: string | null
          user_id: string | null
          reaction_type: 'like' | 'love' | 'laugh' | 'sad' | 'angry' | null
          created_at: string | null
        }
        Insert: {
          id?: string
          post_id?: string | null
          user_id?: string | null
          reaction_type?: 'like' | 'love' | 'laugh' | 'sad' | 'angry' | null
          created_at?: string | null
        }
        Update: {
          id?: string
          post_id?: string | null
          user_id?: string | null
          reaction_type?: 'like' | 'love' | 'laugh' | 'sad' | 'angry' | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
  }
}
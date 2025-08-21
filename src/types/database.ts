export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          role: 'user' | 'admin' | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          role?: 'user' | 'admin' | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          role?: 'user' | 'admin' | null
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
    }
  }
}
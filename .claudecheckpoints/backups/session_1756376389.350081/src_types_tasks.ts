export interface SubTask {
  id: string;
  task_id: string;
  title: string;
  description?: string | null;
  status: 'open' | 'completed';
  order_index: number;
  created_at: string | null;
  updated_at: string | null;
}

export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  status: 'open' | 'in_progress' | 'completed';
  priority?: TaskPriority | null;
  start_date?: string | null;
  end_date?: string | null;
  due_date?: string | null;
  is_deleted?: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  subtasks?: SubTask[];
}

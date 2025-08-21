import React, { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Calendar, Trash2 } from 'lucide-react';
import { Task, SubTask, TaskPriority } from '../types/tasks';
import { useSupabase } from '../hooks/useSupabase';

interface TaskItemProps {
  task: Task;
  onUpdate: () => void;
  onDelete: () => void;
}

export const TaskItem: React.FC<TaskItemProps> = React.memo(({ task, onUpdate, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { supabase } = useSupabase();

  const handleStatusToggle = async () => {
    if (loading) return;
    
    const newStatus = task.status === 'completed' ? 'open' : 'completed';
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)
        .select()
        .single();

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating task status:', error);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = async (priority: TaskPriority) => {
    if (loading) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('tasks')
        .update({ 
          priority,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)
        .select()
        .single();

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating task priority:', error);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = async (date: string) => {
    if (loading) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('tasks')
        .update({ 
          due_date: date,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)
        .select()
        .single();

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating due date:', error);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };



  const handleSubtaskDelete = async (subtaskId: string) => {
    if (loading) return;

    try {
      setLoading(true);

      // Get the current subtask to verify task_id
      const { data: subtaskToDelete, error: fetchError } = await supabase
        .from('subtasks')
        .select('*')
        .eq('id', subtaskId)
        .single();

      if (fetchError) throw fetchError;
      if (!subtaskToDelete || subtaskToDelete.task_id !== task.id) {
        throw new Error('Subtask not found or unauthorized');
      }

      // Delete the subtask
      const { error: deleteError } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId)
        .eq('task_id', task.id); // Add task_id check for extra security

      if (deleteError) throw deleteError;

      // Get remaining subtasks
      const { data: remainingSubtasks, error: fetchRemainingError } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', task.id)
        .order('order_index', { ascending: true });

      if (fetchRemainingError) throw fetchRemainingError;

      // Update order_index for remaining subtasks
      if (remainingSubtasks && remainingSubtasks.length > 0) {
        // Create complete update objects with all required fields
        const updates = remainingSubtasks.map((subtask, index) => ({
          id: subtask.id,
          task_id: task.id,
          title: subtask.title,
          description: subtask.description,
          status: subtask.status,
          order_index: index + 1,
          updated_at: new Date().toISOString()
        }));

        const { error: updateError } = await supabase
          .from('subtasks')
          .upsert(updates);

        if (updateError) throw updateError;
      }

      onUpdate();
    } catch (error: any) {
      console.error('Error deleting subtask:', {
        error,
        subtaskId,
        taskId: task.id
      });
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const handleSubtaskToggle = async (subtask: SubTask) => {
    if (loading) return;
    
    const newStatus = subtask.status === 'completed' ? 'open' : 'completed';
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('subtasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', subtask.id)
        .select()
        .single();

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating subtask status:', error);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };


  return (
    <div 
      className="border border-gray-200 rounded-lg overflow-hidden cursor-pointer" 
      onClick={(e) => {
        e.stopPropagation();
        if (task.subtasks && task.subtasks.length > 0) {
          setIsExpanded(!isExpanded);
        }
      }}>
      <div className="p-4 bg-white">
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStatusToggle();
            }}
            disabled={loading}
            className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
            type="button"
          >
            {task.status === 'completed' ? (
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            ) : (
              <Circle className="w-6 h-6" />
            )}
          </button>

          <div className="flex-1">
            <p className={`font-medium ${
              task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'
            }`}>
              {task.title}
            </p>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-2">
              <div className="relative">
                <select
                  value={task.priority || 'medium'}
                  onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                  disabled={loading}
                  className={`appearance-none pl-8 pr-4 py-1.5 text-sm font-medium rounded-full focus:outline-none focus:ring-2 focus:ring-offset-1 min-w-[140px] ${
                    task.priority === 'high' 
                      ? 'bg-red-50 text-red-700 focus:ring-red-500'
                      : task.priority === 'medium' || !task.priority
                      ? 'bg-yellow-50 text-yellow-700 focus:ring-yellow-500'
                      : 'bg-green-50 text-green-700 focus:ring-green-500'
                  }`}
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
                <div className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${
                  task.priority === 'high' 
                    ? 'bg-red-500'
                    : task.priority === 'medium' || !task.priority
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`} />
              </div>

              <div className="relative">
                <input
                  type="date"
                  value={task.due_date || ''}
                  onChange={(e) => handleDateChange(e.target.value)}
                  disabled={loading}
                  className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 min-w-[140px]"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {task.subtasks && task.subtasks.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                type="button"
                className="p-1 hover:bg-gray-100 rounded-full"
                title="Toggle subtasks"
              >
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              type="button"
              className="p-1 hover:bg-red-100 text-red-600 rounded-full"
              aria-label="Delete task"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {isExpanded && task.subtasks && (
        <div className="bg-gray-50 border-t border-gray-200">
          <div className="p-4 space-y-2">
            {[...task.subtasks].sort((a, b) => a.order_index - b.order_index).map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-3 pl-8 group hover:bg-gray-100 rounded-lg p-2">
                <div className="flex items-center gap-3 min-w-[32px]">
                  <button
                    onClick={() => handleSubtaskToggle(subtask)}
                    disabled={loading}
                    className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                  >
                    {subtask.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <span className={`flex-1 ${subtask.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                  {subtask.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubtaskDelete(subtask.id);
                  }}
                  type="button"
                  className="p-1 hover:bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete subtask"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.task.due_date === nextProps.task.due_date &&
    prevProps.task.title === nextProps.task.title &&
    JSON.stringify(prevProps.task.subtasks) === JSON.stringify(nextProps.task.subtasks)
  );
});

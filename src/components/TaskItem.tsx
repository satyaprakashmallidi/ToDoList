import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar } from 'lucide-react';
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

  // Removed manual task status toggle - tasks auto-complete when all subtasks are done

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






  const areAllSubtasksCompleted = (subtasks: SubTask[]): boolean => {
    return subtasks.length > 0 && subtasks.every(subtask => subtask.status === 'completed');
  };

  const handleSubtaskToggle = async (subtask: SubTask) => {
    if (loading) return;
    
    const newStatus = subtask.status === 'completed' ? 'open' : 'completed';
    
    try {
      setLoading(true);
      
      // Update the subtask status
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

      // Check if we need to update the parent task status
      const updatedSubtasks = task.subtasks?.map(s => 
        s.id === subtask.id ? { ...s, status: newStatus } : s
      ) || [];

      const shouldCompleteTask = areAllSubtasksCompleted(updatedSubtasks);
      const shouldReopenTask = !shouldCompleteTask && task.status === 'completed';

      // Update parent task status if needed
      if ((shouldCompleteTask && task.status !== 'completed') || shouldReopenTask) {
        const newTaskStatus = shouldCompleteTask ? 'completed' : 'open';
        
        const { error: taskError } = await supabase
          .from('tasks')
          .update({ 
            status: newTaskStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id);

        if (taskError) throw taskError;
      }

      onUpdate();
    } catch (error) {
      console.error('Error updating subtask status:', error);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      {/* Task Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Task Title */}
            <h3 className={`font-semibold text-base break-words mb-3 ${
              task.status === 'completed' ? 'text-gray-600' : 'text-gray-900'
            }`}>
              {task.title}
            </h3>
            
            {/* Task Status Badge */}
            {task.status === 'completed' && (
              <div className="mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Completed
                </span>
              </div>
            )}

            {/* Task Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Priority Selector */}
              <div className="relative">
                <select
                  value={task.priority || 'medium'}
                  onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                  disabled={loading || task.status === 'completed'}
                  className={`w-full appearance-none pl-8 pr-8 py-2 text-sm font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors ${
                    task.status === 'completed' 
                      ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed'
                      : task.priority === 'high' 
                        ? 'bg-red-50 text-red-700 border-red-200 focus:ring-red-500'
                        : task.priority === 'medium' || !task.priority
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200 focus:ring-yellow-500'
                        : 'bg-green-50 text-green-700 border-green-200 focus:ring-green-500'
                  }`}
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
                <div className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${
                  task.status === 'completed' 
                    ? 'bg-gray-400'
                    : task.priority === 'high' 
                      ? 'bg-red-500'
                      : task.priority === 'medium' || !task.priority
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                }`} />
              </div>

              {/* Due Date */}
              <div className="relative">
                <input
                  type="date"
                  value={task.due_date || ''}
                  onChange={(e) => handleDateChange(e.target.value)}
                  disabled={loading || task.status === 'completed'}
                  placeholder="Due Date"
                  className={`w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors ${
                    task.status === 'completed' 
                      ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                />
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-start gap-2 flex-shrink-0">
            {task.subtasks && task.subtasks.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                type="button"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Toggle subtasks"
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                )}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              type="button"
              className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Subtasks Expansion */}
      {isExpanded && task.subtasks && (
        <div className="bg-gray-50 border-t border-gray-200">
          <div className="p-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Subtasks</h4>
            {[...task.subtasks].sort((a, b) => a.order_index - b.order_index).map((subtask) => (
              <div key={subtask.id} className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                <span className={`flex-1 text-sm break-words ${
                  subtask.status === 'completed' ? 'text-gray-600' : 'text-gray-900'
                }`}>
                  {subtask.title}
                </span>
                {subtask.status === 'completed' ? (
                  <span className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                    Completed
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubtaskToggle(subtask);
                    }}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Mark Complete
                  </button>
                )}
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

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, Trash2, CheckCircle, Lock, ArrowRight } from 'lucide-react';
import { Task, SubTask, TaskPriority } from '../types/tasks';
import { useSupabase } from '../hooks/useSupabase';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface TaskItemProps {
  task: Task;
  onUpdate: () => void;
  onDelete: () => void;
}

export const TaskItem: React.FC<TaskItemProps> = React.memo(({ task, onUpdate, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { supabase } = useSupabase();

  // Tasks with subtasks: auto-status (open → in_progress → completed) based on subtask completion
  // Tasks without subtasks: manual status control via dropdown

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

  const handleEndDateChange = async (date: string) => {
    if (loading) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('tasks')
        .update({ 
          end_date: date,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)
        .select()
        .single();

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating end date:', error);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: 'open' | 'in_progress' | 'completed') => {
    if (loading) return;
    
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





  const areAllSubtasksCompleted = (subtasks: SubTask[]): boolean => {
    return subtasks.length > 0 && subtasks.every(subtask => subtask.status === 'completed');
  };

  const isSubtaskEnabled = (subtask: SubTask, allSubtasks: SubTask[]): boolean => {
    // Sort subtasks by order_index to check sequential completion
    const sortedSubtasks = [...allSubtasks].sort((a, b) => a.order_index - b.order_index);
    
    // Find the index of the current subtask
    const currentIndex = sortedSubtasks.findIndex(s => s.id === subtask.id);
    
    // First subtask is always enabled
    if (currentIndex === 0) return true;
    
    // Check if all previous subtasks are completed
    for (let i = 0; i < currentIndex; i++) {
      if (sortedSubtasks[i].status !== 'completed') {
        return false;
      }
    }
    
    return true;
  };

  const getNextAvailableSubtask = (allSubtasks: SubTask[]): SubTask | null => {
    const sortedSubtasks = [...allSubtasks].sort((a, b) => a.order_index - b.order_index);
    return sortedSubtasks.find(s => s.status === 'open' && isSubtaskEnabled(s, allSubtasks)) || null;
  };

  const handleSubtaskToggle = async (subtask: SubTask) => {
    if (loading) return;
    
    // Don't allow toggling if subtask is not enabled (dependencies not met)
    if (!isSubtaskEnabled(subtask, task.subtasks || [])) {
      return;
    }
    
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
      const hasCompletedSubtasks = updatedSubtasks.some(s => s.status === 'completed');
      const hasOpenSubtasks = updatedSubtasks.some(s => s.status === 'open');
      
      let newTaskStatus = task.status;
      
      // Determine the new task status based on subtask states
      if (shouldCompleteTask) {
        newTaskStatus = 'completed';
      } else if (hasCompletedSubtasks && hasOpenSubtasks) {
        newTaskStatus = 'in_progress';
      } else if (hasCompletedSubtasks && !hasOpenSubtasks) {
        // All subtasks are completed - this case is handled by shouldCompleteTask above
        newTaskStatus = 'completed';
      } else if (!hasCompletedSubtasks && hasOpenSubtasks) {
        newTaskStatus = 'open';
      }

      // Update parent task status if it has changed
      if (newTaskStatus !== task.status) {
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


  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500 shadow-red-200 shadow-lg';
      case 'medium':
        return 'bg-yellow-500 shadow-yellow-200 shadow-lg';
      case 'low':
        return 'bg-green-500 shadow-green-200 shadow-lg';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Only consider overdue if due date is before today (not including today)
  const isOverdue = task.due_date && (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0); // Start of due date
    return dueDate < today && task.status !== 'completed';
  })();

  return (
    <div 
      className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
        isOverdue ? 'border-red-200 bg-red-50/30 ring-1 ring-red-100' : 'border-gray-200'
      } ${task.subtasks && task.subtasks.length > 0 ? 'cursor-pointer' : ''}`}
      onClick={() => {
        if (task.subtasks && task.subtasks.length > 0) {
          setIsExpanded(!isExpanded);
        }
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Priority Indicator */}
          <div className={`w-4 h-4 rounded-full flex-shrink-0 mt-1.5 ${
            task.status === 'completed' ? 'bg-gray-400' : getPriorityColor(task.priority)
          } ${task.priority === 'high' && task.status !== 'completed' ? 'animate-pulse' : ''}`} />
          
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <h3 className={`font-semibold text-lg leading-tight mb-2 ${
                  task.status === 'completed' 
                    ? 'text-gray-500 line-through' 
                    : task.priority === 'high' 
                      ? 'text-gray-900' 
                      : 'text-gray-900'
                }`}>
                  {task.title}
                </h3>
                
                {/* Status and Metadata Row */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
                  {/* Status Badge/Selector */}
                  {!task.subtasks || task.subtasks.length === 0 ? (
                    // Manual status selector for tasks without subtasks
                    <div 
                      className={`inline-flex items-center px-3 py-1.5 rounded-lg border cursor-pointer ${
                        getStatusColor(task.status || 'open')
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={task.status || 'open'}
                        onChange={(e) => handleStatusChange(e.target.value as 'open' | 'in_progress' | 'completed')}
                        disabled={loading}
                        className="text-xs bg-transparent border-0 font-medium cursor-pointer focus:outline-none appearance-none"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  ) : (
                    // Automatic status badge for tasks with subtasks
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${
                      getStatusColor(task.status || 'open')
                    }`}>
                      {task.status === 'completed' ? 'Completed' : 
                       task.status === 'in_progress' ? 'In Progress' : 'Open'}
                    </span>
                  )}
                  
                  {/* Priority Selector */}
                  {task.status !== 'completed' ? (
                    <div 
                      className="relative inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 bg-white cursor-pointer transition-colors min-h-[32px] touch-manipulation"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Focus the select to open dropdown
                        const select = e.currentTarget.querySelector('select');
                        if (select) {
                          select.focus();
                          select.click();
                        }
                      }}
                    >
                      {/* Priority Dot */}
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        task.priority === 'high' 
                          ? 'bg-red-500'
                          : task.priority === 'low'
                          ? 'bg-green-500'
                          : 'bg-yellow-500'
                      }`} />
                      
                      <select
                        value={task.priority || 'medium'}
                        onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                        disabled={loading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        style={{ fontSize: '11px' }}
                      >
                        <option value="high" style={{ fontSize: '11px' }}>High Priority</option>
                        <option value="medium" style={{ fontSize: '11px' }}>Medium Priority</option>
                        <option value="low" style={{ fontSize: '11px' }}>Low Priority</option>
                      </select>
                      
                      {/* Visible Text */}
                      <span className="font-medium text-gray-700 pointer-events-none" style={{ fontSize: '11px' }}>
                        {(task.priority || 'medium').charAt(0).toUpperCase() + (task.priority || 'medium').slice(1)}
                      </span>
                      
                      {/* Dropdown Arrow */}
                      <ChevronDown className="w-3 h-3 opacity-50 pointer-events-none ml-1" />
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white">
                      {/* Priority Dot */}
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        task.priority === 'high' 
                          ? 'bg-red-500'
                          : task.priority === 'low'
                          ? 'bg-green-500'
                          : 'bg-yellow-500'
                      }`} />
                      
                      <span className="font-medium text-gray-700" style={{ fontSize: '11px' }}>
                        {(task.priority || 'medium').charAt(0).toUpperCase() + (task.priority || 'medium').slice(1)}
                      </span>
                    </div>
                  )}
                  
                  {/* Due Date Input/Display */}
                  {task.status !== 'completed' ? (
                    <div 
                      className="relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 bg-white transition-colors cursor-pointer min-w-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="date"
                          value={task.due_date || ''}
                          onChange={(e) => handleDateChange(e.target.value)}
                          disabled={loading}
                          className="w-full bg-transparent focus:outline-none cursor-pointer font-medium text-gray-700 min-w-0"
                          style={{ fontSize: '11px' }}
                        />
                        
                        {!task.due_date && (
                          <span className="absolute inset-0 flex items-center text-gray-400 pointer-events-none" style={{ fontSize: '11px' }}>
                            Set date
                          </span>
                        )}
                      </div>
                    </div>
                  ) : task.due_date ? (
                    <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-200 bg-white min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="font-medium text-gray-700 truncate" style={{ fontSize: '11px' }}>
                        {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      {isOverdue && <span className="text-xs font-bold text-red-600 flex-shrink-0">!</span>}
                    </div>
                  ) : null}
                  
                  {/* Subtasks Count */}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <span className="text-gray-600">
                      {task.subtasks.filter(s => s.status === 'completed').length}/{task.subtasks.length} subtasks
                    </span>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="p-2 text-gray-400">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
          </div>
        </div>
      </div>

      {/* Subtasks Expansion */}
      {isExpanded && task.subtasks && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <div className="p-3 sm:p-4 space-y-3">
            {/* Mobile-first header layout */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h4 className="text-sm font-semibold text-gray-700">
                Subtasks ({task.subtasks.filter(s => s.status === 'completed').length}/{task.subtasks.length})
              </h4>
              
              {/* Progress Bar - full width on mobile */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex-1 sm:flex-none sm:w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(task.subtasks.filter(s => s.status === 'completed').length / task.subtasks.length) * 100}%`
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 font-medium">
                  {Math.round((task.subtasks.filter(s => s.status === 'completed').length / task.subtasks.length) * 100)}%
                </span>
              </div>
            </div>

            <div className="space-y-2 relative">
              {[...task.subtasks].sort((a, b) => a.order_index - b.order_index).map((subtask, index) => {
                const isEnabled = isSubtaskEnabled(subtask, task.subtasks || []);
                const isLocked = !isEnabled && subtask.status !== 'completed';
                const isLast = index === task.subtasks.length - 1;
                
                return (
                  <div key={subtask.id} className="relative">
                    
                    <div 
                      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-lg border transition-colors relative ${
                        isLocked 
                          ? 'border-gray-100 bg-gray-50/50' 
                          : isEnabled && subtask.status === 'open'
                          ? 'border-blue-200 bg-blue-50/30 shadow-sm'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                    {/* Step Number - bigger touch target on mobile */}
                    <div className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      subtask.status === 'completed'
                        ? 'bg-green-500 text-white'
                        : isEnabled
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      {subtask.status === 'completed' ? '✓' : index + 1}
                    </div>

                    {/* Toggle Button - bigger touch target on mobile */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubtaskToggle(subtask);
                      }}
                      disabled={loading || isLocked}
                      className={`w-5 h-5 sm:w-4 sm:h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        subtask.status === 'completed'
                          ? 'bg-green-500 border-green-500 text-white'
                          : isEnabled
                          ? 'border-blue-400 hover:border-blue-600 hover:bg-blue-50'
                          : 'border-gray-300 cursor-not-allowed'
                      }`}
                      title={isLocked ? 'Complete previous steps first' : 'Toggle completion'}
                    >
                      {subtask.status === 'completed' && (
                        <CheckCircle className="w-3 h-3 sm:w-3 sm:h-3" />
                      )}
                      {isLocked && (
                        <Lock className="w-2 h-2 text-gray-400" />
                      )}
                    </button>

                    {/* Task Title - responsive text size */}
                    <span className={`flex-1 text-sm sm:text-sm font-medium sm:font-normal leading-tight transition-colors ${
                      subtask.status === 'completed' 
                        ? 'text-gray-500 line-through' 
                        : isEnabled
                        ? 'text-gray-900'
                        : 'text-gray-400'
                    }`}>
                      {subtask.title}
                    </span>

                    {/* Status Indicators - simplified on mobile */}
                    <div className="flex items-center gap-1 sm:gap-2">
                      {isLocked && (
                        <div className="flex items-center gap-1">
                          <Lock className="w-3 h-3 text-gray-400" />
                          <span className="hidden sm:inline text-xs text-gray-400">Locked</span>
                        </div>
                      )}
                      {subtask.status === 'completed' && (
                        <span className="text-xs text-green-600 font-medium">✓</span>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
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

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, MoreHorizontal, Paperclip, MessageCircle, Users } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { useAuth } from '../contexts/AuthContext';
import { Task } from '../types/tasks';
import { TaskConfigModal } from '../components/TaskConfigModal';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';

export const Tasks: React.FC = () => {
  // State hooks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalShown, setModalShown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const shownTaskIds = useRef(new Set<string>());
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  // Context hooks
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleDeleteTask = (taskId: string, taskTitle: string) => {
    if (!user?.id) return;
    
    setTaskToDelete({ id: taskId, title: taskTitle });
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete || !user?.id) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('tasks')
        .update({ is_deleted: true })
        .eq('id', taskToDelete.id);

      if (error) throw error;
      
      setShowDeleteModal(false);
      setTaskToDelete(null);
      await fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Failed to delete task');
    } finally {
      setDeleting(false);
    }
  };

  const fetchTasks = useCallback(async (isRefresh = false) => {
    if (!user?.id || !mountedRef.current || fetchingRef.current) return;
    
    fetchingRef.current = true;
    console.log('📥 Fetching tasks for user:', user.id);

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const queryPromise = supabase
        .from('tasks')
        .select(`
          *,
          subtasks (*)
        `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      const { data: tasksData, error: fetchError } = await queryPromise;

      if (fetchError) throw fetchError;
      if (!mountedRef.current) return;

      // Sort subtasks by order_index for each task
      if (tasksData) {
        tasksData.forEach(task => {
          if (task.subtasks) {
            task.subtasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
          }
        });
      }

      console.log('✅ Tasks fetched successfully:', tasksData?.length || 0);
      setTasks(tasksData || []);
      setInitialized(true);
    } catch (error) {
      console.error('❌ Error fetching tasks:', error);
      if (mountedRef.current) {
        setError('Failed to load tasks');
        setTasks([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      fetchingRef.current = false;
    }
  }, [user?.id]);

  const handleUpdateTaskStatus = async (taskId: string, newStatus: 'open' | 'in_progress' | 'completed') => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;
      await fetchTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
      setError('Failed to update task status');
    }
  };

  const handleSetTaskConfig = async (config: { date?: string; priority?: string }) => {
    if (!selectedTask) return;
    
    setShowConfigModal(false);
    setSelectedTask(null);
    
    if (!config.date && !config.priority) {
      return;
    }
    
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (config.date) {
        updateData.due_date = config.date;
      }
      
      if (config.priority) {
        updateData.priority = config.priority;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', selectedTask.id);

      if (error) throw error;
      
      setTimeout(async () => {
        await fetchTasks();
      }, 100);
      
    } catch (error) {
      console.error('Error setting task config:', error);
      setError('Failed to update task');
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: 'open' | 'in_progress' | 'completed') => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== newStatus) {
      handleUpdateTaskStatus(draggedTask.id, newStatus);
    }
    setDraggedTask(null);
  };

  // Component mount/unmount cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      fetchingRef.current = false;
    };
  }, []);

  // Clear shown task IDs when user changes
  useEffect(() => {
    shownTaskIds.current.clear();
  }, [user?.id]);

  // Initialize tasks when component mounts or user changes
  useEffect(() => {
    if (user?.id && !initialized) {
      console.log('🚀 Initializing tasks for user:', user.id);
      fetchTasks();
    } else if (!user?.id) {
      setTasks([]);
      setLoading(false);
      setInitialized(false);
    }
  }, [user?.id, initialized, fetchTasks]);

  // Handle navigation state from AddTasks
  useEffect(() => {
    const newTaskId = location.state?.newTaskId;
    const shouldShowModal = location.state?.showDateModal;
    
    if (newTaskId && shouldShowModal && tasks.length > 0 && !shownTaskIds.current.has(newTaskId)) {
      const newTask = tasks.find(t => t.id === newTaskId);
      if (newTask) {
        setSelectedTask(newTask);
        setShowConfigModal(true);
        setModalShown(true);
        shownTaskIds.current.add(newTaskId);
        
        navigate('/app/tasks', { replace: true });
      }
    }
  }, [location.state, tasks, navigate]);

  const getTasksByStatus = (status: 'open' | 'in_progress' | 'completed') => {
    return tasks.filter(task => {
      if (status === 'open') {
        return task.status === 'open' || !task.status;
      }
      return task.status === status;
    });
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-blue-500';
      case 'low':
        return 'bg-pink-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPriorityLabel = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return 'Front-end';
      case 'medium':
        return 'Design';
      case 'low':
        return 'Research';
      default:
        return 'General';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const TaskCard: React.FC<{ task: Task }> = ({ task }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, task)}
      className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-move"
    >
      {/* Task Header */}
      <div className="flex items-start justify-between mb-3">
        <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getPriorityColor(task.priority)}`}>
          {getPriorityLabel(task.priority)}
        </span>
        <button className="text-gray-400 hover:text-gray-600">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Task Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {task.title}
      </h3>

      {/* Task Description */}
      {task.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Task Footer */}
      <div className="flex items-center justify-between">
        {/* Date */}
        {task.due_date && (
          <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
            <span>{formatDate(task.due_date)}</span>
          </div>
        )}
        
        {/* Avatars and Stats */}
        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-3 text-gray-500">
            {task.subtasks && task.subtasks.length > 0 && (
              <div className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                <span className="text-xs">{task.subtasks.length} Comments</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Paperclip className="w-4 h-4" />
              <span className="text-xs">3 Files</span>
            </div>
          </div>

          {/* Avatar Stack */}
          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center">
              <span className="text-xs text-white font-medium">U</span>
            </div>
            <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
              <span className="text-xs text-white font-medium">T</span>
            </div>
            <div className="w-6 h-6 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center">
              <span className="text-xs text-white font-medium">A</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ColumnHeader: React.FC<{ 
    title: string; 
    count: number; 
    color: string;
    onAddTask: () => void;
  }> = ({ title, count, color, onAddTask }) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-700">{title}</span>
        <span className={`px-2 py-1 rounded-full text-xs text-white ${color}`}>
          {count}
        </span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-700">
        <div>{error}</div>
        <button 
          onClick={() => {
            setError(null);
            fetchTasks();
          }}
          className="mt-2 text-sm underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <p className="text-gray-600 mt-1">Manage your project tasks</p>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <p className="text-gray-500 mb-4">No tasks yet. Click "Add Task" to create one.</p>
          <button
            onClick={() => navigate('/app/add-tasks')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Add Your First Task
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* To Do Column */}
          <div className="bg-white rounded-lg p-4 h-fit">
            <ColumnHeader
              title="To Do"
              count={getTasksByStatus('open').length}
              color="bg-orange-500"
              onAddTask={() => navigate('/app/add-tasks')}
            />
            <div 
              className="space-y-4 min-h-[500px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'open')}
            >
              {getTasksByStatus('open').map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              
              {/* Add Card Button */}
              <button
                onClick={() => navigate('/app/add-tasks')}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Card</span>
              </button>
            </div>
          </div>

          {/* In Progress Column */}
          <div className="bg-white rounded-lg p-4 h-fit">
            <ColumnHeader
              title="In Progress"
              count={getTasksByStatus('in_progress').length}
              color="bg-blue-500"
              onAddTask={() => navigate('/app/add-tasks')}
            />
            <div 
              className="space-y-4 min-h-[500px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'in_progress')}
            >
              {getTasksByStatus('in_progress').map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              
              {/* Add Card Button */}
              <button
                onClick={() => navigate('/app/add-tasks')}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Card</span>
              </button>
            </div>
          </div>

          {/* Complete Column */}
          <div className="bg-white rounded-lg p-4 h-fit">
            <ColumnHeader
              title="Complete"
              count={getTasksByStatus('completed').length}
              color="bg-green-500"
              onAddTask={() => navigate('/app/add-tasks')}
            />
            <div 
              className="space-y-4 min-h-[500px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'completed')}
            >
              {getTasksByStatus('completed').map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              
              {/* Add Card Button */}
              <button
                onClick={() => navigate('/app/add-tasks')}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Card</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Config Modal */}
      {selectedTask && (
        <TaskConfigModal
          isOpen={showConfigModal}
          onClose={() => {
            setShowConfigModal(false);
            setSelectedTask(null);
          }}
          onSetConfig={handleSetTaskConfig}
          taskTitle={selectedTask.title}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setTaskToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        itemName={taskToDelete?.title || ''}
        itemType="task"
        loading={deleting}
      />
    </div>
  );
};
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { useAuth } from '../contexts/AuthContext';
import { Task } from '../types/tasks';
import { TaskItem } from '../components/TaskItem';
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

      // Add timeout to prevent hanging queries
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), 10000);
      });

      const queryPromise = supabase
        .from('tasks')
        .select(`
          *,
          subtasks (*)
        `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      const { data: tasksData, error: fetchError } = await Promise.race([queryPromise, timeoutPromise]) as any;

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

  const handleSetTaskConfig = async (config: { date?: string; priority?: string }) => {
    if (!selectedTask) return;
    
    // Close modal first
    setShowConfigModal(false);
    setSelectedTask(null);
    
    // If no config provided (skip all), just close without updating
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
      
      // Delay the fetchTasks call to ensure modal is fully closed
      setTimeout(async () => {
        await fetchTasks();
      }, 100);
      
    } catch (error) {
      console.error('Error setting task config:', error);
      setError('Failed to update task');
    }
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
        
        // Clear the navigation state immediately
        navigate('/app/tasks', { replace: true });
      }
    }
  }, [location.state, tasks, navigate]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your tasks and to-dos</p>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 p-3 sm:p-4 rounded-lg text-red-700">
          <div className="text-sm sm:text-base">{error}</div>
          <button 
            onClick={() => {
              setError(null);
              fetchTasks();
            }}
            className="mt-2 text-sm underline hover:no-underline touch-manipulation"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 text-center">
          <p className="text-gray-500 text-sm sm:text-base mb-3 sm:mb-4">No tasks yet. Click "Add Task" to create one.</p>
          <button
            onClick={() => navigate('/app/add-tasks')}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation text-sm sm:text-base font-medium"
          >
            Add Your First Task
          </button>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {/* Ongoing Tasks */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-3 sm:p-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Ongoing Tasks</h2>
              <div className="space-y-2 sm:space-y-3">
                {tasks
                  .filter(task => task.status === 'open')
                  .map((task) => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      onUpdate={fetchTasks}
                      onDelete={() => handleDeleteTask(task.id, task.title)}
                    />
                  ))}
              </div>
              {tasks.filter(task => task.status === 'open').length === 0 && (
                <p className="text-gray-500 text-center py-3 sm:py-4 text-sm">No ongoing tasks</p>
              )}
            </div>
          </div>

          {/* Completed Tasks */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-3 sm:p-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Completed Tasks</h2>
              <div className="space-y-2 sm:space-y-3">
                {tasks
                  .filter(task => task.status === 'completed')
                  .map((task) => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      onUpdate={fetchTasks}
                      onDelete={() => handleDeleteTask(task.id, task.title)}
                    />
                  ))}
              </div>
              {tasks.filter(task => task.status === 'completed').length === 0 && (
                <p className="text-gray-500 text-center py-3 sm:py-4 text-sm">No completed tasks</p>
              )}
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
            // Don't reset modalShown or shownTaskIds to prevent re-showing
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
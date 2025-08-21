import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { useAuth } from '../contexts/AuthContext';
import { Task } from '../types/tasks';
import { TaskItem } from '../components/TaskItem';

export const Tasks: React.FC = () => {
  // State hooks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  // Context hooks
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!user?.id) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the task "${taskTitle}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ is_deleted: true })
        .eq('id', taskId);

      if (error) throw error;
      await fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Failed to delete task');
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

  const handleRefresh = () => {
    fetchTasks(true);
  };

  // Component mount/unmount cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      fetchingRef.current = false;
    };
  }, []);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">Manage your tasks and to-dos</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 p-3 rounded-md text-red-700">
          {error}
          <button 
            onClick={() => {
              setError(null);
              fetchTasks();
            }}
            className="ml-2 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 text-center">
          <p className="text-gray-500">No tasks yet. Click "Add Task" to create one.</p>
          <button
            onClick={() => navigate('/app/add-tasks')}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Your First Task
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Ongoing Tasks */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Ongoing Tasks</h2>
              <div className="space-y-3">
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
                <p className="text-gray-500 text-center py-2">No ongoing tasks</p>
              )}
            </div>
          </div>

          {/* Completed Tasks */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Completed Tasks</h2>
              <div className="space-y-3">
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
                <p className="text-gray-500 text-center py-2">No completed tasks</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
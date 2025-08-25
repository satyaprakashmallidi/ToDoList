import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Filter, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { useAuth } from '../contexts/AuthContext';
import { Task } from '../types/tasks';
import { TaskItem } from '../components/TaskItem';
import { TaskConfigModal } from '../components/TaskConfigModal';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';

type FilterTab = 'all' | 'priority' | 'status' | 'overdue';
type PriorityFilter = 'high' | 'medium' | 'low' | null;
type StatusFilter = 'open' | 'in_progress' | 'completed' | null;

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
  
  // New filtering state
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  
  const shownTaskIds = useRef(new Set<string>());
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  // Context hooks
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Helper functions for filtering and stats
  const getTaskStats = () => {
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'completed').length;
    const inProgress = tasks.filter(task => task.status === 'in_progress').length;
    const overdue = tasks.filter(task => {
      if (!task.due_date || task.status === 'completed' || task.status === 'in_progress') return false;
      // Only consider overdue if due date is before today (yesterday or earlier)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0); // Start of due date
      return dueDate < today;
    }).length;
    
    return { total, completed, inProgress, overdue };
  };

  const getFilteredTasks = () => {
    let filtered = [...tasks];
    
    // Filter by active tab
    switch (activeTab) {
      case 'priority':
        if (priorityFilter) {
          filtered = filtered.filter(task => task.priority === priorityFilter);
        }
        break;
      case 'status':
        if (statusFilter) {
          filtered = filtered.filter(task => task.status === statusFilter);
        }
        break;
      case 'overdue':
        filtered = filtered.filter(task => {
          if (!task.due_date || task.status === 'completed' || task.status === 'in_progress') return false;
          // Only show tasks that are due yesterday or earlier (not today)
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Start of today
          const dueDate = new Date(task.due_date);
          dueDate.setHours(0, 0, 0, 0); // Start of due date
          return dueDate < today;
        });
        break;
      case 'all':
      default:
        // No additional filtering for 'all'
        break;
    }
    
    // Sort: incomplete tasks first, then by priority, then by due date
    return filtered.sort((a, b) => {
      // Completed tasks go to bottom
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      
      // Sort by priority (high > medium > low)
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority || 'medium'];
      const bPriority = priorityOrder[b.priority || 'medium'];
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      // Sort by due date (earliest first)
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      
      // Finally, sort by created date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

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

  const stats = getTaskStats();
  const filteredTasks = getFilteredTasks();

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Modern Header with Stats */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Tasks</h1>
              <p className="text-gray-600">Organize and track your work efficiently</p>
            </div>
            
            {/* Floating Add Button */}
            <button
              onClick={() => navigate('/app')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add Task</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-300 cursor-pointer transform hover:-translate-y-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-md sm:rounded-lg group-hover:bg-blue-200 transition-colors">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-green-300 hover:bg-green-50/30 transition-all duration-300 cursor-pointer transform hover:-translate-y-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-green-100 rounded-md sm:rounded-lg">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Completed</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.completed}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-yellow-300 hover:bg-yellow-50/30 transition-all duration-300 cursor-pointer transform hover:-translate-y-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-md sm:rounded-lg">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">In Progress</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.inProgress}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-orange-300 hover:bg-orange-50/30 transition-all duration-300 cursor-pointer transform hover:-translate-y-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-orange-100 rounded-md sm:rounded-lg">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Overdue</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.overdue}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="border-b border-gray-200 mb-4 sm:mb-6">
            <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-0 -mb-px">
              <button
                onClick={() => setActiveTab('all')}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'all'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Tasks
              </button>
              <button
                onClick={() => {
                  setActiveTab('priority');
                  setPriorityFilter('high');
                }}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'priority'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                By Priority
              </button>
              <button
                onClick={() => {
                  setActiveTab('status');
                  setStatusFilter('open');
                }}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'status'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                By Status
              </button>
              <button
                onClick={() => setActiveTab('overdue')}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'overdue'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overdue
              </button>
            </nav>
          </div>

          {/* Sub-filters for Priority and Status */}
          {activeTab === 'priority' && (
            <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
              <button
                onClick={() => setPriorityFilter('high')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  priorityFilter === 'high'
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                High Priority
              </button>
              <button
                onClick={() => setPriorityFilter('medium')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  priorityFilter === 'medium'
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Medium Priority
              </button>
              <button
                onClick={() => setPriorityFilter('low')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  priorityFilter === 'low'
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Low Priority
              </button>
            </div>
          )}

          {activeTab === 'status' && (
            <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
              <button
                onClick={() => setStatusFilter('open')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === 'open'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Open
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === 'in_progress'
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                In Progress
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === 'completed'
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed
              </button>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-red-800 font-medium">Error loading tasks</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setError(null);
                fetchTasks();
              }}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && tasks.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No tasks yet</h3>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto">
              Get started by creating your first task to organize your work.
            </p>
            <button
              onClick={() => navigate('/app')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Your First Task
            </button>
          </div>
        )}

        {/* Tasks List */}
        {!loading && !error && filteredTasks.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={fetchTasks}
                onDelete={() => handleDeleteTask(task.id, task.title)}
              />
            ))}
          </div>
        )}

        {/* No Results State for Filters */}
        {!loading && !error && tasks.length > 0 && filteredTasks.length === 0 && (
          <div className="text-center py-12">
            <Filter className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No tasks match your filter</h3>
            <p className="text-gray-600 mb-6">
              Try adjusting your filter settings or create a new task.
            </p>
            <button
              onClick={() => setActiveTab('all')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear all filters
            </button>
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
    </div>
  );
};
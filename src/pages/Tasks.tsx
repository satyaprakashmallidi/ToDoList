import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  Plus, Filter, CheckCircle, Clock, AlertCircle 
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { useAuth } from '../contexts/AuthContext';
import { Task } from '../types/tasks';
import { TaskConfigModal } from '../components/TaskConfigModal';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { TaskItem } from '../components/TaskItem';

type FilterTab = 'all' | 'priority' | 'status' | 'overdue';
type PriorityFilter = 'high' | 'medium' | 'low' | null;
type StatusFilter = 'open' | 'in_progress' | 'completed' | null;

export const Tasks: React.FC = () => {
  // State hooks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusUpdateInProgress, setStatusUpdateInProgress] = useState(false);
  
  // Filtering state (for list view)
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
    
    // Count in_progress tasks only if their due date is today
    const inProgress = tasks.filter(task => {
      if (task.status !== 'in_progress') return false;
      if (!task.due_date) return true; // Tasks without due date can stay in progress
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      
      return dueDate.getTime() === today.getTime();
    }).length;
    
    const overdue = tasks.filter(task => {
      if (!task.due_date || task.status === 'completed') return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).length;
    
    return { total, completed, inProgress, overdue };
  };

  const updateTaskStatusesByDate = useCallback(async (currentTasks: Task[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tasksToUpdate: { id: string; newStatus: string }[] = [];
    
    currentTasks.forEach(task => {
      if (!task.due_date || task.status === 'completed') return;
      
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      
      // Task should be in_progress if due date is today and currently open
      if (dueDate.getTime() === today.getTime() && task.status === 'open') {
        tasksToUpdate.push({ id: task.id, newStatus: 'in_progress' });
      }
      // Task should be moved back to open if it's in_progress but due date has passed or is in future
      else if (task.status === 'in_progress' && dueDate.getTime() !== today.getTime()) {
        tasksToUpdate.push({ id: task.id, newStatus: 'open' });
      }
    });
    
    // Update tasks in batch if needed
    if (tasksToUpdate.length > 0) {
      try {
        for (const { id, newStatus } of tasksToUpdate) {
          await supabase
            .from('tasks')
            .update({ 
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', id);
        }
        return true; // Return true if updates were made
      } catch (error) {
        console.error('Error updating task statuses:', error);
        return false;
      }
    }
    return false; // No updates needed
  }, [supabase]);

  const getFilteredTasks = () => {
    let filtered = [...tasks];
    
    switch (activeTab) {
      case 'priority':
        if (priorityFilter) {
          filtered = filtered.filter(task => task.priority === priorityFilter);
        }
        break;
      case 'status':
        if (statusFilter) {
          if (statusFilter === 'in_progress') {
            // For in_progress filter, only show tasks that are in_progress AND due today
            filtered = filtered.filter(task => {
              if (task.status !== 'in_progress') return false;
              if (!task.due_date) return true; // Tasks without due date can be in progress
              
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dueDate = new Date(task.due_date);
              dueDate.setHours(0, 0, 0, 0);
              
              return dueDate.getTime() === today.getTime();
            });
          } else {
            filtered = filtered.filter(task => task.status === statusFilter);
          }
        }
        break;
      case 'overdue':
        filtered = filtered.filter(task => {
          if (!task.due_date || task.status === 'completed') return false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDate = new Date(task.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate < today;
        });
        break;
      case 'all':
      default:
        break;
    }
    
    return filtered.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority || 'medium'];
      const bPriority = priorityOrder[b.priority || 'medium'];
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      
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

  const fetchTasks = useCallback(async () => {
    if (!user?.id || !mountedRef.current || fetchingRef.current) return;
    
    fetchingRef.current = true;
    console.log('📥 Fetching tasks for user:', user.id);

    try {
      setLoading(true);
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
      
      // Check and update task statuses based on dates (only if not already in progress)
      if (tasksData && tasksData.length > 0 && !statusUpdateInProgress) {
        setStatusUpdateInProgress(true);
        const statusUpdated = await updateTaskStatusesByDate(tasksData);
        if (statusUpdated) {
          // Re-fetch tasks if any statuses were updated, but don't trigger another update cycle
          setTimeout(async () => {
            try {
              const { data: updatedTasksData, error: refetchError } = await supabase
                .from('tasks')
                .select(`
                  *,
                  subtasks (*)
                `)
                .eq('user_id', user.id)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });

              if (refetchError) throw refetchError;
              if (updatedTasksData) {
                updatedTasksData.forEach(task => {
                  if (task.subtasks) {
                    task.subtasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                  }
                });
                setTasks(updatedTasksData);
              }
            } catch (error) {
              console.error('❌ Error refetching tasks after status update:', error);
            } finally {
              setStatusUpdateInProgress(false);
            }
          }, 300);
        } else {
          setStatusUpdateInProgress(false);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching tasks:', error);
      if (mountedRef.current) {
        setError('Failed to load tasks');
        setTasks([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, [user?.id, supabase, statusUpdateInProgress, updateTaskStatusesByDate]);


  const handleSetTaskConfig = async (config: { date?: string; priority?: string }) => {
    if (!selectedTask) return;
    
    setShowConfigModal(false);
    setSelectedTask(null);
    
    if (!config.date && !config.priority) {
      return;
    }
    
    try {
      const updateData: { updated_at: string; due_date?: string; priority?: string } = {
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


  // Component mount/unmount cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      fetchingRef.current = false;
    };
  }, []);

  useEffect(() => {
    shownTaskIds.current.clear();
  }, [user?.id]);

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

  useEffect(() => {
    const newTaskId = location.state?.newTaskId;
    const shouldShowModal = location.state?.showDateModal;
    
    if (newTaskId && shouldShowModal && tasks.length > 0 && !shownTaskIds.current.has(newTaskId)) {
      const newTask = tasks.find(t => t.id === newTaskId);
      if (newTask) {
        setSelectedTask(newTask);
        setShowConfigModal(true);
        shownTaskIds.current.add(newTaskId);
        
        navigate('/app/tasks', { replace: true });
      }
    }
  }, [location.state, tasks, navigate]);



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

  const stats = getTaskStats();
  const filteredTasks = getFilteredTasks();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header with Stats */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Tasks</h1>
              <p className="text-sm text-gray-600">Organize and track your work efficiently</p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Add Task Button */}
              <button
                onClick={() => navigate('/app/add-tasks')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Task</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-md">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-600 truncate">Total</p>
                  <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-md">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-600 truncate">Completed</p>
                  <p className="text-lg font-bold text-gray-900">{stats.completed}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-yellow-100 rounded-md">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-600 truncate">In Progress</p>
                  <p className="text-lg font-bold text-gray-900">{stats.inProgress}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-md">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-600 truncate">Overdue</p>
                  <p className="text-lg font-bold text-gray-900">{stats.overdue}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {tasks.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
            <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No tasks yet</h3>
            <p className="text-sm text-gray-600 mb-4 max-w-sm mx-auto">
              Get started by creating your first task to organize your work.
            </p>
            <button
              onClick={() => navigate('/app/add-tasks')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Your First Task
            </button>
          </div>
        ) : (
          /* Enhanced List View */
          <>
            {/* Filter Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Filter Tasks</h2>
                <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border">
                  {filteredTasks.length} tasks found
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`p-3 rounded-lg font-medium text-sm transition-colors ${
                    activeTab === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>All Tasks</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('priority');
                    setPriorityFilter('high');
                  }}
                  className={`p-3 rounded-lg font-medium text-sm transition-colors ${
                    activeTab === 'priority'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>Priority</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('status');
                    setStatusFilter('open');
                  }}
                  className={`p-3 rounded-lg font-medium text-sm transition-colors ${
                    activeTab === 'status'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Status</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('overdue')}
                  className={`p-3 rounded-lg font-medium text-sm transition-colors ${
                    activeTab === 'overdue'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>Overdue</span>
                  </div>
                </button>
              </div>

              {/* Sub-filters */}
              {activeTab === 'priority' && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border">
                  <button
                    onClick={() => setPriorityFilter('high')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      priorityFilter === 'high'
                        ? 'bg-red-500 text-white'
                        : 'bg-white text-red-700 hover:bg-red-50 border border-red-200'
                    }`}
                  >
                    High Priority
                  </button>
                  <button
                    onClick={() => setPriorityFilter('medium')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      priorityFilter === 'medium'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-white text-yellow-700 hover:bg-yellow-50 border border-yellow-200'
                    }`}
                  >
                    Medium Priority
                  </button>
                  <button
                    onClick={() => setPriorityFilter('low')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      priorityFilter === 'low'
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-green-700 hover:bg-green-50 border border-green-200'
                    }`}
                  >
                    Low Priority
                  </button>
                </div>
              )}

              {activeTab === 'status' && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border">
                  <button
                    onClick={() => setStatusFilter('open')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      statusFilter === 'open'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                    }`}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => setStatusFilter('in_progress')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      statusFilter === 'in_progress'
                        ? 'bg-orange-500 text-white'
                        : 'bg-white text-orange-700 hover:bg-orange-50 border border-orange-200'
                    }`}
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      statusFilter === 'completed'
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-green-700 hover:bg-green-50 border border-green-200'
                    }`}
                  >
                    Completed
                  </button>
                </div>
              )}
            </div>

            {/* Tasks List */}
            {filteredTasks.length > 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-800">Your Tasks</h3>
                  <p className="text-sm text-gray-600 mt-1">Click on any task to view details and make changes</p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredTasks.map((task) => (
                      <div key={task.id} className="border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <TaskItem
                          task={task}
                          onUpdate={fetchTasks}
                          onDelete={() => handleDeleteTask(task.id, task.title)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                <div className="max-w-md mx-auto">
                  <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No tasks found</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    No tasks match your current filter. Try adjusting your filter settings or create a new task.
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={() => setActiveTab('all')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Clear all filters
                    </button>
                    <div className="text-xs text-gray-500">or</div>
                    <button
                      onClick={() => navigate('/app/add-tasks')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors border border-blue-600 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Create new task
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
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
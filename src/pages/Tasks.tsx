import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  Plus, MoreHorizontal, Paperclip, MessageCircle, Users,
  Filter, Calendar, CheckCircle, Clock, AlertCircle 
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
type ViewMode = 'list' | 'kanban';

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
  
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  
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
    const inProgress = tasks.filter(task => task.status === 'in_progress').length;
    const overdue = tasks.filter(task => {
      if (!task.due_date || task.status === 'completed' || task.status === 'in_progress') return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).length;
    
    return { total, completed, inProgress, overdue };
  };

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
          filtered = filtered.filter(task => task.status === statusFilter);
        }
        break;
      case 'overdue':
        filtered = filtered.filter(task => {
          if (!task.due_date || task.status === 'completed' || task.status === 'in_progress') return false;
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
  }, [user?.id, supabase]);

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
        setModalShown(true);
        shownTaskIds.current.add(newTaskId);
        
        navigate('/app/tasks', { replace: true });
      }
    }
  }, [location.state, tasks, navigate]);

  // Kanban Card Component
  const TaskCard: React.FC<{ task: Task }> = ({ task }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, task)}
      className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-move"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getPriorityColor(task.priority)}`}>
          {getPriorityLabel(task.priority)}
        </span>
        <button 
          onClick={() => handleDeleteTask(task.id, task.title)}
          className="text-gray-400 hover:text-gray-600"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {task.title}
      </h3>

      {task.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between">
        {task.due_date && (
          <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
            <span>{formatDate(task.due_date)}</span>
          </div>
        )}
        
        <div className="flex items-center gap-3">
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
  }> = ({ title, count, color }) => (
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

  const stats = getTaskStats();
  const filteredTasks = getFilteredTasks();

  return (
    <div className="h-full bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header with Stats */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Tasks</h1>
              <p className="text-gray-600">Organize and track your work efficiently</p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'kanban' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Kanban
                </button>
              </div>
              
              {/* Add Task Button */}
              <button
                onClick={() => navigate('/app/add-tasks')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add Task</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-300 cursor-pointer transform hover:-translate-y-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-md sm:rounded-lg">
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
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Overdue</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.overdue}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
            <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No tasks yet</h3>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto">
              Get started by creating your first task to organize your work.
            </p>
            <button
              onClick={() => navigate('/app/add-tasks')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Your First Task
            </button>
          </div>
        ) : viewMode === 'kanban' ? (
          /* Kanban View */
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
        ) : (
          /* List View */
          <>
            {/* Filter Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="border-b border-gray-200 mb-4 -mt-4 -mx-4 px-4">
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
                <div className="flex flex-wrap gap-2 mt-4">
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
                <div className="flex flex-wrap gap-2 mt-4">
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

            {/* Tasks List */}
            {filteredTasks.length > 0 ? (
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
            ) : (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
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
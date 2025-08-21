import React, { useEffect, useState, useCallback, useRef } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth, parseISO, isEqual } from 'date-fns';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useSupabase } from '../hooks/useSupabase';
import { useAuth } from '../contexts/AuthContext';
import { Task } from '../types/tasks';

export const Calendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [initialized, setInitialized] = useState(false);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const { supabase } = useSupabase();
  const { user } = useAuth();

  const fetchTasks = useCallback(async (isRefresh = false) => {
    if (!user?.id || !mountedRef.current || fetchingRef.current) return;

    fetchingRef.current = true;
    console.log('📅 Fetching calendar tasks for user:', user.id);

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Add timeout to prevent hanging queries
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Calendar query timeout')), 10000);
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

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (error) throw error;
      if (!mountedRef.current) return;

      // Sort subtasks by order_index for each task
      if (data) {
        data.forEach(task => {
          if (task.subtasks) {
            task.subtasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
          }
        });
      }

      setTasks(data || []);
      setInitialized(true);
      console.log('✅ Calendar tasks fetched successfully:', data?.length || 0);
    } catch (error) {
      console.error('❌ Error fetching calendar tasks:', error);
      if (mountedRef.current) {
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

  // Initialize calendar data when component mounts or user changes
  useEffect(() => {
    if (user?.id && !initialized) {
      console.log('📅 Initializing calendar for user:', user.id);
      fetchTasks();
    } else if (!user?.id) {
      setTasks([]);
      setLoading(false);
      setInitialized(false);
    }
  }, [user?.id, initialized, fetchTasks]);

  // Refetch when month changes (but only if already initialized)
  useEffect(() => {
    if (user?.id && initialized) {
      console.log('📅 Month changed, refreshing calendar data');
      fetchTasks(true);
    }
  }, [currentDate, user?.id, initialized]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      // Show tasks with due dates matching this date
      if (task.due_date) {
        try {
          return isEqual(parseISO(task.due_date), date);
        } catch (error) {
          console.error('Invalid date format for task:', task.id, task.due_date);
          return false;
        }
      }
      // Show tasks without due dates on today's date
      return isToday(date) && task.status === 'open';
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold min-w-[140px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-md shadow-sm border border-gray-200">
        <div className="grid grid-cols-7 gap-px border-b border-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="px-2 py-2 text-sm font-medium text-gray-900 text-center">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px">
          {days.map((day, dayIdx) => {
            const dayTasks = getTasksForDate(day);
            const isSelected = selectedDate && isEqual(day, selectedDate);

            return (
              <div
                key={day.toString()}
                className={`min-h-[100px] p-2 cursor-pointer transition-colors ${
                  !isSameMonth(day, currentDate) ? 'bg-gray-50' : 'bg-white'
                } ${isToday(day) ? 'bg-blue-50' : ''} ${
                  isSelected ? 'ring-1 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedDate(day)}
              >
                <p className={`text-sm font-medium mb-1 ${
                  isToday(day) ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {format(day, 'd')}
                </p>
                <div className="space-y-1">
                  {dayTasks.slice(0, 2).map(task => (
                    <div
                      key={task.id}
                      className={`px-2 py-1 text-xs rounded font-medium truncate ${
                        task.priority === 'high'
                          ? 'bg-red-100 text-red-800'
                          : task.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="text-xs text-gray-500 px-1">
                      +{dayTasks.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {selectedDate && (
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-3">
            Tasks for {format(selectedDate, 'MMMM d, yyyy')}
          </h3>
          <div className="space-y-2">
            {getTasksForDate(selectedDate).length === 0 ? (
              <p className="text-gray-500 py-2">No tasks scheduled for this date.</p>
            ) : (
              getTasksForDate(selectedDate).map(task => (
                <div
                  key={task.id}
                  className={`p-3 rounded border-l-4 ${
                    task.priority === 'high'
                      ? 'bg-red-50 border-red-400 text-red-800'
                      : task.priority === 'medium'
                      ? 'bg-yellow-50 border-yellow-400 text-yellow-800'
                      : 'bg-green-50 border-green-400 text-green-800'
                  }`}
                >
                  <div className="font-medium">{task.title}</div>
                  {task.subtasks && task.subtasks.length > 0 && (
                    <div className="mt-2 pl-3 space-y-1">
                      {task.subtasks.map(subtask => (
                        <div
                          key={subtask.id}
                          className={`text-sm flex items-center ${
                            subtask.status === 'completed' ? 'line-through opacity-70' : ''
                          }`}
                        >
                          <span className="w-1 h-1 bg-current rounded-full mr-2 flex-shrink-0"></span>
                          {subtask.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
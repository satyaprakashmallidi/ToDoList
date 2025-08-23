import React, { useEffect, useState, useCallback, useRef } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth, parseISO, isEqual } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSupabase } from '../hooks/useSupabase';
import { useAuth } from '../contexts/AuthContext';
import { Task } from '../types/tasks';

export const Calendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [initialized, setInitialized] = useState(false);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const { supabase } = useSupabase();
  const { user } = useAuth();

  const fetchTasks = useCallback(async () => {
    if (!user?.id || !mountedRef.current || fetchingRef.current) return;

    fetchingRef.current = true;
    console.log('📅 Fetching calendar tasks for user:', user.id);

    try {
      setLoading(true);

      // Test basic connection first
      const { data: testData, error: testError } = await supabase
        .from('tasks')
        .select('count')
        .limit(1);

      if (testError) {
        console.error('❌ Basic connection test failed:', testError);
        throw new Error(`Database connection failed: ${testError.message}`);
      }

      console.log('✅ Basic connection test passed');

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

      if (error) {
        console.error('❌ Query error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
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
    } catch (error: any) {
      console.error('❌ Error fetching calendar tasks:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ User ID:', user.id);
      console.error('❌ Mounted ref:', mountedRef.current);
      
      if (mountedRef.current) {
        setTasks([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, [user?.id]);


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
      fetchTasks();
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
    <div className="flex flex-col h-full bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 flex-shrink-0">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Calendar</h1>
        <div className="flex items-center justify-center sm:justify-end gap-2">
          <button
            onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
            className="p-1.5 hover:bg-gray-100 rounded-md touch-manipulation"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <h2 className="text-sm sm:text-base lg:text-lg font-semibold min-w-[100px] sm:min-w-[140px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
            className="p-1.5 hover:bg-gray-100 rounded-md touch-manipulation"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-hidden">
          {/* Calendar - Left Side - Takes 2 columns on desktop */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[450px] sm:h-[500px] lg:h-full overflow-hidden">
            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                <div key={day} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-r last:border-r-0 border-gray-200">
                  <span className="text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700 hidden sm:inline">
                    {day}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-700 sm:hidden">
                    {day.substring(0, 3)}
                  </span>
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 flex-1 overflow-hidden auto-rows-fr">
              {days.map((day, dayIdx) => {
                const dayTasks = getTasksForDate(day);
                const isSelected = selectedDate && isEqual(day, selectedDate);
                const isFirstWeek = dayIdx < 7;

                return (
                  <div
                    key={day.toString()}
                    className={`border-r border-b last:border-r-0 border-gray-200 p-1 sm:p-2 cursor-pointer transition-all hover:bg-gray-50 ${
                      !isSameMonth(day, currentDate) ? 'bg-gray-50/50' : 'bg-white'
                    } ${isToday(day) ? 'bg-blue-50/70' : ''} ${
                      isSelected ? 'bg-blue-100 ring-1 ring-inset ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex items-start justify-between mb-1">
                        <span className={`text-xs sm:text-sm lg:text-base font-medium ${
                          isToday(day) ? 'text-white bg-blue-600 rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center' : 
                          !isSameMonth(day, currentDate) ? 'text-gray-400' : 'text-gray-900'
                        }`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                      
                      {/* Tasks display */}
                      <div className="flex-1 overflow-hidden">
                        {dayTasks.length > 0 && (
                          <div className="space-y-0.5">
                            {dayTasks.slice(0, 3).map((task, idx) => (
                              <div
                                key={task.id}
                                className={`text-[8px] sm:text-[10px] lg:text-xs px-1 py-0.5 rounded truncate ${
                                  task.priority === 'high'
                                    ? 'bg-red-100 text-red-700 border-l-2 border-red-500'
                                    : task.priority === 'medium'
                                    ? 'bg-yellow-100 text-yellow-700 border-l-2 border-yellow-500'
                                    : 'bg-green-100 text-green-700 border-l-2 border-green-500'
                                }`}
                              >
                                {task.title}
                              </div>
                            ))}
                            {dayTasks.length > 3 && (
                              <div className="text-[8px] sm:text-[10px] text-gray-500 px-1">
                                +{dayTasks.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tasks Panel - Right Side - Takes 1 column on desktop */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[450px] lg:h-full overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900">
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Task Details'}
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {selectedDate ? (
                getTasksForDate(selectedDate).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-gray-500 text-sm sm:text-base font-medium">No tasks scheduled</p>
                    <p className="text-gray-400 text-xs sm:text-sm mt-1">Add tasks for this date</p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {getTasksForDate(selectedDate).map(task => (
                      <div
                        key={task.id}
                        className={`p-3 sm:p-4 rounded-lg border-l-4 ${
                          task.priority === 'high'
                            ? 'bg-red-50 border-red-500'
                            : task.priority === 'medium'
                            ? 'bg-yellow-50 border-yellow-500'
                            : 'bg-green-50 border-green-500'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-sm sm:text-base text-gray-900">{task.title}</h4>
                          <span className={`text-[10px] sm:text-xs px-2 py-1 rounded-full font-medium ${
                            task.priority === 'high'
                              ? 'bg-red-200 text-red-800'
                              : task.priority === 'medium'
                              ? 'bg-yellow-200 text-yellow-800'
                              : 'bg-green-200 text-green-800'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                        
                        {task.description && (
                          <p className="text-xs sm:text-sm text-gray-600 mb-2">{task.description}</p>
                        )}
                        
                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="space-y-1 mt-2 pt-2 border-t border-gray-200">
                            <p className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">Subtasks:</p>
                            {task.subtasks.map(subtask => (
                              <div
                                key={subtask.id}
                                className={`text-xs sm:text-sm ${
                                  subtask.status === 'completed' ? 'line-through opacity-60' : ''
                                }`}
                              >
                                <span>{subtask.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <svg className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm sm:text-base font-medium">Select a date</p>
                  <p className="text-gray-400 text-xs sm:text-sm mt-1">Click on any date to view tasks</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
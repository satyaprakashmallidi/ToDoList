import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Clock, 
  TrendingUp, 
  CheckCircle2,
  MoreHorizontal,
  Users 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useAuth } from '../contexts/AuthContext';
import { useTimeStore } from '../contexts/TimeStore';
import { useSupabase } from '../hooks/useSupabase';
import { Task } from '../types/tasks';
import PomodoroTimer from '../components/PomodoroTimer';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const Dashboard: React.FC = () => {
  const [currentPhase, setCurrentPhase] = useState<'work' | 'short' | 'long'>('work');
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month'>('day');
  const [, setTick] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  
  const { user } = useAuth();
  const { supabase } = useSupabase();
  const navigate = useNavigate();
  const { 
    isRunning, 
    isPaused, 
    runningSession, 
    getTodayMinutes,
    getWeekMinutes,
    getMonthMinutes,
    getDayMinutesByCategory,
    getWeekMinutesByCategory,
    getMonthMinutesByCategory
  } = useTimeStore();

  // Fetch tasks from Supabase
  const fetchTasks = async () => {
    if (!user?.id) return;

    try {
      setTasksLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  // Set up real-time subscription for tasks
  useEffect(() => {
    if (!user?.id) return;

    fetchTasks();

    // Set up real-time subscription
    const subscription = supabase
      .channel('tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Task change detected:', payload);
          fetchTasks(); // Refetch tasks when changes occur
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // Calculate task stats from real Supabase data
  const getTaskStats = () => {
    const total = tasks.length;
    const open = tasks.filter(t => t.status === 'open').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;

    return { total, open, inProgress, completed };
  };

  const taskStats = getTaskStats();

  // Real-time updates - force re-render every second when timer is running
  useEffect(() => {
    if (!isRunning && !isPaused) return;
    
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);


  // User status based on timer state - only show as online if timer is actually running
  const getCurrentUserStatus = () => {
    if (isRunning && runningSession) {
      return { status: 'Online', color: 'bg-green-500', animate: 'animate-pulse' };
    }
    if (isPaused && runningSession) {
      return { status: 'Break', color: 'bg-yellow-500', animate: 'animate-pulse' };
    }
    return { status: 'Offline', color: 'bg-gray-400', animate: '' };
  };

  // Team members with dynamic status - only show when actively working
  const getTeamMembers = () => {
    const currentUser = getCurrentUserStatus();
    // Only include user if they're actually Online (timer running)
    if (currentUser.status === 'Online') {
      return [{ name: 'You', ...currentUser }];
    }
    return [];
  };


  // Get real-time data from time store
  const getViewData = () => {
    if (currentView === 'day') {
      const categories = getDayMinutesByCategory();
      return {
        targetHours: 8,
        minutesByDay: [categories.Focus],
        categoriesMinutes: categories,
        workHoursProgress: Math.min(categories.Focus / (8 * 60), 1)
      };
    } else if (currentView === 'week') {
      const categories = getWeekMinutesByCategory();
      const weekMinutes = getWeekMinutes();
      const weekCategoryRatio = categories.Focus / (categories.Focus + categories.Breaks + categories.Other);
      const focusMinutesByDay = weekMinutes.map(day => Math.floor(day * (isNaN(weekCategoryRatio) ? 0 : weekCategoryRatio)));
      
      return {
        targetHours: 40,
        minutesByDay: focusMinutesByDay,
        categoriesMinutes: categories,
        workHoursProgress: Math.min(categories.Focus / (40 * 60), 1)
      };
    } else {
      const categories = getMonthMinutesByCategory();
      const monthMinutes = getMonthMinutes();
      const monthCategoryRatio = categories.Focus / (categories.Focus + categories.Breaks + categories.Other);
      const focusMinutesByDay = monthMinutes.map(day => Math.floor(day * (isNaN(monthCategoryRatio) ? 0 : monthCategoryRatio)));
      
      return {
        targetHours: 168,
        minutesByDay: focusMinutesByDay,
        categoriesMinutes: categories,
        workHoursProgress: Math.min(categories.Focus / (168 * 60), 1)
      };
    }
  };

  // Get break progress
  const getBreakProgress = () => {
    const viewData = getViewData();
    const totalMinutes = viewData.categoriesMinutes.Focus + viewData.categoriesMinutes.Breaks + viewData.categoriesMinutes.Other;
    
    if (totalMinutes === 0) return 0;
    return viewData.categoriesMinutes.Breaks / totalMinutes;
  };

  // Get current break minutes
  const getCurrentBreakMinutes = () => {
    const viewData = getViewData();
    return viewData.categoriesMinutes.Breaks;
  };

  const colors = {
    focus: 'hsl(var(--productivity-focus))',
    accent: 'hsl(var(--productivity-accent))',
  };

  const fmtHM = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m} min`;
    return `${h} hr ${m} min`;
  };

  const sum = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);
  const sumObjVals = (obj: Record<string, number>): number =>
    Object.values(obj).reduce((a, b) => a + b, 0);

  const getKPIs = () => {
    const viewData = getViewData();
    let workMins = 0;
    let avg = '—';
    let focusPct = '—';

    if (currentView === 'day') {
      workMins = viewData.categoriesMinutes.Focus;
      const totalCat = sumObjVals(viewData.categoriesMinutes);
      focusPct = totalCat > 0 ? `${Math.round((viewData.categoriesMinutes.Focus / totalCat) * 100)}%` : '0%';
    } else if (currentView === 'week') {
      workMins = sum(viewData.minutesByDay);
      avg = fmtHM(workMins / 7);
      const totalCat = sumObjVals(viewData.categoriesMinutes);
      focusPct = totalCat > 0 ? `${Math.round((viewData.categoriesMinutes.Focus / totalCat) * 100)}%` : '0%';
    } else {
      workMins = sum(viewData.minutesByDay);
      const daysInMonth = viewData.minutesByDay.length;
      avg = fmtHM(workMins / daysInMonth);
      const totalCat = sumObjVals(viewData.categoriesMinutes);
      focusPct = totalCat > 0 ? `${Math.round((viewData.categoriesMinutes.Focus / totalCat) * 100)}%` : '0%';
    }

    const pct = ((workMins / 60) / viewData.targetHours) * 100;
    
    return {
      workHours: fmtHM(workMins),
      target: `${Math.min(999, pct).toFixed(0)}%`,
      targetSub: `of ${viewData.targetHours} hr 0 min`,
      avg,
      focusPct
    };
  };

  const getBarData = () => {
    const viewData = getViewData();
    
    if (currentView === 'week') {
      return {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'Hours',
          data: viewData.minutesByDay.map(v => v / 60),
          backgroundColor: colors.accent,
          borderRadius: 6,
        }]
      };
    } else {
      const N = viewData.minutesByDay.length;
      return {
        labels: Array.from({ length: N }, (_, i) => `${i + 1}`),
        datasets: [{
          label: 'Hours',
          data: viewData.minutesByDay.map(v => v / 60),
          backgroundColor: colors.accent,
          borderRadius: 6,
        }]
      };
    }
  };

  // Recent tasks
  const recentTasks = tasks
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const kpis = getKPIs();

  return (
    <div className="flex-1 p-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {currentView === 'day' ? 'Daily Summary' 
              : currentView === 'week' ? 'Week Overview' 
              : 'Month Overview'}
          </h1>
          <div className="flex gap-2">
            {(['day', 'week', 'month'] as const).map((view) => (
              <Button
                key={view}
                variant={currentView === view ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView(view)}
                className={currentView === view 
                  ? 'bg-primary text-primary-foreground border-transparent shadow-lg hover:bg-primary/90'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                }
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <Card className="p-4 border border-gray-200 bg-white shadow-sm">
            <h4 className="text-sm font-semibold text-gray-600 mb-1">Work Hours</h4>
            <div className="text-2xl font-bold text-gray-900">{kpis.workHours}</div>
          </Card>
          <Card className="p-4 border border-gray-200 bg-white shadow-sm">
            <h4 className="text-sm font-semibold text-gray-600 mb-1">Percent of Target</h4>
            <div className="text-2xl font-bold text-gray-900">{kpis.target}</div>
            <div className="text-xs text-gray-600">{kpis.targetSub}</div>
          </Card>
          <Card className="p-4 border border-gray-200 bg-white shadow-sm">
            <h4 className="text-sm font-semibold text-gray-600 mb-1">Focus Percent</h4>
            <div className="text-2xl font-bold text-gray-900">{kpis.focusPct}</div>
          </Card>
        </div>

        {/* Day View: Timer + Breakdown */}
        {currentView === 'day' && (
          <Card className="border border-gray-200 bg-white shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              {/* Timer */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">{currentPhase === 'work' ? 'Focus' : 'Break'}</h3>
                </div>
                <div className="h-px bg-gray-200 mb-4"></div>
                <div className="flex items-center justify-center min-h-[280px]">
                  <PomodoroTimer size={256} onPhaseChange={setCurrentPhase} />
                </div>
              </div>

              {/* Breakdown */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Breakdown</h3>
                </div>
                <div className="h-px bg-gray-200 mb-4"></div>
                <div className="flex flex-col items-center justify-center min-h-[280px]">
                  <div className="w-64 h-64 bg-white rounded-lg flex items-center justify-center mb-4">
                    <svg width="256" height="256" viewBox="0 0 256 256">
                      {/* Light gray base circles */}
                      <circle cx="128" cy="128" r="96" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                      <circle cx="128" cy="128" r="76" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                      <circle cx="128" cy="128" r="56" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                      
                      {/* Focus Ring (red) - Work Hours Progress */}
                      <circle 
                        cx="128" 
                        cy="128" 
                        r="96" 
                        fill="none" 
                        stroke="#FF3B30" 
                        strokeWidth="10"
                        strokeDasharray={`${getViewData().workHoursProgress * 603} 603`}
                        strokeLinecap="round"
                        transform="rotate(-90 128 128)"
                      />
                      
                      {/* Tasks Ring (green) - middle */}
                      <circle 
                        cx="128" 
                        cy="128" 
                        r="76" 
                        fill="none" 
                        stroke="#22c55e" 
                        strokeWidth="10"
                        strokeDasharray={`${(taskStats.completed / Math.max(taskStats.total, 1)) * 477} 477`}
                        strokeLinecap="round"
                        transform="rotate(-90 128 128)"
                      />
                      
                      {/* Breaks Ring (blue) - inner */}
                      <circle 
                        cx="128" 
                        cy="128" 
                        r="56" 
                        fill="none" 
                        stroke="#3b82f6" 
                        strokeWidth="10"
                        strokeDasharray={`${getBreakProgress() * 351} 351`}
                        strokeLinecap="round"
                        transform="rotate(-90 128 128)"
                      />
                    </svg>
                  </div>

                  {/* Legend */}
                  <div className="bg-transparent p-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#FF3B30]"></div>
                          <span className="text-sm font-medium text-gray-700">Focus</span>
                        </div>
                        <span className="text-sm text-gray-600">{fmtHM(getViewData().categoriesMinutes.Focus)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div>
                          <span className="text-sm font-medium text-gray-700">Breaks</span>
                        </div>
                        <span className="text-sm text-gray-600">{fmtHM(getCurrentBreakMinutes())}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
                          <span className="text-sm font-medium text-gray-700">Tasks</span>
                        </div>
                        <span className="text-sm text-gray-600">{taskStats.completed}/{taskStats.total}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Week/Month View: Bars + Breakdown */}
        {(currentView === 'week' || currentView === 'month') && (
          <Card className="border border-gray-200 bg-white shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              {/* Bar Chart */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Work Hours</h3>
                </div>
                <div className="h-px bg-gray-200 mb-4"></div>
                <div className="h-64">
                  <Bar
                    data={getBarData()}
                    options={{
                      maintainAspectRatio: false,
                      responsive: true,
                      scales: {
                        x: { 
                          grid: { display: false }, 
                          ticks: { color: '#6b7280' } 
                        },
                        y: { 
                          grid: { color: '#e5e7eb' }, 
                          ticks: { 
                            color: '#6b7280',
                            stepSize: 2,
                            callback: function(value) {
                              return String(value);
                            }
                          }, 
                          beginAtZero: true,
                          max: 12
                        }
                      },
                      plugins: { 
                        legend: { display: false }, 
                        tooltip: { 
                          callbacks: { 
                            label: (ctx) => `${(ctx.raw as number).toFixed(1)} hrs`
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Breakdown - Same as day view */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Breakdown</h3>
                </div>
                <div className="h-px bg-gray-200 mb-4"></div>
                <div className="flex flex-col items-center justify-center">
                  <div className="w-64 h-64 bg-white rounded-lg flex items-center justify-center mb-4">
                    <svg width="256" height="256" viewBox="0 0 256 256">
                      {/* Light gray base circles */}
                      <circle cx="128" cy="128" r="96" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                      <circle cx="128" cy="128" r="76" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                      <circle cx="128" cy="128" r="56" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                      
                      {/* Focus Ring (red) - Work Hours Progress */}
                      <circle 
                        cx="128" 
                        cy="128" 
                        r="96" 
                        fill="none" 
                        stroke="#FF3B30" 
                        strokeWidth="10"
                        strokeDasharray={`${getViewData().workHoursProgress * 603} 603`}
                        strokeLinecap="round"
                        transform="rotate(-90 128 128)"
                      />
                      
                      {/* Tasks Ring (green) - middle */}
                      <circle 
                        cx="128" 
                        cy="128" 
                        r="76" 
                        fill="none" 
                        stroke="#22c55e" 
                        strokeWidth="10"
                        strokeDasharray={`${(taskStats.completed / Math.max(taskStats.total, 1)) * 477} 477`}
                        strokeLinecap="round"
                        transform="rotate(-90 128 128)"
                      />
                      
                      {/* Breaks Ring (blue) - inner */}
                      <circle 
                        cx="128" 
                        cy="128" 
                        r="56" 
                        fill="none" 
                        stroke="#3b82f6" 
                        strokeWidth="10"
                        strokeDasharray={`${getBreakProgress() * 351} 351`}
                        strokeLinecap="round"
                        transform="rotate(-90 128 128)"
                      />
                    </svg>
                  </div>

                  {/* Legend */}
                  <div className="bg-transparent p-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#FF3B30]"></div>
                          <span className="text-sm font-medium text-gray-700">Focus</span>
                        </div>
                        <span className="text-sm text-gray-600">{fmtHM(getViewData().categoriesMinutes.Focus)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div>
                          <span className="text-sm font-medium text-gray-700">Breaks</span>
                        </div>
                        <span className="text-sm text-gray-600">{fmtHM(getCurrentBreakMinutes())}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
                          <span className="text-sm font-medium text-gray-700">Tasks</span>
                        </div>
                        <span className="text-sm text-gray-600">{taskStats.completed}/{taskStats.total}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Tasks and Team Members Section */}
        <Card className="border border-gray-200 bg-white shadow-sm mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            {/* Tasks KPI Summary */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tasks Summary</h3>
              <div 
                className="grid grid-cols-2 gap-4"
                style={{
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                {/* Total Tasks */}
                <div 
                  className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105"
                  onClick={() => navigate('/app/tasks')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Total Tasks</p>
                      <p className="text-2xl font-bold text-blue-600 transition-colors duration-200">{tasksLoading ? '—' : taskStats.total}</p>
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-gray-600" />
                    </div>
                  </div>
                </div>

                {/* Completed Tasks */}
                <div 
                  className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105"
                  onClick={() => navigate('/app/tasks')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Completed</p>
                      <p className="text-2xl font-bold text-green-600 transition-colors duration-200">{tasksLoading ? '—' : taskStats.completed}</p>
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-gray-600" />
                    </div>
                  </div>
                </div>

                {/* In Progress Tasks */}
                <div 
                  className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105"
                  onClick={() => navigate('/app/tasks')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">In Progress</p>
                      <p className="text-2xl font-bold text-orange-600 transition-colors duration-200">{tasksLoading ? '—' : taskStats.inProgress}</p>
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 text-gray-600" />
                    </div>
                  </div>
                </div>

                {/* Open Tasks */}
                <div 
                  className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105"
                  onClick={() => navigate('/app/tasks')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Open</p>
                      <p className="text-2xl font-bold text-gray-600 transition-colors duration-200">{tasksLoading ? '—' : taskStats.open}</p>
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-gray-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Team Members */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Members Online</h3>
              <div className="space-y-3">
                {getTeamMembers().length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-gray-600">No team members online</p>
                  </div>
                ) : (
                  getTeamMembers().map((member, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${member.color} ${member.animate}`}></div>
                          <span className="text-sm font-medium text-gray-900">{member.name}</span>
                        </div>
                        <span className="text-xs text-gray-600">{member.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
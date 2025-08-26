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
  const [showActivityView, setShowActivityView] = useState(false);
  const [showJumpBackView, setShowJumpBackView] = useState(false);
  const [jumpBackAnimated, setJumpBackAnimated] = useState(false);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [selectedMusicMode, setSelectedMusicMode] = useState<'focus' | 'relax' | 'sleep' | 'meditate' | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedTimer, setSelectedTimer] = useState('Infinity');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [timerMode, setTimerMode] = useState<'infinite' | 'timer'>('infinite');
  const [customTimer, setCustomTimer] = useState({ hours: 0, minutes: 30 });
  const [volume, setVolume] = useState(70);
  const [realTimeStreak, setRealTimeStreak] = useState(0);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [recentSessions, setRecentSessions] = useState([
    { mode: 'relax', activity: 'Custom Relax Mix', time: '30 mins', color: 'bg-blue-500' },
    { mode: 'sleep', activity: 'Unguided', time: '45 mins', color: 'bg-green-500' },
    { mode: 'sleep', activity: 'Recharge', time: '20 mins', color: 'bg-blue-500' },
    { mode: 'focus', activity: 'Deep Work', time: '60 mins', color: 'bg-red-500' },
    { mode: 'sleep', activity: 'Deep Sleep', time: '8 hrs', color: 'bg-purple-500' },
    { mode: 'focus', activity: 'Custom Focus Mix', time: '90 mins', color: 'bg-red-500' }
  ]);
  
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

  // Focus Music Player implementation
  useEffect(() => {
    class FocusMusicPlayer {
      constructor() {
        this.audioContext = null;
        this.leftOscillator = null;
        this.rightOscillator = null;
        this.leftGain = null;
        this.rightGain = null;
        this.merger = null;
        this.isPlaying = false;
        this.currentMode = null;
        this.currentVolume = 70; // Default volume
        
        this.focusModes = {
          focus: { baseFreq: 200, beatFreq: 20, name: 'Focus' },
          relax: { baseFreq: 180, beatFreq: 10, name: 'Relax' },
          sleep: { baseFreq: 160, beatFreq: 6, name: 'Sleep' },
          meditate: { baseFreq: 220, beatFreq: 8, name: 'Meditate' }
        };

        this.initializeEventListeners();
      }

      initializeEventListeners() {
        // Focus mode cards
        document.querySelectorAll('.focus-card').forEach(card => {
          card.addEventListener('click', (e) => {
            const mode = card.dataset.mode;
            if (this.currentMode === mode && this.isPlaying) {
              this.stop();
            } else {
              this.playMode(mode);
            }
          });
        });
      }

      async initializeAudioContext() {
        if (!this.audioContext) {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
          }
        }
      }

      createBinauralBeat(baseFreq, beatFreq, volume) {
        if (this.leftOscillator) this.stop();
        
        this.leftOscillator = this.audioContext.createOscillator();
        this.rightOscillator = this.audioContext.createOscillator();
        
        this.leftGain = this.audioContext.createGain();
        this.rightGain = this.audioContext.createGain();
        
        this.merger = this.audioContext.createChannelMerger(2);
        
        this.leftOscillator.frequency.setValueAtTime(
          baseFreq - beatFreq/2, 
          this.audioContext.currentTime
        );
        this.rightOscillator.frequency.setValueAtTime(
          baseFreq + beatFreq/2, 
          this.audioContext.currentTime
        );
        
        this.leftOscillator.type = 'sine';
        this.rightOscillator.type = 'sine';
        
        const actualVolume = volume / 100;
        this.leftGain.gain.setValueAtTime(actualVolume, this.audioContext.currentTime);
        this.rightGain.gain.setValueAtTime(actualVolume, this.audioContext.currentTime);
        
        this.leftOscillator.connect(this.leftGain);
        this.rightOscillator.connect(this.rightGain);
        
        this.leftGain.connect(this.merger, 0, 0);
        this.rightGain.connect(this.merger, 0, 1);
        
        this.merger.connect(this.audioContext.destination);
      }

      async playMode(mode) {
        try {
          await this.initializeAudioContext();
          
          const modeConfig = this.focusModes[mode];
          const volume = 15; // Default volume
          
          this.createBinauralBeat(modeConfig.baseFreq, modeConfig.beatFreq, volume);
          
          this.leftOscillator.start();
          this.rightOscillator.start();
          
          this.isPlaying = true;
          this.currentMode = mode;
          
        } catch (error) {
          console.error('Error starting audio:', error);
        }
      }

      stop() {
        if (this.isPlaying) {
          if (this.leftOscillator) this.leftOscillator.stop();
          if (this.rightOscillator) this.rightOscillator.stop();
          
          this.leftOscillator = null;
          this.rightOscillator = null;
          this.leftGain = null;
          this.rightGain = null;
          this.merger = null;
          
          this.isPlaying = false;
          this.currentMode = null;
        }
      }

      stopAll() {
        this.stop();
      }

      // Real-time volume update method
      updateVolume(volumePercent) {
        if (this.leftGain && this.rightGain && this.audioContext) {
          // Smooth volume transition - increased max volume for better audibility
          const audioVolume = Math.max(0, Math.min(1, (volumePercent / 100) * 0.3));
          const currentTime = this.audioContext.currentTime;
          
          try {
            // Use exponentialRampToValueAtTime for smoother transitions
            if (audioVolume > 0) {
              this.leftGain.gain.exponentialRampToValueAtTime(audioVolume, currentTime + 0.05);
              this.rightGain.gain.exponentialRampToValueAtTime(audioVolume, currentTime + 0.05);
            } else {
              // Handle zero volume case
              this.leftGain.gain.linearRampToValueAtTime(0, currentTime + 0.05);
              this.rightGain.gain.linearRampToValueAtTime(0, currentTime + 0.05);
            }
          } catch (e) {
            // Fallback to immediate value setting
            this.leftGain.gain.setValueAtTime(audioVolume, currentTime);
            this.rightGain.gain.setValueAtTime(audioVolume, currentTime);
          }
          
          // Store current volume for reference
          this.currentVolume = volumePercent;
        }
      }
      
      // Get current volume
      getCurrentVolume() {
        return this.currentVolume || 70;
      }
    }

    // Initialize the focus music player
    const initPlayer = () => {
      if (!window.focusPlayer) {
        console.log('Initializing FocusMusicPlayer...');
        window.focusPlayer = new FocusMusicPlayer();
        console.log('FocusMusicPlayer initialized:', !!window.focusPlayer);
        console.log('UpdateVolume method available:', !!window.focusPlayer.updateVolume);
        
        // Set initial volume
        if (window.focusPlayer.updateVolume) {
          window.focusPlayer.updateVolume(volume);
          console.log('Initial volume set to:', volume);
        }
      }
    };

    // Initialize after a short delay to ensure DOM is ready
    const timer = setTimeout(initPlayer, 100);

    return () => {
      clearTimeout(timer);
      // Cleanup audio when component unmounts
      if (window.focusPlayer && window.focusPlayer.isPlaying) {
        window.focusPlayer.stop();
      }
    };
  }, []); // Empty dependency array means this runs once when component mounts

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

  // Music player timer effect
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Real-time weekly streak calculation with debugging
  useEffect(() => {
    const calculateWeekStreak = () => {
      if (!user?.id) {
        console.log('No user ID, using default streak');
        return 20;
      }
      
      // Get current week statistics
      const weekMinutes = getWeekMinutes();
      const todayMinutes = getTodayMinutes();
      const isCurrentlyActive = isRunning || isPlaying;
      
      console.log('Streak calculation:', { 
        weekMinutes, 
        todayMinutes, 
        isCurrentlyActive, 
        isRunning, 
        isPlaying, 
        currentTime 
      });
      
      // Base weekly streak calculation
      let weekStreak = 15; // Lower base for more dynamic feel
      
      // Dynamic weekly adjustments
      const weeklyTarget = 300; // 5 hours per week target
      const weekProgress = weekMinutes / weeklyTarget;
      
      if (weekProgress > 1.5) weekStreak += 6; // Excellent week
      else if (weekProgress > 1.2) weekStreak += 4; // Great week
      else if (weekProgress > 1.0) weekStreak += 3; // Good week
      else if (weekProgress > 0.8) weekStreak += 2; // Okay week
      else if (weekProgress > 0.5) weekStreak += 1; // Some progress
      else weekStreak += 0; // Below target
      
      // Real-time bonuses for current session
      if (isCurrentlyActive) weekStreak += 2;
      if (todayMinutes > 60) weekStreak += 2;
      if (todayMinutes > 30) weekStreak += 1;
      if (isPlaying && currentTime > 300) weekStreak += 3; // 5+ min session
      if (isPlaying && currentTime > 60) weekStreak += 1; // 1+ min session
      
      const finalStreak = Math.max(1, weekStreak);
      console.log('Final streak:', finalStreak);
      return finalStreak;
    };
    
    const updateStreak = () => {
      const newStreak = calculateWeekStreak();
      console.log('Updating streak to:', newStreak);
      setRealTimeStreak(newStreak);
    };
    
    // Initial calculation
    updateStreak();
    
    // Update every 2 seconds for more responsive feel
    const interval = setInterval(updateStreak, 2000);
    
    return () => clearInterval(interval);
  }, [user?.id, getWeekMinutes, getTodayMinutes, isRunning, isPlaying, currentTime]);

  // Volume drag functionality
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingVolume) return;
      
      const volumeSlider = document.querySelector('.volume-slider');
      if (volumeSlider) {
        const rect = volumeSlider.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        const newVolume = Math.max(0, Math.min(100, percentage));
        setVolume(newVolume);
        
        // Real-time audio update during drag
        if (window.focusPlayer && window.focusPlayer.updateVolume) {
          window.focusPlayer.updateVolume(newVolume);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingVolume(false);
    };

    if (isDraggingVolume) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingVolume]);

  // Sync volume with audio player when state changes
  useEffect(() => {
    if (window.focusPlayer && isPlaying) {
      console.log('Syncing volume on playback state change:', volume);
      if (window.focusPlayer.updateVolume) {
        window.focusPlayer.updateVolume(volume);
      } else if (window.focusPlayer.leftGain && window.focusPlayer.rightGain) {
        const audioVolume = Math.max(0, Math.min(1, (volume / 100) * 0.3));
        try {
          window.focusPlayer.leftGain.gain.setValueAtTime(audioVolume, window.focusPlayer.audioContext.currentTime);
          window.focusPlayer.rightGain.gain.setValueAtTime(audioVolume, window.focusPlayer.audioContext.currentTime);
          console.log('Volume synced via direct gain control:', audioVolume);
        } catch (e) {
          console.log('Error syncing volume:', e);
        }
      }
    }
  }, [isPlaying, volume]);

  // Jump back animation effect
  useEffect(() => {
    if (showJumpBackView && !jumpBackAnimated) {
      // Small delay to ensure the view is rendered before animating
      const timer = setTimeout(() => {
        setJumpBackAnimated(true);
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [showJumpBackView, jumpBackAnimated]);

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
                            label: (ctx) => {
                              const hours = ctx.raw as number;
                              const totalMinutes = Math.round(hours * 60);
                              const h = Math.floor(totalMinutes / 60);
                              const m = totalMinutes % 60;
                              if (h === 0 && m === 0) return '0 min';
                              if (h === 0) return `${m} min`;
                              if (m === 0) return `${h} hr`;
                              return `${h} hr ${m} min`;
                            }
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

        {/* Focus Music Player */}
        <Card className="border border-gray-200 bg-white shadow-sm mt-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Music</h3>
            </div>
            
            {!showActivityView && !showJumpBackView && !showMusicPlayer ? (
              <>
                {/* 2x2 Grid Clone of Brain.fm-style Sections */}
                <div className="focus-grid-container">
              <div className="focus-grid-item">
                <div className="focus-card" data-mode="focus" onClick={() => {
                  setSelectedMusicMode('focus');
                  setShowMusicPlayer(true);
                  setCurrentTime(0);
                  if (window.focusPlayer) {
                    window.focusPlayer.playMode('focus');
                  }
                  setIsPlaying(true);
                }}>
                  <h3 className="text-xl font-semibold">Focus</h3>
                  <div className="focus-card-image">
                    <img 
                      src="https://sdmntpraustraliaeast.oaiusercontent.com/files/00000000-5410-61fa-a8fe-ef6d64cccc53/raw?se=2025-08-26T10%3A42%3A51Z&sp=r&sv=2024-08-04&sr=b&scid=924d8e5b-83eb-511d-b948-981f8e0447bd&skoid=5c72dd08-68ae-4091-b4e1-40ccec0693ae&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-26T02%3A41%3A34Z&ske=2025-08-27T02%3A41%3A34Z&sks=b&skv=2024-08-04&sig=tGnIiy0b/djIQSFzZd8Hjk4sYFT6eq5j0s7iEzkWWDg%3D"
                      alt="Focus" 
                      className="focus-illustration w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
              <div className="focus-grid-item">
                <div className="focus-card" data-mode="relax" onClick={() => {
                  setSelectedMusicMode('relax');
                  setShowMusicPlayer(true);
                  setCurrentTime(0);
                  if (window.focusPlayer) {
                    window.focusPlayer.playMode('relax');
                  }
                  setIsPlaying(true);
                }}>
                  <h3 className="text-xl font-semibold">Relax</h3>
                  <div className="focus-card-image">
                    <img 
                      src="https://sdmntpraustraliaeast.oaiusercontent.com/files/00000000-60f4-61fa-9080-ab3371db3c2f/raw?se=2025-08-26T10%3A42%3A51Z&sp=r&sv=2024-08-04&sr=b&scid=bc1e0b54-aa25-5b31-ba69-9b04d21b3a64&skoid=5c72dd08-68ae-4091-b4e1-40ccec0693ae&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-26T02%3A27%3A56Z&ske=2025-08-27T02%3A27%3A56Z&sks=b&skv=2024-08-04&sig=SnN3SH4Q3B5xNKiF9YAkQx930nO0vMdLla4kII0PWc0%3D"
                      alt="Relax" 
                      className="relax-illustration w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
              <div className="focus-grid-item">
                <div className="focus-card" data-mode="sleep" onClick={() => {
                  setSelectedMusicMode('sleep');
                  setShowMusicPlayer(true);
                  setCurrentTime(0);
                  if (window.focusPlayer) {
                    window.focusPlayer.playMode('sleep');
                  }
                  setIsPlaying(true);
                }}>
                  <h3 className="text-xl font-semibold">Sleep</h3>
                  <div className="focus-card-image">
                    <img 
                      src="https://sdmntpraustraliaeast.oaiusercontent.com/files/00000000-ee8c-61fa-ac54-ffb4eb2a875e/raw?se=2025-08-26T10%3A42%3A51Z&sp=r&sv=2024-08-04&sr=b&scid=2923de44-83d3-5b20-8bcc-07c109c2fcc6&skoid=5c72dd08-68ae-4091-b4e1-40ccec0693ae&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-26T02%3A26%3A27Z&ske=2025-08-27T02%3A26%3A27Z&sks=b&skv=2024-08-04&sig=GZpSKyH7fY8ggvQOzGCs1JY8/Vy3BivREyiGRVV5ggc%3D"
                      alt="Sleep" 
                      className="sleep-illustration w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
              <div className="focus-grid-item">
                <div className="focus-card" data-mode="meditate" onClick={() => {
                  setSelectedMusicMode('meditate');
                  setShowMusicPlayer(true);
                  setCurrentTime(0);
                  if (window.focusPlayer) {
                    window.focusPlayer.playMode('meditate');
                  }
                  setIsPlaying(true);
                }}>
                  <h3 className="text-xl font-semibold">Meditate</h3>
                  <div className="focus-card-image">
                    <img 
                      src="https://sdmntprpolandcentral.oaiusercontent.com/files/00000000-774c-620a-acb4-ab4d11917b3a/raw?se=2025-08-26T10%3A42%3A51Z&sp=r&sv=2024-08-04&sr=b&scid=45d35200-65dd-5367-88b2-78130612dc4a&skoid=5c72dd08-68ae-4091-b4e1-40ccec0693ae&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-26T09%3A40%3A04Z&ske=2025-08-27T09%3A40%3A04Z&sks=b&skv=2024-08-04&sig=EvaGrAVOhyR3fKYJzhvRb2YleTHCsBAzVCZWaP/778I%3D"
                      alt="Meditate" 
                      className="meditate-illustration w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
                </div>

                {/* JUMP BACK IN Button */}
                <div className="jump-back">
                  <button
                    onClick={() => {
                      setJumpBackAnimated(true);
                      setTimeout(() => setShowJumpBackView(true), 150);
                    }}
                    className="jump-btn flex items-center gap-2"
                  >
                    JUMP BACK IN
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </>
            ) : showJumpBackView ? (
              /* Jump Back In View */
              <div className={`w-full max-w-4xl mx-auto transition-all duration-500 ease-in-out transform ${
                jumpBackAnimated ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}>
                {/* Header */}
                <div className="jump-back mb-6">
                  <button
                    onClick={() => {
                      setJumpBackAnimated(false);
                      setTimeout(() => setShowJumpBackView(false), 150);
                    }}
                    className="jump-btn flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    JUMP BACK IN
                  </button>
                </div>

                {/* Recent Sessions */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Recent Sessions</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {recentSessions.map((session, index) => (
                      <div
                        key={index}
                        className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
                        onClick={() => {
                          // Handle session click
                          if (window.focusPlayer) {
                            window.focusPlayer.playMode(session.mode);
                          }
                        }}
                      >
                        <div className={`w-3 h-3 rounded-full ${session.color}`}></div>
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 capitalize mb-1">{session.mode} • {session.time}</div>
                          <div className="text-sm font-medium text-gray-900">{session.activity}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Tracks */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Recent Tracks</h3>
                  <div className="space-y-3">
                    {recentTasks.slice(0, 4).map((task, index) => (
                      <div
                        key={task.id}
                        className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer flex items-center gap-4"
                        onClick={() => navigate('/app/tasks')}
                      >
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <div className="w-6 h-1 bg-white rounded-full mb-1"></div>
                          <div className="w-8 h-1 bg-white rounded-full"></div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm mb-1">{task.title}</h4>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">
                            {task.status === 'completed' ? 'Completed' : 
                             task.status === 'in_progress' ? 'In Progress' : 'Open'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01" />
                            </svg>
                          </button>
                          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </button>
                          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : showMusicPlayer ? (
              /* Modern Music Player View */
              <div 
                className={`relative w-full h-96 rounded-xl overflow-hidden ${
                  selectedMusicMode === 'focus' 
                    ? 'bg-gradient-to-br from-purple-600 via-pink-600 to-purple-800'
                    : selectedMusicMode === 'relax'
                    ? 'bg-gradient-to-br from-blue-500 via-teal-500 to-blue-700'
                    : selectedMusicMode === 'sleep'
                    ? 'bg-gradient-to-br from-indigo-600 via-purple-700 to-indigo-900'
                    : 'bg-gradient-to-br from-green-500 via-emerald-600 to-green-700'
                }`}
              >
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-70"></div>
                
                {/* Top Header */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white">
                  {/* Left - Back + Mode Dropdown */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log('Back button clicked'); // Debug log
                        setShowMusicPlayer(false);
                        setSelectedMusicMode(null);
                        setIsPlaying(false);
                        setCurrentTime(0);
                        setShowActivityView(false);
                        setSelectedActivity(null);
                        if (window.focusPlayer) {
                          window.focusPlayer.stop();
                        }
                      }}
                      className="music-back-button"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <div className="flex items-center gap-2 bg-black bg-opacity-30 rounded-full px-3 py-1">
                      <div className="w-4 h-4 flex items-center justify-center">
                        {selectedMusicMode === 'focus' ? '🎯' : 
                         selectedMusicMode === 'relax' ? '🏝️' : 
                         selectedMusicMode === 'sleep' ? '🌙' : '🧘'}
                      </div>
                      <span className="text-sm font-medium capitalize">{selectedMusicMode}</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Right - Action buttons */}
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                    </button>
                    <button className="p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Center - Timer Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <div className="text-sm font-medium mb-3 uppercase tracking-wider opacity-80">
                    {selectedMusicMode === 'focus' ? 'INCREASING FOCUS...' 
                     : selectedMusicMode === 'relax' ? 'RELAXING...'
                     : selectedMusicMode === 'sleep' ? 'SLEEPING...'
                     : 'MEDITATING...'}
                  </div>
                  <div className="text-7xl font-light mb-4">
                    {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')}
                  </div>
                  
                  {/* Infinite Play Dropdown */}
                  <button
                    onClick={() => setShowTimerSettings(true)}
                    className="flex items-center gap-2 px-5 py-2 bg-black bg-opacity-40 rounded-full text-sm hover:bg-opacity-60 transition-all border border-white border-opacity-20 mb-8"
                  >
                    <span className="text-lg">∞</span>
                    <span>{timerMode === 'infinite' ? 'Infinite Play' : `${customTimer.hours}h ${customTimer.minutes}m`}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Playback Controls */}
                  <div className="flex items-center gap-8">
                    <button className="p-3 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => {
                        if (isPlaying) {
                          setIsPlaying(false);
                          if (window.focusPlayer) {
                            window.focusPlayer.stop();
                          }
                        } else {
                          setIsPlaying(true);
                          if (window.focusPlayer) {
                            window.focusPlayer.playMode(selectedMusicMode);
                          }
                        }
                      }}
                      className="p-4 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition-colors"
                    >
                      {isPlaying ? (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                        </svg>
                      ) : (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                    
                    <button className="p-3 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Bottom Left - Album Art & Track Info */}
                <div className="absolute bottom-4 left-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center">
                        <div className="text-white text-xs font-bold">
                          {selectedMusicMode === 'focus' ? 'BL' : 
                           selectedMusicMode === 'relax' ? 'RP' : 
                           selectedMusicMode === 'sleep' ? 'DS' : 'MG'}
                        </div>
                      </div>
                    </div>
                    <div className="text-white">
                      <h4 className="font-semibold text-sm">
                        {selectedMusicMode === 'focus' ? 'Black Lights' : 
                         selectedMusicMode === 'relax' ? 'Returning Purpose' : 
                         selectedMusicMode === 'sleep' ? 'Deep Sleep' : 'Meditation Glow'}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-gray-300 mt-1">
                        <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded">Low Neural Effect</span>
                        <span>ELECTRONIC</span>
                        <span>DETAILS</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Right - Volume Control & Streak */}
                <div className="absolute bottom-4 right-4 flex items-center gap-4">
                  {/* Streak Counter */}
                  <div className="flex items-center gap-1 text-white text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    </svg>
                    <span>{realTimeStreak} week streak</span>
                  </div>
                  
                  {/* Volume Control */}
                  <div className="flex items-center gap-2 text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    <div 
                      className="volume-slider w-20 h-1 bg-gray-600 rounded-full relative cursor-pointer"
                      onMouseDown={(e) => {
                        setIsDraggingVolume(true);
                        const updateVolume = (clientX) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = clientX - rect.left;
                          const percentage = (x / rect.width) * 100;
                          const newVolume = Math.max(0, Math.min(100, percentage));
                          
                          console.log('Setting volume via drag:', newVolume, 'Player exists:', !!window.focusPlayer);
                          setVolume(newVolume);
                          
                          // Real-time audio update with debugging
                          if (window.focusPlayer) {
                            if (window.focusPlayer.updateVolume) {
                              window.focusPlayer.updateVolume(newVolume);
                              console.log('Volume updated via updateVolume method');
                            } else {
                              // Fallback direct update
                              if (window.focusPlayer.leftGain && window.focusPlayer.rightGain) {
                                const audioVolume = Math.max(0, Math.min(1, (newVolume / 100) * 0.3));
                                window.focusPlayer.leftGain.gain.setValueAtTime(audioVolume, window.focusPlayer.audioContext.currentTime);
                                window.focusPlayer.rightGain.gain.setValueAtTime(audioVolume, window.focusPlayer.audioContext.currentTime);
                                console.log('Volume updated via direct gain control:', audioVolume);
                              }
                            }
                          } else {
                            console.log('No focusPlayer found!');
                          }
                        };
                        updateVolume(e.clientX);
                      }}
                      onClick={(e) => {
                        if (!isDraggingVolume) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const percentage = (x / rect.width) * 100;
                          const newVolume = Math.max(0, Math.min(100, percentage));
                          setVolume(newVolume);
                          
                          // Real-time audio update with debugging
                          console.log('Setting volume via click:', newVolume, 'Player exists:', !!window.focusPlayer);
                          if (window.focusPlayer) {
                            if (window.focusPlayer.updateVolume) {
                              window.focusPlayer.updateVolume(newVolume);
                              console.log('Volume updated via updateVolume method (click)');
                            } else {
                              // Fallback direct update
                              if (window.focusPlayer.leftGain && window.focusPlayer.rightGain) {
                                const audioVolume = Math.max(0, Math.min(1, (newVolume / 100) * 0.3));
                                window.focusPlayer.leftGain.gain.setValueAtTime(audioVolume, window.focusPlayer.audioContext.currentTime);
                                window.focusPlayer.rightGain.gain.setValueAtTime(audioVolume, window.focusPlayer.audioContext.currentTime);
                                console.log('Volume updated via direct gain control (click):', audioVolume);
                              }
                            }
                          } else {
                            console.log('No focusPlayer found on click!');
                          }
                        }
                      }}>
                      <div 
                        className="h-1 bg-red-400 rounded-full" 
                        style={{ width: `${volume}%` }}
                      ></div>
                      <div 
                        className="absolute top-0 w-3 h-3 bg-white rounded-full transform -translate-y-1 cursor-pointer" 
                        style={{ left: `${volume}%`, marginLeft: '-6px' }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Activity Selection View */
              <div className="w-full max-w-md mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log('Activity view back button clicked');
                      setShowActivityView(false);
                      setSelectedActivity(null);
                      setSelectedMusicMode(null);
                    }}
                    className="relative z-10 p-2 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-all duration-200 hover:scale-110 cursor-pointer"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h2 className="text-xl font-semibold text-gray-900 capitalize">{selectedMusicMode}</h2>
                  <div className="w-6"></div>
                </div>

                {/* Activity Section */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Activity</h3>
                  
                  {selectedMusicMode === 'focus' && (
                    <div className="space-y-3">
                      <button
                        onClick={() => setSelectedActivity('deep-work')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'deep-work' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">⚡</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Deep Work</h4>
                            <p className="text-sm text-gray-600 mt-1">Designed for demanding tasks that require sustained periods of intense focus.</p>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('motivation')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'motivation' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">⚡</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Motivation</h4>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('creativity')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'creativity' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">🎨</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Creativity</h4>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('learning')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'learning' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">📚</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Learning</h4>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('light-work')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'light-work' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">✨</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Light Work</h4>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}

                  {selectedMusicMode === 'relax' && (
                    <div className="space-y-3">
                      <button
                        onClick={() => setSelectedActivity('recharge')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'recharge' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">🔋</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Recharge</h4>
                            <p className="text-sm text-gray-600 mt-1">Designed for you to refocus, recenter, and gain more energy.</p>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('chill')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'chill' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">🛋️</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Chill</h4>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('unwind')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'unwind' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">🌅</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Unwind</h4>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('destress')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'destress' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">💆</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Destress</h4>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('travel')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'travel' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">✈️</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Travel</h4>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}

                  {selectedMusicMode === 'sleep' && (
                    <div className="space-y-3">
                      <button
                        onClick={() => setSelectedActivity('deep-sleep')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'deep-sleep' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">😴</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Deep Sleep</h4>
                            <p className="text-sm text-gray-600 mt-1">Music designed to promote healthy and prolonged rest.</p>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('power-nap')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'power-nap' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">⚡</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Power Nap</h4>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('guided-sleep')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'guided-sleep' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">🛏️</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Guided Sleep</h4>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('wind-down')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'wind-down' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">🌙</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Wind Down</h4>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('sleep-wake')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'sleep-wake' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">🌅</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Sleep And Wake</h4>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}

                  {selectedMusicMode === 'meditate' && (
                    <div className="space-y-3">
                      <button
                        onClick={() => setSelectedActivity('unguided')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'unguided' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">🧘</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Unguided</h4>
                            <p className="text-sm text-gray-600 mt-1">Reach deeper levels of meditation without guided narration.</p>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedActivity('guided')}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          selectedActivity === 'guided' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-2xl mr-4">🎧</span>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">Guided</h4>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Timer Section */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Timer</h3>
                  <button 
                    className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all"
                    onClick={() => {
                      // Timer dropdown functionality can be added here
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-2xl mr-4">∞</span>
                        <span className="font-semibold text-gray-900">Infinity</span>
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                </div>

                {/* Start Button */}
                <div>
                  <button
                    onClick={() => {
                      if (selectedActivity) {
                        // Start the music with selected activity
                        if (window.focusPlayer) {
                          window.focusPlayer.playMode(selectedMusicMode);
                        }
                        setShowActivityView(false);
                        setSelectedActivity(null);
                      }
                    }}
                    className={`w-full py-4 px-6 rounded-full font-semibold text-lg transition-all ${
                      selectedActivity 
                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!selectedActivity}
                  >
                    START LISTENING
                  </button>
                </div>
              </div>
            )}

          </div>
        </Card>

        {/* Timer Settings Modal */}
        {showTimerSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-lg w-full max-w-md mx-4 text-white">
              {/* Header */}
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Timer Settings</h2>
                  <button
                    onClick={() => setShowTimerSettings(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Timer Type Selection */}
              <div className="p-6">
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setTimerMode('infinite')}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                      timerMode === 'infinite' 
                        ? 'border-white bg-white bg-opacity-20' 
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">∞</div>
                      <div className="text-sm font-medium">INFINITE</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setTimerMode('timer')}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                      timerMode === 'timer' 
                        ? 'border-white bg-white bg-opacity-20' 
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">⏱</div>
                      <div className="text-sm font-medium">TIMER</div>
                    </div>
                  </button>
                </div>

                {timerMode === 'infinite' ? (
                  <div className="text-center">
                    <h3 className="text-2xl font-semibold mb-2">Infinite Play</h3>
                    <p className="text-gray-400 text-sm">Listen to tracks freely without any time restrictions.</p>
                    
                    <div className="mt-6">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Activate Quotes</span>
                        <button
                          className={`w-12 h-6 rounded-full transition-colors ${
                            true ? 'bg-white' : 'bg-gray-600'
                          } relative`}
                        >
                          <div className={`w-5 h-5 bg-gray-900 rounded-full absolute top-0.5 transition-transform ${
                            true ? 'translate-x-6' : 'translate-x-0.5'
                          }`}></div>
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Quotes replace the timer display.</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <h3 className="text-2xl font-semibold mb-2">Set Timer</h3>
                    <p className="text-gray-400 text-sm mb-6">Select when you'd like the music to stop playing.</p>
                    
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { label: '30 min', minutes: 30 },
                        { label: '1 hr', minutes: 60 },
                        { label: '2 hrs', minutes: 120 }
                      ].map((preset) => (
                        <button
                          key={preset.minutes}
                          onClick={() => setCustomTimer({ hours: Math.floor(preset.minutes / 60), minutes: preset.minutes % 60 })}
                          className="px-4 py-3 border border-gray-600 rounded-lg hover:border-gray-500 transition-colors text-sm"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-2 justify-center">
                      <span className="text-gray-400">Custom</span>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={customTimer.hours}
                        onChange={(e) => setCustomTimer(prev => ({ ...prev, hours: parseInt(e.target.value) || 0 }))}
                        className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-center"
                      />
                      <span className="text-gray-400">hrs</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={customTimer.minutes}
                        onChange={(e) => setCustomTimer(prev => ({ ...prev, minutes: parseInt(e.target.value) || 0 }))}
                        className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-center"
                      />
                      <span className="text-gray-400">mins</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-700 flex gap-3">
                <button
                  onClick={() => setShowTimerSettings(false)}
                  className="flex-1 px-6 py-3 text-gray-300 hover:text-white transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => setShowTimerSettings(false)}
                  className="flex-1 px-6 py-3 bg-white text-gray-900 rounded-full font-semibold hover:bg-gray-100 transition-colors"
                >
                  APPLY
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Removed old modal - now using inline activity view */}
        {false && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log('Music modal back button clicked');
                      setShowMusicModal(false);
                      setSelectedActivity(null);
                      setSelectedMusicMode(null);
                    }}
                    className="relative z-10 p-2 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-all duration-200 hover:scale-110 cursor-pointer"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h2 className="text-xl font-semibold text-gray-900 capitalize">{selectedMusicMode}</h2>
                  <div className="w-6"></div>
                </div>
              </div>

              {/* Activity Section */}
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Activity</h3>
                
                {selectedMusicMode === 'focus' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedActivity('deep-work')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'deep-work' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">⚡</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Deep Work</h4>
                          <p className="text-sm text-gray-600 mt-1">Designed for demanding tasks that require sustained periods of intense focus.</p>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('motivation')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'motivation' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">⚡</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Motivation</h4>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('creativity')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'creativity' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">🎨</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Creativity</h4>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('learning')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'learning' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">📚</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Learning</h4>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('light-work')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'light-work' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">✨</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Light Work</h4>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {selectedMusicMode === 'relax' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedActivity('recharge')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'recharge' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">🔋</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Recharge</h4>
                          <p className="text-sm text-gray-600 mt-1">Designed for you to refocus, recenter, and gain more energy.</p>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('chill')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'chill' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">🛋️</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Chill</h4>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('unwind')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'unwind' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">🌅</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Unwind</h4>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('destress')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'destress' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">💆</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Destress</h4>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('travel')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'travel' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">✈️</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Travel</h4>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {selectedMusicMode === 'sleep' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedActivity('deep-sleep')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'deep-sleep' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">😴</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Deep Sleep</h4>
                          <p className="text-sm text-gray-600 mt-1">Music designed to promote healthy and prolonged rest.</p>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('power-nap')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'power-nap' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">⚡</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Power Nap</h4>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('guided-sleep')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'guided-sleep' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">🛏️</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Guided Sleep</h4>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('wind-down')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'wind-down' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">🌙</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Wind Down</h4>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('sleep-wake')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'sleep-wake' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">🌅</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Sleep And Wake</h4>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {selectedMusicMode === 'meditate' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedActivity('unguided')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'unguided' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">🧘</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Unguided</h4>
                          <p className="text-sm text-gray-600 mt-1">Reach deeper levels of meditation without guided narration.</p>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedActivity('guided')}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedActivity === 'guided' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-4">🎧</span>
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">Guided</h4>
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Timer Section */}
              <div className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Timer</h3>
                <button 
                  className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all"
                  onClick={() => {
                    // Timer dropdown functionality can be added here
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-2xl mr-4">∞</span>
                      <span className="font-semibold text-gray-900">Infinity</span>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* Start Button */}
              <div className="p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    if (selectedActivity) {
                      // Start the music with selected activity
                      if (window.focusPlayer) {
                        window.focusPlayer.playMode(selectedMusicMode);
                      }
                      setShowMusicModal(false);
                      setSelectedActivity(null);
                    }
                  }}
                  className={`w-full py-4 px-6 rounded-full font-semibold text-lg transition-all ${
                    selectedActivity 
                      ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={!selectedActivity}
                >
                  START LISTENING
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
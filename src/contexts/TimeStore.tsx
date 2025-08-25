import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

interface TimeSession {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in seconds
  category: 'Focus' | 'Meetings' | 'Breaks' | 'Other';
}

interface RunningSession {
  id: string;
  startTime: Date;
  elapsedSeconds: number;
  category: 'Focus' | 'Meetings' | 'Breaks' | 'Other';
  kind: 'focus' | 'shortBreak' | 'longBreak'; // Added for break tracking
}

interface PomodoroState {
  phase: 'work' | 'short' | 'long';
  isRunning: boolean;
  startedAt: number;
  elapsedMs: number;
  workCount: number;
  totalTimeMs: number;
}

interface TimeStoreState {
  isRunning: boolean;
  isPaused: boolean;
  runningSession: RunningSession | null;
  sessions: TimeSession[];
  lastTick: number;
  pomodoro: PomodoroState;
}

interface TimeStoreContextType extends TimeStoreState {
  startTimer: (kind?: 'focus' | 'shortBreak' | 'longBreak') => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  getTodayMinutes: () => number;
  getWeekMinutes: () => number[];
  getMonthMinutes: () => number[];
  getDayMinutesByCategory: () => { Focus: number; Meetings: number; Breaks: number; Other: number };
  getWeekMinutesByCategory: () => { Focus: number; Meetings: number; Breaks: number; Other: number };
  getMonthMinutesByCategory: () => { Focus: number; Meetings: number; Breaks: number; Other: number };
  // Pomodoro-specific methods
  startPomodoroTimer: () => void;
  pausePomodoroTimer: () => void;
  resetPomodoroTimer: () => void;
  skipPomodoroPhase: () => void;
}

const TimeStoreContext = createContext<TimeStoreContextType | undefined>(undefined);

const STORAGE_KEY = 'time-store-data';
const SESSION_STORAGE_KEY = 'time-store-running-session';
const POMODORO_STORAGE_KEY = 'time-store-pomodoro';

// Pomodoro constants
const POMODORO_DURATIONS = {
  work: 25 * 60 * 1000, // 25 minutes in milliseconds
  short: 5 * 60 * 1000, // 5 minutes in milliseconds
  long: 15 * 60 * 1000, // 15 minutes in milliseconds
  longEvery: 3 // Long break every 3 work sessions
};

// Global timer singleton - survives all component unmounts and browser tabs
class GlobalTimer {
  private static instance: GlobalTimer;
  private intervalId: number | null = null;
  private callbacks: Set<() => void> = new Set();
  private isActive = false;
  private lastHeartbeat = Date.now();
  private heartbeatKey = 'timer-heartbeat';

  static getInstance(): GlobalTimer {
    if (!GlobalTimer.instance) {
      GlobalTimer.instance = new GlobalTimer();
    }
    return GlobalTimer.instance;
  }

  start() {
    if (this.isActive) return;
    
    this.isActive = true;
    this.lastHeartbeat = Date.now();
    
    // Main timer tick
    this.intervalId = window.setInterval(() => {
      const now = Date.now();
      this.lastHeartbeat = now;
      localStorage.setItem(this.heartbeatKey, now.toString());
      this.callbacks.forEach(callback => callback());
    }, 1000); // 1Hz tick
    
    // Start heartbeat monitoring for cross-tab coordination
    this.startHeartbeatMonitor();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isActive = false;
    localStorage.removeItem(this.heartbeatKey);
  }

  private startHeartbeatMonitor() {
    // Check if another tab has taken over
    const checkHeartbeat = () => {
      if (!this.isActive) return;
      
      const storedHeartbeat = localStorage.getItem(this.heartbeatKey);
      if (storedHeartbeat) {
        const heartbeatTime = parseInt(storedHeartbeat);
        const timeDiff = Date.now() - heartbeatTime;
        
        // If another tab's heartbeat is more recent, stop this timer
        if (heartbeatTime > this.lastHeartbeat + 500) {
          console.log('Another tab took over timer control');
          if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
          }
          this.isActive = false;
          return;
        }
      }
      
      if (this.isActive) {
        setTimeout(checkHeartbeat, 2000);
      }
    };
    
    setTimeout(checkHeartbeat, 2000);
  }

  subscribe(callback: () => void) {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  isRunning() {
    return this.isActive;
  }

  forceStart() {
    // Force start even if another instance thinks it's running
    this.isActive = false;
    this.start();
  }
}

// Helper functions
const getStartOfDay = (date: Date = new Date()): Date => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getStartOfWeek = (date: Date = new Date()): Date => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getStartOfMonth = (date: Date = new Date()): Date => {
  const start = new Date(date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
};

const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.toDateString() === date2.toDateString();
};

const generateSessionId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const getNextPomodoroPhase = (currentPhase: 'work' | 'short' | 'long', workCount: number): 'work' | 'short' | 'long' => {
  if (currentPhase === 'work') {
    // After work, determine if it should be long or short break
    return (workCount + 1) % POMODORO_DURATIONS.longEvery === 0 ? 'long' : 'short';
  } else {
    // After any break, return to work
    return 'work';
  }
};

export const TimeStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [runningSession, setRunningSession] = useState<RunningSession | null>(null);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [lastTick, setLastTick] = useState(Date.now());
  const [pomodoro, setPomodoro] = useState<PomodoroState>({
    phase: 'work',
    isRunning: false,
    startedAt: 0,
    elapsedMs: 0,
    workCount: 0,
    totalTimeMs: POMODORO_DURATIONS.work
  });
  
  const globalTimer = useRef(GlobalTimer.getInstance());
  const lastSaveRef = useRef(Date.now());
  const mountedRef = useRef(true);
  const tabSyncRef = useRef(true);

  // Cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (!mountedRef.current || !tabSyncRef.current) return;
      
      if (e.key === POMODORO_STORAGE_KEY && e.newValue) {
        // Sync pomodoro state from another tab
        try {
          const pomodoroData = JSON.parse(e.newValue);
          setPomodoro(pomodoroData);
        } catch (error) {
          console.error('Failed to sync pomodoro from another tab:', error);
        }
      }
      
      if (e.key === SESSION_STORAGE_KEY) {
        // Another tab updated the running session
        if (e.newValue) {
          try {
            const sessionData = JSON.parse(e.newValue);
            if (sessionData.isRunning && sessionData.runningSession) {
              const restoredSession = {
                ...sessionData.runningSession,
                startTime: new Date(sessionData.runningSession.startTime)
              };
              
              if (isSameDay(restoredSession.startTime, new Date())) {
                const now = Date.now();
                const elapsedSinceStart = (now - restoredSession.startTime.getTime()) / 1000;
                
                setRunningSession({
                  ...restoredSession,
                  elapsedSeconds: elapsedSinceStart
                });
                setIsRunning(true);
                setIsPaused(false);
                
                // Only start timer if not already running
                if (!globalTimer.current.isRunning()) {
                  globalTimer.current.start();
                }
              }
            }
          } catch (error) {
            console.error('Failed to sync session from another tab:', error);
          }
        } else {
          // Session was cleared in another tab
          setRunningSession(null);
          setIsRunning(false);
          setIsPaused(false);
          globalTimer.current.stop();
        }
      }
      
      if (e.key === STORAGE_KEY && e.newValue) {
        // Sync historical sessions
        try {
          const data = JSON.parse(e.newValue);
          if (data.sessions) {
            setSessions(data.sessions.map((s: any) => ({
              ...s,
              startTime: new Date(s.startTime),
              endTime: new Date(s.endTime)
            })));
          }
        } catch (error) {
          console.error('Failed to sync historical data:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initialize and restore state on mount
  useEffect(() => {
    mountedRef.current = true;
    tabSyncRef.current = true;
    
    // Load historical data
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.sessions) {
          setSessions(data.sessions.map((s: any) => ({
            ...s,
            startTime: new Date(s.startTime),
            endTime: new Date(s.endTime)
          })));
        }
      } catch (error) {
        console.error('Failed to load historical time store data:', error);
      }
    }

    // Load and restore pomodoro state
    const pomodoroData = localStorage.getItem(POMODORO_STORAGE_KEY);
    if (pomodoroData) {
      try {
        const savedPomodoro = JSON.parse(pomodoroData);
        if (savedPomodoro.isRunning) {
          // When restoring a running timer, we need to calculate how much time has passed
          const now = Date.now();
          const additionalElapsed = now - savedPomodoro.startedAt;
          const totalElapsed = savedPomodoro.elapsedMs + additionalElapsed;
          
          setPomodoro({
            ...savedPomodoro,
            startedAt: now, // Reset startedAt to current time
            elapsedMs: totalElapsed // Update elapsed with the additional time
          });
        } else {
          setPomodoro(savedPomodoro);
        }
      } catch (error) {
        console.error('Failed to restore pomodoro state:', error);
        localStorage.removeItem(POMODORO_STORAGE_KEY);
      }
    }
    
    // Load and restore running session
    const runningData = localStorage.getItem(SESSION_STORAGE_KEY);
    if (runningData) {
      try {
        const sessionData = JSON.parse(runningData);
        if (sessionData.isRunning && sessionData.runningSession) {
          const restoredSession = {
            ...sessionData.runningSession,
            startTime: new Date(sessionData.runningSession.startTime)
          };
          
          // Check if it's the same day
          if (isSameDay(restoredSession.startTime, new Date())) {
            // Calculate elapsed time since last save
            const now = Date.now();
            const elapsedSinceStart = (now - restoredSession.startTime.getTime()) / 1000;
            
            setRunningSession({
              ...restoredSession,
              elapsedSeconds: elapsedSinceStart
            });
            setIsRunning(true);
            setIsPaused(false);
            
            // Force start global timer (handles cross-tab coordination)
            globalTimer.current.forceStart();
            console.log('Timer restored and restarted:', { elapsedSinceStart: Math.floor(elapsedSinceStart / 60), minutes: 'min' });
          } else {
            // Different day, clear running session
            localStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('Failed to restore running session:', error);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }

    return () => {
      mountedRef.current = false;
      tabSyncRef.current = false;
    };
  }, []);

  // Global timer tick handler
  const handleTick = React.useCallback(() => {
    if (!mountedRef.current) return;
    
    const now = Date.now();
    setLastTick(now);

    // Update pomodoro timer - DON'T update elapsedMs here, just check for completion
    if (pomodoro.isRunning && pomodoro.startedAt > 0) {
      const currentElapsed = pomodoro.elapsedMs + (now - pomodoro.startedAt);
      
      if (currentElapsed >= pomodoro.totalTimeMs) {
        // Phase completed - handle phase transition
        const nextPhase = getNextPomodoroPhase(pomodoro.phase, pomodoro.workCount);
        const newWorkCount = pomodoro.phase === 'work' ? pomodoro.workCount + 1 : 
                           (pomodoro.phase === 'long' ? 0 : pomodoro.workCount);
        
        setPomodoro(prev => ({
          ...prev,
          phase: nextPhase,
          isRunning: false,
          startedAt: 0,
          elapsedMs: 0,
          workCount: newWorkCount,
          totalTimeMs: POMODORO_DURATIONS[nextPhase]
        }));
        
        // Trigger completion notification (could add sound/notification here)
        console.log(`Pomodoro phase completed: ${pomodoro.phase} -> ${nextPhase}`);
      }
      // Remove the else block that was updating elapsedMs on every tick
    }

    if (isRunning && runningSession) {
      setRunningSession(prev => {
        if (!prev) return null;
        
        // Calculate real elapsed time from start
        const realElapsed = (now - prev.startTime.getTime()) / 1000;
        return {
          ...prev,
          elapsedSeconds: realElapsed
        };
      });

      // Handle midnight boundary
      handleMidnightBoundary(now);
    }

    // Throttled save to localStorage
    if (now - lastSaveRef.current > 2000) { // Save every 2 seconds
      saveToStorage();
      lastSaveRef.current = now;
    }
  }, [isRunning, runningSession, pomodoro]);

  // Subscribe to global timer
  useEffect(() => {
    const unsubscribe = globalTimer.current.subscribe(handleTick);
    return unsubscribe;
  }, [handleTick]);

  // Save state to localStorage with throttling to prevent excessive writes
  const saveToStorage = React.useCallback(() => {
    if (!mountedRef.current) return;
    
    // Temporarily disable cross-tab sync to prevent feedback loops
    tabSyncRef.current = false;
    
    try {
      // Save historical sessions
      const historicalData = {
        sessions: sessions.map(s => ({
          ...s,
          startTime: s.startTime.toISOString(),
          endTime: s.endTime.toISOString()
        })),
        lastUpdated: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(historicalData));

      // Save running session separately for faster access
      if (isRunning && runningSession) {
        const sessionData = {
          isRunning,
          isPaused,
          runningSession: {
            ...runningSession,
            startTime: runningSession.startTime.toISOString()
          },
          lastSaved: Date.now()
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }

      // Save pomodoro state
      localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(pomodoro));
    } catch (error) {
      console.error('Failed to save timer state:', error);
    }
    
    // Re-enable cross-tab sync after a short delay
    setTimeout(() => {
      if (mountedRef.current) {
        tabSyncRef.current = true;
      }
    }, 100);
  }, [isRunning, isPaused, runningSession, sessions, pomodoro]);

  // Handle midnight boundary - split running session
  const handleMidnightBoundary = React.useCallback((now: number) => {
    if (!runningSession || !isRunning) return;

    const currentDate = new Date(now);
    const sessionStart = runningSession.startTime;
    
    // If session started yesterday and we're past midnight
    if (!isSameDay(sessionStart, currentDate)) {
      const midnight = getStartOfDay(currentDate);
      
      // Complete the session up to midnight
      const yesterdayDuration = (midnight.getTime() - sessionStart.getTime()) / 1000;
      const completedSession: TimeSession = {
        id: runningSession.id,
        startTime: sessionStart,
        endTime: midnight,
        duration: yesterdayDuration,
        category: runningSession.category
      };
      
      setSessions(prev => [...prev, completedSession]);
      
      // Start a new session from midnight
      const newSession: RunningSession = {
        id: generateSessionId(),
        startTime: midnight,
        elapsedSeconds: 0,
        category: runningSession.category,
        kind: runningSession.kind
      };
      
      setRunningSession(newSession);
    }
  }, [runningSession, isRunning]);

  const startTimer = React.useCallback((kind: 'focus' | 'shortBreak' | 'longBreak' = 'focus') => {
    if (!isRunning) {
      const newSession: RunningSession = {
        id: generateSessionId(),
        startTime: new Date(),
        elapsedSeconds: 0,
        category: kind === 'focus' ? 'Focus' : 'Breaks',
        kind
      };
      
      setRunningSession(newSession);
      setIsRunning(true);
      setIsPaused(false);
      
      // Start global timer with cross-tab coordination
      globalTimer.current.forceStart();
      console.log('Timer started:', kind);
    }
  }, [isRunning]);

  const pauseTimer = React.useCallback(() => {
    if (isRunning && runningSession) {
      // Complete current session
      const completedSession: TimeSession = {
        id: runningSession.id,
        startTime: runningSession.startTime,
        endTime: new Date(),
        duration: runningSession.elapsedSeconds,
        category: runningSession.category
      };
      
      setSessions(prev => [...prev, completedSession]);
      setRunningSession(null);
      setIsRunning(false);
      setIsPaused(true);
      
      // Stop global timer
      globalTimer.current.stop();
      console.log('Timer paused');
    } else if (isPaused) {
      // Resume
      startTimer();
    }
  }, [isRunning, runningSession, isPaused, startTimer]);

  const resetTimer = React.useCallback(() => {
    if (isRunning && runningSession) {
      // Complete current session
      const completedSession: TimeSession = {
        id: runningSession.id,
        startTime: runningSession.startTime,
        endTime: new Date(),
        duration: runningSession.elapsedSeconds,
        category: runningSession.category
      };
      
      setSessions(prev => [...prev, completedSession]);
    }
    
    setRunningSession(null);
    setIsRunning(false);
    setIsPaused(false);
    
    // Stop global timer
    globalTimer.current.stop();
    console.log('Timer reset');
  }, [isRunning, runningSession]);

  // Get today's total minutes
  const getTodayMinutes = React.useCallback((): number => {
    const today = new Date();
    const todaySessions = sessions.filter(s => isSameDay(s.startTime, today));
    const sessionsTotal = todaySessions.reduce((sum, s) => sum + s.duration, 0);
    const runningTotal = runningSession && isSameDay(runningSession.startTime, today) 
      ? runningSession.elapsedSeconds 
      : 0;
    
    return Math.floor((sessionsTotal + runningTotal) / 60);
  }, [sessions, runningSession]);

  // Get week's minutes by day (Mon-Sun)
  const getWeekMinutes = React.useCallback((): number[] => {
    const weekStart = getStartOfWeek();
    const result = new Array(7).fill(0);
    
    // Add completed sessions
    sessions.forEach(session => {
      const dayIndex = Math.floor((session.startTime.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
      if (dayIndex >= 0 && dayIndex < 7) {
        result[dayIndex] += session.duration / 60;
      }
    });
    
    // Add running session
    if (runningSession) {
      const dayIndex = Math.floor((runningSession.startTime.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
      if (dayIndex >= 0 && dayIndex < 7) {
        result[dayIndex] += runningSession.elapsedSeconds / 60;
      }
    }
    
    return result.map(m => Math.floor(m));
  }, [sessions, runningSession]);

  // Get month's minutes by day
  const getMonthMinutes = React.useCallback((): number[] => {
    const monthStart = getStartOfMonth();
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const result = new Array(daysInMonth).fill(0);
    
    // Add completed sessions
    sessions.forEach(session => {
      const dayIndex = session.startTime.getDate() - 1;
      if (session.startTime >= monthStart && dayIndex >= 0 && dayIndex < daysInMonth) {
        result[dayIndex] += session.duration / 60;
      }
    });
    
    // Add running session
    if (runningSession && runningSession.startTime >= monthStart) {
      const dayIndex = runningSession.startTime.getDate() - 1;
      if (dayIndex >= 0 && dayIndex < daysInMonth) {
        result[dayIndex] += runningSession.elapsedSeconds / 60;
      }
    }
    
    return result.map(m => Math.floor(m));
  }, [sessions, runningSession]);

  // Get category breakdowns
  const getDayMinutesByCategory = React.useCallback(() => {
    const today = new Date();
    const result = { Focus: 0, Meetings: 0, Breaks: 0, Other: 0 };
    
    // Add completed sessions
    sessions
      .filter(s => isSameDay(s.startTime, today))
      .forEach(s => {
        result[s.category] += s.duration / 60;
      });
    
    // Add running session
    if (runningSession && isSameDay(runningSession.startTime, today)) {
      result[runningSession.category] += runningSession.elapsedSeconds / 60;
    }
    
    return {
      Focus: Math.floor(result.Focus),
      Meetings: Math.floor(result.Meetings),
      Breaks: Math.floor(result.Breaks),
      Other: Math.floor(result.Other)
    };
  }, [sessions, runningSession]);

  const getWeekMinutesByCategory = React.useCallback(() => {
    const weekStart = getStartOfWeek();
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const result = { Focus: 0, Meetings: 0, Breaks: 0, Other: 0 };
    
    // Add completed sessions
    sessions
      .filter(s => s.startTime >= weekStart && s.startTime < weekEnd)
      .forEach(s => {
        result[s.category] += s.duration / 60;
      });
    
    // Add running session
    if (runningSession && runningSession.startTime >= weekStart && runningSession.startTime < weekEnd) {
      result[runningSession.category] += runningSession.elapsedSeconds / 60;
    }
    
    return {
      Focus: Math.floor(result.Focus),
      Meetings: Math.floor(result.Meetings),
      Breaks: Math.floor(result.Breaks),
      Other: Math.floor(result.Other)
    };
  }, [sessions, runningSession]);

  const getMonthMinutesByCategory = React.useCallback(() => {
    const monthStart = getStartOfMonth();
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
    const result = { Focus: 0, Meetings: 0, Breaks: 0, Other: 0 };
    
    // Add completed sessions
    sessions
      .filter(s => s.startTime >= monthStart && s.startTime <= monthEnd)
      .forEach(s => {
        result[s.category] += s.duration / 60;
      });
    
    // Add running session
    if (runningSession && runningSession.startTime >= monthStart && runningSession.startTime <= monthEnd) {
      result[runningSession.category] += runningSession.elapsedSeconds / 60;
    }
    
    return {
      Focus: Math.floor(result.Focus),
      Meetings: Math.floor(result.Meetings),
      Breaks: Math.floor(result.Breaks),
      Other: Math.floor(result.Other)
    };
  }, [sessions, runningSession]);

  // Pomodoro timer methods
  const startPomodoroTimer = React.useCallback(() => {
    const now = Date.now();
    setPomodoro(prev => ({
      ...prev,
      isRunning: true,
      startedAt: now
    }));
    
    // Start the global timer if not already running
    if (!globalTimer.current.isRunning()) {
      globalTimer.current.start();
    }
    
    // Start time tracking based on phase
    const kind = pomodoro.phase === 'work' ? 'focus' : 
                pomodoro.phase === 'short' ? 'shortBreak' : 'longBreak';
    startTimer(kind);
  }, [pomodoro.phase, startTimer]);

  const pausePomodoroTimer = React.useCallback(() => {
    setPomodoro(prev => {
      if (prev.isRunning && prev.startedAt > 0) {
        const now = Date.now();
        const additionalElapsed = now - prev.startedAt;
        return {
          ...prev,
          isRunning: false,
          elapsedMs: prev.elapsedMs + additionalElapsed,
          startedAt: 0
        };
      }
      return prev;
    });
    
    // Pause time tracking
    pauseTimer();
  }, [pauseTimer]);

  const resetPomodoroTimer = React.useCallback(() => {
    setPomodoro({
      phase: 'work',
      isRunning: false,
      startedAt: 0,
      elapsedMs: 0,
      workCount: 0,
      totalTimeMs: POMODORO_DURATIONS.work
    });
    
    // Reset time tracking
    resetTimer();
  }, [resetTimer]);

  const skipPomodoroPhase = React.useCallback(() => {
    const nextPhase = getNextPomodoroPhase(pomodoro.phase, pomodoro.workCount);
    const newWorkCount = pomodoro.phase === 'work' ? pomodoro.workCount + 1 : 
                       (pomodoro.phase === 'long' ? 0 : pomodoro.workCount);
    
    setPomodoro({
      phase: nextPhase,
      isRunning: false,
      startedAt: 0,
      elapsedMs: 0,
      workCount: newWorkCount,
      totalTimeMs: POMODORO_DURATIONS[nextPhase]
    });
    
    // Stop current time tracking
    pauseTimer();
  }, [pomodoro.phase, pomodoro.workCount, pauseTimer]);

  const value: TimeStoreContextType = {
    isRunning,
    isPaused,
    runningSession,
    sessions,
    lastTick,
    pomodoro,
    startTimer,
    pauseTimer,
    resetTimer,
    getTodayMinutes,
    getWeekMinutes,
    getMonthMinutes,
    getDayMinutesByCategory,
    getWeekMinutesByCategory,
    getMonthMinutesByCategory,
    startPomodoroTimer,
    pausePomodoroTimer,
    resetPomodoroTimer,
    skipPomodoroPhase
  };

  return (
    <TimeStoreContext.Provider value={value}>
      {children}
    </TimeStoreContext.Provider>
  );
};

export const useTimeStore = () => {
  const context = useContext(TimeStoreContext);
  if (context === undefined) {
    throw new Error('useTimeStore must be used within a TimeStoreProvider');
  }
  return context;
};
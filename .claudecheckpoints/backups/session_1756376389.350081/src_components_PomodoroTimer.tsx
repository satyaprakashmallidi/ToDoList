import React, { useEffect, useRef, useCallback } from 'react';
import { useTimeStore } from '../contexts/TimeStore';

interface PomodoroTimerProps {
  size?: number;
  onPhaseChange?: (phase: 'work' | 'short' | 'long') => void;
}

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ size = 256, onPhaseChange }) => {
  const { 
    pomodoro, 
    startPomodoroTimer, 
    pausePomodoroTimer,
    lastTick
  } = useTimeStore();
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const prevPhaseRef = useRef(pomodoro.phase);

  // Handle phase changes and call onPhaseChange callback
  useEffect(() => {
    if (prevPhaseRef.current !== pomodoro.phase) {
      onPhaseChange?.(pomodoro.phase);
      prevPhaseRef.current = pomodoro.phase;
      
      // Play beep on phase change (completion)
      if (!pomodoro.isRunning) {
        playBeep();
      }
    }
  }, [pomodoro.phase, pomodoro.isRunning, onPhaseChange]);

  // Calculate remaining time based on global state
  // Use lastTick to ensure we recalculate on every timer tick
  const getRemainingTime = useCallback(() => {
    if (pomodoro.isRunning && pomodoro.startedAt > 0) {
      const now = Date.now();
      const currentElapsed = pomodoro.elapsedMs + (now - pomodoro.startedAt);
      const remaining = Math.max(0, pomodoro.totalTimeMs - currentElapsed);
      return remaining;
    } else {
      const remaining = pomodoro.totalTimeMs - pomodoro.elapsedMs;
      return Math.max(0, remaining);
    }
  }, [pomodoro, lastTick]);


  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const playBeep = () => {
    try {
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContext) {
          audioContextRef.current = new AudioContext();
        }
      }

      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      if (audioContextRef.current) {
        const oscillator = audioContextRef.current.createOscillator();
        const gainNode = audioContextRef.current.createGain();
        
        oscillator.frequency.setValueAtTime(880, audioContextRef.current.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.001, audioContextRef.current.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.25, audioContextRef.current.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.65);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        
        oscillator.start(audioContextRef.current.currentTime);
        oscillator.stop(audioContextRef.current.currentTime + 0.7);
      }
    } catch {
      console.log('Audio not available');
    }
  };


  const toggleTimer = () => {
    if (pomodoro.isRunning) {
      pausePomodoroTimer();
    } else {
      startPomodoroTimer();
    }
  };


  // Calculate progress for the ring based on current elapsed time
  const timeLeft = getRemainingTime();
  const currentElapsed = pomodoro.totalTimeMs - timeLeft;
  const progress = Math.min(1, currentElapsed / pomodoro.totalTimeMs);
  const radius = 82;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const getPhaseColor = () => {
    switch (pomodoro.phase) {
      case 'work': return '#2563eb';
      case 'short': return '#10b981';
      case 'long': return '#f59e0b';
      default: return '#2563eb';
    }
  };


  return (
    <div className="flex flex-col items-center gap-4">
      <div 
        className="relative"
        style={{ 
          width: size, 
          height: size,
          filter: 'drop-shadow(0 8px 24px rgba(0,0,0,.06))'
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 200 200">
          {/* Background track */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="18"
          />
          {/* Progress ring */}
          <g transform="rotate(-90 100 100)">
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={getPhaseColor()}
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </g>
        </svg>
        
        {/* Timer display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div 
              className="font-bold tracking-wider text-gray-800"
              style={{ fontSize: 'clamp(32px, 7vmin, 42px)' }}
            >
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Control button with animations */}
      <button
        onClick={toggleTimer}
        className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md active:scale-95"
        aria-label={pomodoro.isRunning ? "Pause" : "Start"}
      >
        <div className="transition-all duration-300 ease-in-out">
          {pomodoro.isRunning ? (
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              className="text-blue-600 animate-scale-in"
            >
              <path d="M7 5h4v14H7zM13 5h4v14h-4z"/>
            </svg>
          ) : (
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              className="text-blue-600 animate-scale-in"
            >
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </div>
      </button>
    </div>
  );
};

export default PomodoroTimer;
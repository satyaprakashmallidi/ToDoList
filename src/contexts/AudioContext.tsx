import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { useAudioFiles } from '../hooks/useAudioFiles';

// Audio file interface based on the database structure
interface AudioFile {
  id: string;
  url: string;
  category: string;
  subcategory: string;
  title?: string;
  artist?: string;
  duration?: number;
  created_at?: string;
}

// Current track info interface
interface CurrentTrack {
  title: string;
  artist: string;
  genre: string;
}

// Audio context interface
interface AudioContextType {
  // Audio element and playback state
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  currentTrack: CurrentTrack | null;
  volume: number;
  currentSongIndex: number;
  audioFiles: AudioFile[];
  audioLoading: boolean;
  
  // Session timer state
  sessionTime: number;
  sessionStartTime: number | null;
  isSessionActive: boolean;
  
  // Music player settings
  selectedMusicMode: 'focus' | 'relax' | 'sleep' | 'meditate' | null;
  selectedSubcategory: string | null;
  showMusicPlayer: boolean;
  
  // Audio control functions
  playAudio: () => void;
  pauseAudio: () => void;
  stopAudio: () => void;
  nextSong: () => void;
  previousSong: () => void;
  setVolume: (volume: number) => void;
  
  // Session control functions
  startSession: () => void;
  stopSession: () => void;
  
  // Settings control functions
  setSelectedMusicMode: (mode: 'focus' | 'relax' | 'sleep' | 'meditate' | null) => void;
  setSelectedSubcategory: (subcategory: string | null) => void;
  setShowMusicPlayer: (show: boolean) => void;
  setCurrentSongIndex: (index: number) => void;
  
  // Recent sessions and tracks functions
  addRecentSession: (mode: string, activity: string) => void;
  addRecentTrack: (song: any, mode: string) => void;
  updateSessionDuration: (sessionId: string, duration: number) => void;
  
  // Recent sessions and tracks data
  recentSessions: any[];
  recentTracks: any[];
}

// Create the context
const AudioContext = createContext<AudioContextType | undefined>(undefined);

// Audio context provider component
export const AudioContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [volume, setVolumeState] = useState(70);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  
  // Session timer state
  const [sessionTime, setSessionTime] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  
  // Music player settings
  const [selectedMusicMode, setSelectedMusicMode] = useState<'focus' | 'relax' | 'sleep' | 'meditate' | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  
  // Recent sessions and tracks state
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [recentTracks, setRecentTracks] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // Audio element ref
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Get audio files based on selected music mode and subcategory
  const { audioFiles, loading: audioLoading } = useAudioFiles(
    selectedMusicMode || undefined,
    selectedSubcategory || undefined
  );
  
  // Play audio function
  const playAudio = () => {
    if (audioRef.current && audioFiles && audioFiles.length > 0) {
      // Stop any currently playing audio
      if (!audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      const currentSong = audioFiles[currentSongIndex] || audioFiles[0];
      if (audioRef.current.src !== currentSong.url) {
        audioRef.current.src = currentSong.url;
        audioRef.current.load(); // Ensure the new source is loaded
      }
      
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
      });
      
      setIsPlaying(true);
      
      // Update current track info
      const trackInfo = {
        title: currentSong.subcategory || 'Unknown Track',
        artist: currentSong.category || 'Unknown Artist',
        genre: currentSong.category || 'Unknown Genre'
      };
      
      setCurrentTrack(trackInfo);
      
      // Add to recent tracks when a song starts playing
      if (selectedMusicMode) {
        addRecentTrack(trackInfo, selectedMusicMode);
      }
    }
  };
  
  // Pause audio function
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };
  
  // Stop audio function
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };
  
  // Next song function
  const nextSong = () => {
    if (!audioFiles || audioFiles.length === 0) return;
    setCurrentSongIndex((prevIndex) => (prevIndex + 1) % audioFiles.length);
    
    // If currently playing, play the next song
    if (isPlaying) {
      setTimeout(() => playAudio(), 100);
    }
  };
  
  // Previous song function
  const previousSong = () => {
    if (!audioFiles || audioFiles.length === 0) return;
    setCurrentSongIndex((prevIndex) => (prevIndex - 1 + audioFiles.length) % audioFiles.length);
    
    // If currently playing, play the previous song
    if (isPlaying) {
      setTimeout(() => playAudio(), 100);
    }
  };
  
  // Set volume function
  const setVolume = (newVolume: number) => {
    setVolumeState(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  };
  
  // Start session function
  const startSession = () => {
    setSessionStartTime(Date.now());
    setIsSessionActive(true);
    setSessionTime(0);
  };
  
  // Stop session function
  const stopSession = () => {
    // Update final duration before stopping
    if (currentSessionId && sessionTime > 0) {
      updateSessionDuration(currentSessionId, sessionTime);
    }
    
    setIsSessionActive(false);
    setSessionStartTime(null);
    setSessionTime(0);
    setCurrentSessionId(null); // Clear current session
  };
  
  // Sync volume with HTML audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);
  
  // Session timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isSessionActive) {
      interval = setInterval(() => {
        if (sessionStartTime) {
          const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
          setSessionTime(elapsed);
        }
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSessionActive, sessionStartTime]);
  
  // Auto-start/stop session based on music player visibility
  useEffect(() => {
    if (showMusicPlayer && !isSessionActive && selectedMusicMode) {
      startSession();
      // Create recent session entry
      const sessionName = selectedMusicMode.charAt(0).toUpperCase() + selectedMusicMode.slice(1) + ' Session';
      addRecentSession(selectedMusicMode, sessionName);
    } else if (!showMusicPlayer && isSessionActive) {
      stopSession();
    }
  }, [showMusicPlayer, isSessionActive, selectedMusicMode]);
  
  // Auto-play when audio files change and was previously playing
  useEffect(() => {
    // Only auto-play if we were already playing and no specific subcategory selection is happening
    if (isPlaying && audioFiles && audioFiles.length > 0 && !selectedSubcategory) {
      setTimeout(() => playAudio(), 100);
    }
  }, [audioFiles]);
  
  // Auto-play when subcategory changes (new music selection)
  useEffect(() => {
    if (selectedSubcategory && selectedMusicMode && audioFiles && audioFiles.length > 0) {
      console.log('Subcategory changed to:', selectedSubcategory, 'Available songs:', audioFiles.length);
      setCurrentSongIndex(0); // Reset to first song
      
      // Ensure we have the right audio files for this subcategory before playing
      const correctSongs = audioFiles.filter(file => 
        file.category === selectedMusicMode && file.subcategory === selectedSubcategory
      );
      
      if (correctSongs.length > 0) {
        setTimeout(() => {
          console.log('Playing subcategory:', selectedSubcategory, 'from', correctSongs.length, 'songs');
          playAudio();
        }, 100);
      }
    }
  }, [selectedSubcategory, audioFiles, selectedMusicMode]);

  // Reset current track when music mode changes
  useEffect(() => {
    if (selectedMusicMode && !selectedSubcategory) {
      // Clear current track when switching modes but no subcategory selected yet
      setCurrentTrack(null);
    }
  }, [selectedMusicMode, selectedSubcategory]);
  
  // Update current session duration based on session timer
  useEffect(() => {
    if (currentSessionId && sessionTime > 0) {
      updateSessionDuration(currentSessionId, sessionTime);
    }
  }, [sessionTime, currentSessionId]);
  
  // Handle audio ended event
  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement) {
      const handleEnded = () => {
        nextSong();
      };
      
      audioElement.addEventListener('ended', handleEnded);
      return () => {
        audioElement.removeEventListener('ended', handleEnded);
      };
    }
  }, [audioFiles, currentSongIndex]);
  
  // Recent sessions and tracks management functions
  const addRecentSession = (mode: string, activity: string) => {
    const colors = ['bg-red-500', 'bg-pink-500', 'bg-blue-500', 'bg-purple-500', 'bg-green-500'];
    const now = new Date();
    const sessionId = Date.now().toString(); // Simple ID generation
    const newSession = {
      id: sessionId,
      mode: 'Infinity',
      activity,
      color: colors[Math.floor(Math.random() * colors.length)],
      startTime: now,
      timestamp: now,
      duration: 0 // Will be updated when session ends
    };
    
    setRecentSessions(prev => [newSession, ...prev.slice(0, 5)]); // Keep only 6 most recent
    setCurrentSessionId(sessionId); // Track the current session
    return sessionId;
  };
  
  const addRecentTrack = (song: any, mode: string) => {
    const newTrack = {
      title: song.title,
      artist: song.artist,
      genre: song.genre,
      mode: mode.charAt(0).toUpperCase() + mode.slice(1),
      timestamp: new Date()
    };
    
    setRecentTracks(prev => {
      // Remove if already exists to avoid duplicates
      const filtered = prev.filter(track => track.title !== song.title);
      return [newTrack, ...filtered.slice(0, 3)]; // Keep only 4 most recent
    });
  };
  
  const updateSessionDuration = (sessionId: string, duration: number) => {
    setRecentSessions(prev => 
      prev.map(session => 
        session.id === sessionId 
          ? { ...session, duration: Math.floor(duration / 60) } // Convert to minutes
          : session
      )
    );
  };
  
  const contextValue: AudioContextType = {
    // Audio element and playback state
    audioRef,
    isPlaying,
    currentTrack,
    volume,
    currentSongIndex,
    audioFiles,
    audioLoading,
    
    // Session timer state
    sessionTime,
    sessionStartTime,
    isSessionActive,
    
    // Music player settings
    selectedMusicMode,
    selectedSubcategory,
    showMusicPlayer,
    
    // Audio control functions
    playAudio,
    pauseAudio,
    stopAudio,
    nextSong,
    previousSong,
    setVolume,
    
    // Session control functions
    startSession,
    stopSession,
    
    // Settings control functions
    setSelectedMusicMode,
    setSelectedSubcategory,
    setShowMusicPlayer,
    setCurrentSongIndex,
    
    // Recent sessions and tracks functions
    addRecentSession,
    addRecentTrack,
    updateSessionDuration,
    
    // Recent sessions and tracks data
    recentSessions,
    recentTracks,
  };
  
  return (
    <AudioContext.Provider value={contextValue}>
      {children}
      {/* Global audio element that persists across page navigation */}
      <audio ref={audioRef} preload="metadata" />
    </AudioContext.Provider>
  );
};

// Custom hook to use the audio context
export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioContextProvider');
  }
  return context;
};

export default AudioContext;
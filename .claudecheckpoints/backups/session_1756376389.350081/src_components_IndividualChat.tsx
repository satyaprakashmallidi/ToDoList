import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  CheckSquare,
  Video,
  Phone,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Settings,
  Search,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'idle' | 'dnd';
  lastSeen?: string;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  type: 'text' | 'system';
}

interface CalendarSlot {
  time: string;
  hour: number;
  available: boolean;
  isCurrentHour?: boolean;
  event?: {
    title: string;
    duration: number;
  };
}

interface Task {
  id: string;
  title: string;
  description?: string;
  assignedBy: string;
  assignedTo: string;
  dueDate?: Date;
  status: 'pending' | 'completed';
  createdAt: Date;
}

interface IndividualChatProps {
  member: TeamMember;
  onBack: () => void;
}

export const IndividualChat: React.FC<IndividualChatProps> = ({ member, onBack }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'calendar' | 'tasks'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection>();
  const localStreamRef = useRef<MediaStream>();

  // Initialize conversation
  useEffect(() => {
    const sampleMessages: Message[] = [];
    setMessages(sampleMessages);
  }, [member.id, user?.id]);

  // Generate calendar slots for the current day
  const generateCalendarSlots = (): CalendarSlot[] => {
    const slots: CalendarSlot[] = [];
    const currentHour = new Date().getHours();
    
    for (let hour = 0; hour < 24; hour++) {
      const time = hour === 0 ? '12am' : 
                   hour < 12 ? `${hour}am` : 
                   hour === 12 ? '12pm' : 
                   `${hour - 12}pm`;
      
      slots.push({
        time,
        hour,
        available: hour > currentHour,
        isCurrentHour: hour === currentHour,
        event: hour === 14 ? { title: 'Team Meeting', duration: 2 } : undefined
      });
    }
    
    return slots;
  };

  const calendarSlots = generateCalendarSlots();

  // Handle sending messages
  const handleSendMessage = () => {
    if (messageInput.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        content: messageInput.trim(),
        senderId: user?.id || 'current',
        senderName: 'You',
        timestamp: new Date(),
        type: 'text'
      };
      
      setMessages(prev => [...prev, newMessage]);
      setMessageInput('');
    }
  };

  // Handle video call functionality
  const startVideoCall = async () => {
    try {
      setShowVideoCall(true);
      setIsCallActive(true);
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Initialize WebRTC peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      peerConnectionRef.current = peerConnection;
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
      
    } catch (error) {
      console.error('Error starting video call:', error);
      alert('Error accessing camera/microphone. Please check permissions.');
    }
  };

  const endVideoCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    setShowVideoCall(false);
    setIsCallActive(false);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  // Handle task creation
  const handleCreateTask = () => {
    if (newTaskTitle.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        title: newTaskTitle.trim(),
        assignedBy: user?.id || 'current',
        assignedTo: member.id,
        status: 'pending',
        createdAt: new Date()
      };
      
      setTasks(prev => [...prev, newTask]);
      setNewTaskTitle('');
      setShowNewTaskForm(false);
    }
  };

  const toggleTaskStatus = (taskId: string) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, status: task.status === 'pending' ? 'completed' : 'pending' }
          : task
      )
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {getInitials(member.name)}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                  member.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{member.name}</h2>
                <p className="text-sm text-gray-500">
                  {member.status === 'online' 
                    ? 'Active now' 
                    : member.lastSeen || '6 days ago'
                  }
                </p>
              </div>
            </div>
            
            <div className="ml-auto flex items-center space-x-1">
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Search className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Phone className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <User className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="px-6">
          <div className="flex space-x-8">
            {[
              { key: 'chat', label: 'Chat' },
              { key: 'calendar', label: 'Calendar' },
              { key: 'tasks', label: `${member.name.split(' ')[0]}'s Assigned Tasks` }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'text-gray-900 border-gray-900'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Video Call Modal */}
      {showVideoCall && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <div className="relative w-full h-full">
            {/* Remote Video */}
            <video
              ref={remoteVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
            />
            
            {/* Local Video */}
            <div className="absolute top-4 right-4 w-48 h-32 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
              <video
                ref={localVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
            </div>
            
            {/* Call Controls */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-4">
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-colors ${
                  isMuted ? 'bg-red-500 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full transition-colors ${
                  !isVideoOn ? 'bg-red-500 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'
                }`}
              >
                {!isVideoOn ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>
              
              <button
                onClick={endVideoCall}
                className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
            
            {/* Call Info */}
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-center">
              <p className="text-white text-lg font-medium">Video call with {member.name}</p>
              <p className="text-gray-300 text-sm">
                {isCallActive ? 'Connected' : 'Connecting...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
              <div className="text-center max-w-md">
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                  Chat with {member.name}
                </h3>
                <p className="text-gray-600 mb-8">
                  This conversation started on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
                </p>
                
                {/* Action Cards */}
                <div className="space-y-4 w-full">
                  <button
                    className="w-full p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center space-x-4 text-left"
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">View Profile</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('calendar')}
                    className="w-full p-4 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors flex items-center space-x-4 text-left"
                  >
                    <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                      <CalendarIcon className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">View Calendar</p>
                      <p className="text-sm text-gray-600">Find time to meet or just grab some coffee</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={startVideoCall}
                    className="w-full p-4 bg-green-50 border border-green-100 rounded-xl hover:bg-green-100 transition-colors flex items-center space-x-4 text-left"
                  >
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <Video className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Start SyncUp</p>
                      <p className="text-sm text-gray-600">Jump on a voice call or video call</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Message Area for sent messages */}
            {messages.length > 0 && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.senderId === (user?.id || 'current') ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.senderId === (user?.id || 'current')
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p>{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.senderId === (user?.id || 'current')
                          ? 'text-blue-100'
                          : 'text-gray-500'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
            
            {/* Time Display */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center mr-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                It's {formatTime(new Date())} for {member.name.split(' ')[0]}.
              </div>
            </div>
            
            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-start space-x-3">
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
                
                <div className="flex-1">
                  <div className="border border-gray-300 rounded-2xl">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder={`Write to ${member.name.split(' ')[0]}, press 'space' for AI, '/' for commands`}
                      className="w-full px-4 py-3 bg-transparent focus:outline-none placeholder-gray-500 rounded-2xl"
                    />
                    
                    <div className="flex items-center justify-between px-4 pb-3">
                      <div className="flex items-center space-x-2">
                        <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                          <span className="text-lg">🎯</span>
                        </button>
                        <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                          <Smile className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                          <span className="text-sm">💬</span>
                        </button>
                        <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                          <span className="text-sm">📌</span>
                        </button>
                        <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                          <span className="text-sm">📁</span>
                        </button>
                        <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                          <span className="text-sm">🎵</span>
                        </button>
                        <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                          <span className="text-sm">📹</span>
                        </button>
                      </div>
                      
                      <button
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim()}
                        className="p-1 text-purple-600 hover:text-purple-700 disabled:text-gray-400 rounded transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="h-full flex flex-col bg-white">
            {/* Calendar Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => {
                      const newDate = new Date(calendarDate);
                      newDate.setDate(newDate.getDate() - 1);
                      setCalendarDate(newDate);
                    }}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">
                      {formatDate(calendarDate)}
                    </h2>
                  </div>
                  
                  <button
                    onClick={() => {
                      const newDate = new Date(calendarDate);
                      newDate.setDate(newDate.getDate() + 1);
                      setCalendarDate(newDate);
                    }}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setCalendarDate(new Date())}
                    className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  >
                    Today
                  </button>
                  
                  <button className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors flex items-center space-x-1">
                    <CalendarIcon className="w-4 h-4" />
                    <span>1 Calendar</span>
                  </button>
                  
                  <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="text-sm text-gray-600">All day</div>
            </div>
            
            {/* Calendar Grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="border-b border-gray-200">
                {calendarSlots.map((slot, index) => (
                  <div
                    key={slot.hour}
                    className={`flex min-h-[60px] border-b border-gray-100 ${
                      slot.isCurrentHour ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Time Column */}
                    <div className="w-20 flex-shrink-0 p-3 text-sm text-gray-600 text-right border-r border-gray-100">
                      {slot.time}
                    </div>
                    
                    {/* Content Column */}
                    <div className="flex-1 p-3 relative">
                      {slot.event && (
                        <div className="bg-blue-500 text-white rounded-md p-2 text-sm mb-2">
                          <div className="font-medium">{slot.event.title}</div>
                        </div>
                      )}
                      
                      {slot.isCurrentHour && (
                        <div 
                          className="absolute left-0 w-full h-0.5 bg-blue-500"
                          style={{
                            top: `${(new Date().getMinutes() / 60) * 60 + 12}px`
                          }}
                        >
                          <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="h-full flex flex-col bg-white">
            <div className="flex-1 overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <CheckSquare className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Tasks assigned to user will appear here.
                  </h3>
                  
                  <button
                    onClick={() => setShowNewTaskForm(true)}
                    className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add task</span>
                  </button>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      Assigned Tasks
                    </h3>
                    
                    <button
                      onClick={() => setShowNewTaskForm(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add task</span>
                    </button>
                  </div>
                  
                  {showNewTaskForm && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="Enter task title..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        
                        <div className="flex space-x-3">
                          <button
                            onClick={handleCreateTask}
                            disabled={!newTaskTitle.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Add Task
                          </button>
                          
                          <button
                            onClick={() => {
                              setShowNewTaskForm(false);
                              setNewTaskTitle('');
                            }}
                            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start space-x-3">
                          <button
                            onClick={() => toggleTaskStatus(task.id)}
                            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              task.status === 'completed'
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-green-500'
                            }`}
                          >
                            {task.status === 'completed' && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                          
                          <div className="flex-1">
                            <div className={`font-medium ${
                              task.status === 'completed' 
                                ? 'text-gray-500 line-through' 
                                : 'text-gray-900'
                            }`}>
                              {task.title}
                            </div>
                            
                            {task.description && (
                              <div className="text-sm text-gray-600 mt-1">
                                {task.description}
                              </div>
                            )}
                            
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <span>
                                Created {task.createdAt.toLocaleDateString()}
                              </span>
                              
                              {task.dueDate && (
                                <span>
                                  Due {task.dueDate.toLocaleDateString()}
                                </span>
                              )}
                              
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                task.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {task.status === 'completed' ? 'Completed' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
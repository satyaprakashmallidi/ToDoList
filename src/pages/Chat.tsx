import React, { useState, useEffect, useRef } from 'react';
import { 
  Hash, 
  ChevronDown, 
  Plus, 
  Bell, 
  Search,
  Settings,
  Users,
  MessageSquare,
  Send,
  Paperclip,
  Smile,
  Gift,
  Image,
  MoreVertical,
  Reply,
  Pin,
  FileText,
  Activity,
  Edit3
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
  category?: string;
  unread?: boolean;
  locked?: boolean;
}

interface DirectMessage {
  id: string;
  name: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  avatar?: string;
  lastMessage?: string;
  unread?: boolean;
}

interface Message {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  content: string;
  timestamp: Date;
  edited?: boolean;
  reactions?: { emoji: string; count: number; reacted: boolean }[];
}

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  active?: boolean;
}

export const Chat: React.FC = () => {
  const { user } = useAuth();
  const [repliesTab, setRepliesTab] = useState<'unread' | 'read'>('unread');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedDM, setSelectedDM] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [showChannelDropdown, setShowChannelDropdown] = useState(true);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState<string>('replies');
  const [postContent, setPostContent] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [selectedPostChannel, setSelectedPostChannel] = useState<string>('Select Channel');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sidebar items for replies section
  const sidebarItems: SidebarItem[] = [
    { id: 'replies', label: 'Replies', icon: <Reply className="w-4 h-4" />, active: true },
    { id: 'posts', label: 'Posts', icon: <FileText className="w-4 h-4" /> },
    { id: 'followups', label: 'FollowUps', icon: <Users className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
    { id: 'drafts', label: 'Drafts & Sent', icon: <Edit3 className="w-4 h-4" />, count: 1 }
  ];

  // Handle channel creation
  const handleCreateChannel = () => {
    if (newChannelName.trim()) {
      const newChannel: Channel = {
        id: Date.now().toString(),
        name: newChannelName.toLowerCase().replace(/\s+/g, '-'),
        type: 'text'
      };
      setChannels([...channels, newChannel]);
      setNewChannelName('');
      setShowCreateChannelModal(false);
    }
  };

  // Sample direct messages
  const directMessages: DirectMessage[] = [
    { id: '1', name: 'Karthik Reddy', status: 'online', lastMessage: 'Hey, how are you?' },
    { id: '2', name: 'Sandeep Kovvuri', status: 'offline', lastMessage: 'Let\'s discuss tomorrow' },
    { id: '3', name: 'satya Phanindra', status: 'idle', lastMessage: 'Thanks for the update' },
    { id: '4', name: 'Sanjana', status: 'online', lastMessage: 'Sure, sounds good!' },
    { id: '5', name: 'Narasimha S', status: 'dnd', lastMessage: 'Working on it' },
    { id: '6', name: 'vamsi', status: 'online', lastMessage: 'You', unread: true }
  ];

  // Generate sample messages
  useEffect(() => {
    if (selectedChannel || selectedDM) {
      const sampleMessages: Message[] = [
        {
          id: '1',
          userId: '1',
          userName: 'John Doe',
          content: 'Hey everyone! Just wanted to share the latest updates on the project.',
          timestamp: new Date(Date.now() - 3600000),
          reactions: [
            { emoji: '👍', count: 3, reacted: false },
            { emoji: '🎉', count: 1, reacted: true }
          ]
        },
        {
          id: '2',
          userId: '2',
          userName: 'Jane Smith',
          content: 'That sounds great! I\'ve been working on the implementation and we\'re making good progress.',
          timestamp: new Date(Date.now() - 1800000),
          edited: true
        },
        {
          id: '3',
          userId: user?.id || '3',
          userName: 'You',
          content: 'I\'ll review the code and provide feedback by EOD.',
          timestamp: new Date(Date.now() - 900000)
        }
      ];
      setMessages(sampleMessages);
    }
  }, [selectedChannel, selectedDM, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        userId: user?.id || 'current',
        userName: 'You',
        content: messageInput,
        timestamp: new Date()
      };
      setMessages([...messages, newMessage]);
      setMessageInput('');
    }
  };

  const getStatusColor = (status: DirectMessage['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'dnd': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-72 bg-gray-100 border-r border-gray-200 flex flex-col">
        {/* Single Chat Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center mr-2">
              <Reply className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-900">Chat</span>
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 flex flex-col">
          {/* Sidebar Navigation */}
          <div className="flex-1 overflow-y-auto">
            <div className="py-2">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSidebarItem(item.id)}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between group ${
                    activeSidebarItem === item.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    {item.icon}
                    <span className="ml-3">{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="bg-gray-300 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Channels Section */}
            <div className="px-2 py-3 border-t border-gray-200">
              <div className="flex items-center justify-between px-2 py-1 mb-1">
                <span className="text-xs font-semibold text-gray-600">CHANNELS</span>
                <button 
                  onClick={() => setShowCreateChannelModal(true)}
                  className="w-4 h-4 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors flex items-center justify-center"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              
              {channels.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-sm text-gray-500 mb-2">No group channels yet</div>
                  <button 
                    onClick={() => setShowCreateChannelModal(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    Create your first channel
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      className="w-full flex items-center px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-200 hover:text-gray-900 rounded transition-colors"
                      onClick={() => {
                        setSelectedChannel(channel.id);
                        setSelectedDM(null);
                      }}
                    >
                      <Hash className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate flex-1 text-left">{channel.name}</span>
                      {channel.locked && <span className="text-xs">🔒</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Direct Messages Section */}
            <div className="px-2 py-3 border-t border-gray-200">
              <div className="px-2 py-1 text-xs font-semibold text-gray-600 mb-1">DIRECT MESSAGES</div>
              <div className="space-y-0.5">
                {directMessages.map((dm) => (
                  <button
                    key={dm.id}
                    className="w-full flex items-center px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-200 hover:text-gray-900 rounded transition-colors"
                  >
                    <div className="relative mr-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                        {dm.name.charAt(0)}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-2 h-2 ${getStatusColor(dm.status)} rounded-full border border-gray-100`}></div>
                    </div>
                    <span className="truncate flex-1 text-left">{dm.name}</span>
                    {dm.name === 'vamsi' && <span className="ml-1 text-xs text-gray-500">— You</span>}
                  </button>
                ))}
                <button className="w-full flex items-center px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded hover:bg-gray-200 transition-colors">
                  <Plus className="w-4 h-4 mr-2" />
                  New message
                </button>
                </div>
              </div>
            </div>
          </div>

        {/* Bottom User Section */}
        <div className="p-3 border-t border-gray-200 bg-white">
          <div className="flex items-center">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            <div className="ml-3 flex-1">
              <div className="text-sm font-medium text-gray-900">{user?.email?.split('@')[0] || 'User'}</div>
              <div className="text-xs text-gray-500">Online</div>
            </div>
            <Settings className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Main Content - Chat Interface */}
        <div className="flex-1 flex flex-col">
          {/* Content Area */}
          {activeSidebarItem === 'posts' ? (
            /* Posts Page Content */
            <div className="flex-1 flex flex-col bg-white">
              {/* Posts Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Posts</h2>
                <button 
                  onClick={() => setShowNewPostModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  New Post
                </button>
              </div>

              {/* Posts Content */}
              <div className="flex-1 overflow-y-auto">
                {/* Create Post Section */}
                <div className="p-6 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {user?.email?.charAt(0).toUpperCase() || 'V'}
                    </div>
                    <div className="flex-1">
                      {/* Channel Selector */}
                      <div className="mb-3">
                        <div className="relative">
                          <button className="flex items-center justify-between w-48 px-3 py-2 text-left bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            <span className="text-gray-700">{selectedPostChannel}</span>
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </div>

                      {/* Post Input */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <input
                          type="text"
                          placeholder="Post topic"
                          value={postTitle}
                          onChange={(e) => setPostTitle(e.target.value)}
                          className="w-full text-lg font-medium placeholder-gray-500 border-0 focus:outline-none mb-2"
                        />
                        <textarea
                          placeholder="Write an update..."
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                          rows={3}
                          className="w-full placeholder-gray-500 border-0 focus:outline-none resize-none"
                        />
                        
                        {/* Post Actions */}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                          <div className="flex items-center space-x-2">
                            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                              <Plus className="w-4 h-4" />
                            </button>
                            <button className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded flex items-center">
                              <span className="mr-1">🔔</span>
                              Update
                              <ChevronDown className="w-3 h-3 ml-1" />
                            </button>
                            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                              <Paperclip className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                              <Smile className="w-4 h-4" />
                            </button>
                          </div>
                          <button 
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                            onClick={() => {
                              setPostTitle('');
                              setPostContent('');
                            }}
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter Bar */}
                <div className="px-6 py-4 border-b border-gray-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-full flex items-center">
                        <span className="mr-1">🔔</span>
                        Following
                      </button>
                      <button className="px-3 py-1.5 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-100 flex items-center">
                        <FileText className="w-3 h-3 mr-1" />
                        Type
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </button>
                      <button className="px-3 py-1.5 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-100 flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        Author
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Sort:</span>
                      <button className="px-3 py-1.5 text-gray-700 text-sm font-medium rounded hover:bg-gray-100 flex items-center">
                        Newest
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Posts List */}
                <div className="p-6">
                  {/* Date Header */}
                  <div className="text-sm font-medium text-gray-500 mb-4">Jun 13</div>

                  {/* Sample Post */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        SP
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-semibold text-gray-900">satya Phanindra</span>
                          <span className="text-sm text-gray-500">in Product building every ai • Jun 13 •</span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded flex items-center">
                            <span className="mr-1">🔔</span>
                            Update
                          </span>
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          tasks of phanindra june 13
                        </h3>
                        
                        <div className="text-gray-800 space-y-2">
                          <p>guys , my tasks today</p>
                          <ul className="list-disc list-inside space-y-1 ml-4">
                            <li>linkedin messages</li>
                            <li>youtube video demos of magicteams</li>
                            <li>20 people outreach</li>
                          </ul>
                          <p>will update by afternoon,</p>
                        </div>
                        
                        {/* Post Actions */}
                        <div className="flex items-center space-x-4 mt-4 pt-3 border-t border-gray-100">
                          <button className="flex items-center text-gray-500 hover:text-gray-700">
                            <span className="mr-1">👍</span>
                          </button>
                          <button className="flex items-center text-gray-500 hover:text-gray-700">
                            <Reply className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Another Sample Post */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        JD
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-semibold text-gray-900">John Developer</span>
                          <span className="text-sm text-gray-500">in demo implementations • Jun 12 •</span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                            Discussion
                          </span>
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Architecture decisions for Q3
                        </h3>
                        
                        <div className="text-gray-800">
                          <p>Team, I wanted to get everyone's input on the technical architecture we'll be using for the upcoming quarter. We have a few options to consider...</p>
                        </div>
                        
                        {/* Post Actions */}
                        <div className="flex items-center space-x-4 mt-4 pt-3 border-t border-gray-100">
                          <button className="flex items-center text-gray-500 hover:text-gray-700">
                            <span className="mr-1">👍</span>
                            <span className="text-sm">2</span>
                          </button>
                          <button className="flex items-center text-gray-500 hover:text-gray-700">
                            <Reply className="w-4 h-4 mr-1" />
                            <span className="text-sm">3</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeSidebarItem === 'replies' ? (
            /* Replies Content */
            <div className="flex-1 flex flex-col">
              {/* Unread/Read Toggle - Only for Replies */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setRepliesTab('unread')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      repliesTab === 'unread'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Unread
                  </button>
                  <button
                    onClick={() => setRepliesTab('read')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      repliesTab === 'read'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Read
                  </button>
                </div>
              </div>

              {/* Replies Content Based on Tab */}
              {repliesTab === 'unread' ? (
                /* Empty State for Unread */
                <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="w-32 h-32 mb-6 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-20 bg-gray-200 rounded-lg relative">
                    <div className="absolute -top-2 -right-2 w-12 h-10 bg-gray-300 rounded-lg"></div>
                    <div className="absolute -bottom-2 -left-2 w-12 h-10 bg-gray-300 rounded-lg"></div>
                  </div>
                  <div className="absolute bottom-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">✓</span>
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">You're all caught up</h3>
              <p className="text-gray-600 text-center mb-6">
                Looks like you don't have any unread replies
              </p>
              <button className="px-6 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium">
                Read old replies
              </button>
            </div>
          ) : (
            /* Read Tab Content */
            <div className="flex-1 flex flex-col">
              {/* Channel Header */}
              <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
                <div className="flex items-center">
                  <Hash className="w-4 h-4 text-gray-500 mr-2" />
                  <span className="font-medium text-gray-900">demo implementations</span>
                  <span className="ml-2 text-sm text-gray-500">• 2 followers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                    <Bell className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                    <Search className="w-4 h-4" />
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                    Mark unread
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Show more button */}
                <div className="flex justify-center">
                  <button className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
                    Show 12 more
                  </button>
                </div>

                {/* Sample Messages */}
                <div className="space-y-6">
                  {/* Message with avatar */}
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      J
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold text-gray-900">John Developer</span>
                        <span className="text-xs text-gray-500">Today at 2:15 PM</span>
                      </div>
                      <div className="text-gray-800">
                        Here's the latest update on the implementation. I've been working on the core features and the architecture is coming together nicely.
                      </div>
                    </div>
                  </div>

                  {/* Message with image */}
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      S
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-gray-900">Sarah Designer</span>
                        <span className="text-xs text-gray-500">Today at 1:45 PM</span>
                      </div>
                      <div className="text-gray-800 mb-3">
                        I've created some mockups for the new interface. Let me know what you think about the design direction.
                      </div>
                      {/* Sample Image */}
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-md">
                        <div className="aspect-video bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-2 mx-auto shadow-sm">
                              <Image className="w-8 h-8 text-gray-400" />
                            </div>
                            <div className="text-sm text-gray-600">Design Mockup</div>
                            <div className="text-xs text-gray-400 mt-1">Click to view full image</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Another message */}
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      M
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold text-gray-900">Mike PM</span>
                        <span className="text-xs text-gray-500">Yesterday at 4:30 PM</span>
                      </div>
                      <div className="text-gray-800">
                        Great progress everyone! The demo implementations are looking really solid. We should be ready for the client presentation next week.
                      </div>
                      {/* Reaction */}
                      <div className="flex items-center mt-2 space-x-2">
                        <button className="px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs flex items-center space-x-1 hover:bg-blue-100">
                          <span>👍</span>
                          <span>3</span>
                        </button>
                        <button className="px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs flex items-center space-x-1 hover:bg-green-100">
                          <span>🎉</span>
                          <span>2</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upgrade Banner */}
              <div className="border-t border-gray-200 bg-blue-50">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center mr-3">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Need to see older messages?</div>
                      <div className="text-xs text-gray-600">Upgrade to access your full Chat history.</div>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                    Learn more
                  </button>
                </div>
              </div>

              {/* Message Input */}
              <div className="border-t border-gray-200 bg-white p-4">
                <div className="flex items-end space-x-3">
                  <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Reply, press 'space' for AI, '/' for commands"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <Paperclip className="w-3 h-3" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <Smile className="w-3 h-3" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <Send className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
              )
            }
            </div>
          ) : activeSidebarItem === 'followups' ? (
            /* FollowUps Page Content */
            <div className="flex-1 flex flex-col bg-white">
              {/* FollowUps Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-white">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">FollowUps</h2>
                
                {/* Search Bar */}
                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search messages"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Filter Buttons */}
                <div className="flex items-center space-x-3">
                  <button className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-full flex items-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
                    Assigned to: You
                  </button>
                  <button className="px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-full flex items-center">
                    <span className="mr-1">✓</span>
                    Resolved
                  </button>
                </div>
              </div>

              {/* Empty State */}
              <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="w-24 h-24 mb-6 relative">
                  <div className="w-24 h-24 bg-gray-200 rounded-2xl flex items-center justify-center">
                    <div className="w-12 h-12 bg-gray-300 rounded-lg flex items-center justify-center">
                      <div className="space-y-1">
                        <div className="flex space-x-1">
                          <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                          <div className="w-2 h-1 bg-gray-500 rounded-full"></div>
                        </div>
                        <div className="flex space-x-1">
                          <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                          <div className="w-2 h-1 bg-gray-500 rounded-full"></div>
                        </div>
                        <div className="flex space-x-1">
                          <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                          <div className="w-2 h-1 bg-gray-500 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">You're all caught up</h3>
                <p className="text-gray-600 text-center mb-6 max-w-sm">
                  Looks like you don't have any assigned messages
                </p>
                <button className="px-6 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium">
                  Clear filters
                </button>
              </div>
            </div>
          ) : activeSidebarItem === 'activity' ? (
            /* Activity Page Content */
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                  <Activity className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Activity</h3>
                <p className="text-gray-600">
                  Activity tracking is coming soon. Stay tuned for updates!
                </p>
              </div>
            </div>
          ) : activeSidebarItem === 'drafts' ? (
            /* Drafts Page Content */
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                  <Edit3 className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Drafts & Sent</h3>
                <p className="text-gray-600">
                  Your drafts and sent messages will appear here.
                </p>
              </div>
            </div>
          ) : (
            /* Default Content for Other Sidebar Items */
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-gray-400">📋</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {activeSidebarItem.charAt(0).toUpperCase() + activeSidebarItem.slice(1)}
                </h3>
                <p className="text-gray-600">
                  This section is coming soon. Stay tuned for updates!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Channel Modal */}
      {showCreateChannelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Channel</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Channel Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Hash className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="channel-name"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateChannel()}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Channel names must be lowercase, without spaces or periods, and can't be longer than 22 characters.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateChannelModal(false);
                    setNewChannelName('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateChannel}
                  disabled={!newChannelName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Channel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
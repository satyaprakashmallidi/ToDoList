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
  Edit3,
  Lock,
  UserPlus,
  AtSign,
  Bold,
  Italic,
  Link2,
  List,
  Code,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Camera,
  Monitor,
  X,
  MoreHorizontal,
  Clock,
  Trash2,
  Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDrafts } from '../contexts/DraftContext';
import { supabase } from '../lib/supabase';

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
  category?: string;
  unread?: boolean;
  locked?: boolean;
  description?: string;
  memberCount?: number;
  members?: TeamMember[];
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'idle' | 'dnd';
  role?: string;
}

interface DirectMessage {
  id: string;
  name: string;
  status: 'online' | 'offline';
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
  const { 
    drafts, 
    sentMessages, 
    scheduledMessages,
    addDraft, 
    updateDraft, 
    deleteDraft, 
    sendDraft,
    addScheduledMessage,
    cancelScheduledMessage,
    searchDrafts,
    searchSent,
    searchScheduled
  } = useDrafts();
  const [repliesTab, setRepliesTab] = useState<'unread' | 'read'>('unread');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
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
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelView, setChannelView] = useState<'channel' | 'posts'>('channel');
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchMember, setSearchMember] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const presenceChannelRef = useRef<any>(null);
  
  // Drafts & Sent state
  const [draftsTab, setDraftsTab] = useState<'drafts' | 'sent' | 'scheduled'>('drafts');
  const [draftsSearchQuery, setDraftsSearchQuery] = useState('');
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Activity state
  const [activityTab, setActivityTab] = useState<'mentions' | 'reactions' | 'assigned'>('mentions');

  // Sidebar items for replies section
  const sidebarItems: SidebarItem[] = [
    { id: 'replies', label: 'Replies', icon: <Reply className="w-4 h-4" />, active: true },
    { id: 'posts', label: 'Posts', icon: <FileText className="w-4 h-4" /> },
    { id: 'followups', label: 'FollowUps', icon: <Users className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
    { id: 'drafts', label: 'Drafts & Sent', icon: <Edit3 className="w-4 h-4" />, count: 1 }
  ];

  // Fetch team members when component mounts and setup presence
  useEffect(() => {
    if (user?.id) {
      fetchTeamMembers();
      setupPresence();
    }

    return () => {
      // Cleanup presence subscription
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, [user]);

  const fetchTeamMembers = async () => {
    try {
      // Fetch team members from the database - both as admin and as member
      const [adminTeams, memberTeams] = await Promise.all([
        // Teams where current user is admin
        supabase
          .from('team_members')
          .select('user_id, profiles(id, email, full_name, name, avatar_url)')
          .eq('admin_id', user?.id),
        // Teams where current user is a member
        supabase
          .from('team_members')
          .select('admin_id, team_invite_id, profiles!team_members_admin_id_fkey(id, email, full_name, name, avatar_url)')
          .eq('user_id', user?.id)
      ]);

      const members: TeamMember[] = [];
      const memberIds = new Set<string>();

      // Add members from teams where user is admin
      if (adminTeams.data) {
        adminTeams.data.forEach(member => {
          if (member.profiles && !memberIds.has(member.profiles.id)) {
            memberIds.add(member.profiles.id);
            members.push({
              id: member.profiles.id,
              name: member.profiles.name || member.profiles.full_name || 'Unknown',
              email: member.profiles.email || '',
              avatar: member.profiles.avatar_url || '',
              status: 'offline',
              role: 'team member'
            });
          }
        });
      }

      // Add admins from teams where user is a member
      if (memberTeams.data) {
        memberTeams.data.forEach(team => {
          if (team.profiles && !memberIds.has(team.profiles.id)) {
            memberIds.add(team.profiles.id);
            members.push({
              id: team.profiles.id,
              name: team.profiles.name || team.profiles.full_name || 'Admin',
              email: team.profiles.email || '',
              avatar: team.profiles.avatar_url || '',
              status: 'offline',
              role: 'team admin'
            });
          }
        });
      }

      // Also fetch other team members from the same teams
      if (memberTeams.data && memberTeams.data.length > 0) {
        const teamInviteIds = memberTeams.data.map(t => t.team_invite_id);
        const { data: otherMembers } = await supabase
          .from('team_members')
          .select('user_id, profiles(id, email, full_name, name, avatar_url)')
          .in('team_invite_id', teamInviteIds)
          .neq('user_id', user?.id);

        if (otherMembers) {
          otherMembers.forEach(member => {
            if (member.profiles && !memberIds.has(member.profiles.id)) {
              memberIds.add(member.profiles.id);
              members.push({
                id: member.profiles.id,
                name: member.profiles.name || member.profiles.full_name || 'Unknown',
                email: member.profiles.email || '',
                avatar: member.profiles.avatar_url || '',
                status: 'offline',
                role: 'team member'
              });
            }
          });
        }
      }

      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  // Setup real-time presence tracking
  const setupPresence = () => {
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user?.id || ''
        }
      }
    });

    // Track current user's presence
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineUserIds = new Set<string>();
        
        Object.keys(state).forEach(userId => {
          if (state[userId] && state[userId].length > 0) {
            onlineUserIds.add(userId);
          }
        });
        
        setOnlineUsers(onlineUserIds);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        setOnlineUsers(prev => new Set([...prev, key]));
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          updated.delete(key);
          return updated;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track this user as online
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: user?.id
          });
        }
      });

    presenceChannelRef.current = channel;
  };

  // Get status for a team member
  const getMemberStatus = (memberId: string): 'online' | 'offline' => {
    return onlineUsers.has(memberId) ? 'online' : 'offline';
  };

  // Handle channel creation
  const handleCreateChannel = () => {
    if (newChannelName.trim()) {
      const newChannel: Channel = {
        id: Date.now().toString(),
        name: newChannelName.toLowerCase().replace(/\s+/g, '-'),
        type: 'text',
        description: newChannelDescription,
        memberCount: 1,
        members: []
      };
      setChannels([...channels, newChannel]);
      setNewChannelName('');
      setNewChannelDescription('');
      setShowCreateChannelModal(false);
      setSelectedChannel(newChannel);
    }
  };

  // Handle adding members to channel
  const handleAddMembers = () => {
    if (selectedChannel && selectedMembers.length > 0) {
      const membersToAdd = teamMembers.filter(member => selectedMembers.includes(member.id));
      const updatedChannel = {
        ...selectedChannel,
        members: [...(selectedChannel.members || []), ...membersToAdd],
        memberCount: (selectedChannel.memberCount || 0) + selectedMembers.length
      };
      
      // Update the channel in the channels list
      setChannels(channels.map(ch => ch.id === selectedChannel.id ? updatedChannel : ch));
      setSelectedChannel(updatedChannel);
      
      // Reset selection and close modal
      setSelectedMembers([]);
      setShowAddMembersModal(false);
    }
  };

  // Transform team members to direct messages format
  const directMessages: DirectMessage[] = teamMembers.map(member => ({
    id: member.id,
    name: member.name,
    status: getMemberStatus(member.id) as 'online' | 'offline',
    avatar: member.avatar,
    lastMessage: '',
    unread: false
  }));

  // Add current user to the list
  if (user) {
    directMessages.push({
      id: user.id,
      name: user.email?.split('@')[0] || 'You',
      status: 'online',
      lastMessage: 'You',
      unread: false
    });
  }

  // Generate sample messages or fetch real messages
  useEffect(() => {
    if (selectedChannel) {
      // Sample messages for channels
      const sampleMessages: Message[] = [
        {
          id: '1',
          userId: '1',
          userName: 'Team Member',
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
          userName: 'Another Member',
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
    } else if (selectedDM) {
      // Sample messages for DMs
      const dmUser = directMessages.find(dm => dm.id === selectedDM);
      if (dmUser && dmUser.id !== user?.id) {
        const dmMessages: Message[] = [
          {
            id: '1',
            userId: selectedDM,
            userName: dmUser.name,
            content: 'Hey! How\'s the project going?',
            timestamp: new Date(Date.now() - 7200000)
          },
          {
            id: '2',
            userId: user?.id || 'current',
            userName: 'You',
            content: 'Going well! Just finished the new feature.',
            timestamp: new Date(Date.now() - 3600000)
          },
          {
            id: '3',
            userId: selectedDM,
            userName: dmUser.name,
            content: 'That\'s awesome! Can\'t wait to see it in action.',
            timestamp: new Date(Date.now() - 1800000)
          }
        ];
        setMessages(dmMessages);
      } else {
        setMessages([]);
      }
    }
  }, [selectedChannel, selectedDM, user, directMessages]);

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


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'dnd': return 'bg-red-500';
      case 'offline': 
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
    <div className="h-screen w-full flex bg-gray-50 -mx-3 -my-4 sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8">
      {/* Left Sidebar */}
      <div className="w-72 bg-gray-100 border-r border-gray-200 flex flex-col h-full">
        {/* Single Chat Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white">
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
                      className={`w-full flex items-center px-2 py-1.5 text-sm rounded transition-colors ${
                        selectedChannel?.id === channel.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                      }`}
                      onClick={() => {
                        setSelectedChannel(channel);
                        setSelectedDM(null);
                        setActiveSidebarItem('channel');
                      }}
                    >
                      <Hash className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate flex-1 text-left">{channel.name}</span>
                      {channel.locked && <Lock className="w-3 h-3 text-gray-400" />}
                      {channel.memberCount && channel.memberCount > 0 && (
                        <span className="text-xs text-gray-500">{channel.memberCount}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Direct Messages Section */}
            <div className="px-2 py-3 border-t border-gray-200">
              <div className="px-2 py-1 text-xs font-semibold text-gray-600 mb-1">DIRECT MESSAGES</div>
              <div className="space-y-0.5">
                {directMessages.length > 0 ? (
                  directMessages.map((dm) => (
                    <button
                      key={dm.id}
                      className={`w-full flex items-center px-2 py-1.5 text-sm rounded transition-colors ${
                        selectedDM === dm.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                      }`}
                      onClick={() => {
                        setSelectedDM(dm.id);
                        setSelectedChannel(null);
                        setActiveSidebarItem('dm');
                      }}
                    >
                      <div className="relative mr-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {dm.name.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute bottom-0 right-0 w-2 h-2 ${
                          dm.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                        } rounded-full border border-white`}></div>
                      </div>
                      <span className="truncate flex-1 text-left">{dm.name}</span>
                      {dm.id === user?.id && <span className="ml-1 text-xs text-gray-500">— You</span>}
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-4 text-xs text-gray-500 text-center">
                    No team members yet
                  </div>
                )}
                <button className="w-full flex items-center px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded hover:bg-gray-200 transition-colors">
                  <Plus className="w-4 h-4 mr-2" />
                  New message
                </button>
              </div>
            </div>
            </div>
          </div>

        {/* Bottom User Section */}
        <div className="p-3 border-t border-gray-200 bg-gray-100">
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
          {activeSidebarItem === 'channel' && selectedChannel ? (
            /* Channel View */
            <div className="flex-1 flex flex-col bg-white">
              {/* Channel Header */}
              <div className="border-b border-gray-200 bg-white">
                <div className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Hash className="w-5 h-5 text-gray-500" />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{selectedChannel.name}</h2>
                      <p className="text-sm text-gray-500">
                        {selectedChannel.memberCount || 0} members • {selectedChannel.description || 'Channel'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setShowAddMembersModal(true)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Add members"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <Bell className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* Channel/Posts Tabs */}
                <div className="px-6 flex space-x-6">
                  <button
                    onClick={() => setChannelView('channel')}
                    className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                      channelView === 'channel'
                        ? 'text-gray-900 border-gray-900'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    Channel
                  </button>
                  <button
                    onClick={() => setChannelView('posts')}
                    className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                      channelView === 'posts'
                        ? 'text-gray-900 border-gray-900'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    Posts
                  </button>
                </div>
              </div>

              {channelView === 'channel' ? (
                /* Channel Messages View */
                <>
                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {messages.length > 0 ? (
                      <div className="space-y-6">
                        {messages.map((message) => (
                          <div key={message.id} className="flex items-start space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {message.userName.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="font-semibold text-gray-900">{message.userName}</span>
                                <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
                                {message.edited && <span className="text-xs text-gray-400">(edited)</span>}
                              </div>
                              <div className="text-gray-800">{message.content}</div>
                              {message.reactions && message.reactions.length > 0 && (
                                <div className="flex items-center mt-2 space-x-2">
                                  {message.reactions.map((reaction, idx) => (
                                    <button
                                      key={idx}
                                      className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 border ${
                                        reaction.reacted
                                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                      }`}
                                    >
                                      <span>{reaction.emoji}</span>
                                      <span>{reaction.count}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <Hash className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Welcome to #{selectedChannel.name}
                        </h3>
                        <p className="text-gray-600 max-w-md">
                          This is the beginning of the #{selectedChannel.name} channel.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="border-t border-gray-200 bg-white p-4">
                    <div className="bg-white border border-gray-300 rounded-lg">
                      <div className="flex items-start p-3">
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                          placeholder={`Message #${selectedChannel.name}`}
                          className="flex-1 text-gray-900 placeholder-gray-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center justify-between px-3 pb-3">
                        <div className="flex items-center space-x-1">
                          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                          <div className="h-4 w-px bg-gray-300 mx-1" />
                          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                            <Bold className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                            <Italic className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                            <Link2 className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                            <List className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                            <Code className="w-4 h-4" />
                          </button>
                          <div className="h-4 w-px bg-gray-300 mx-1" />
                          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                            <Paperclip className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                            <AtSign className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                            <Smile className="w-4 h-4" />
                          </button>
                          <div className="h-4 w-px bg-gray-300 mx-1" />
                          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                            <Mic className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                            <Video className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={handleSendMessage}
                          disabled={!messageInput.trim()}
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Posts View for Channel */
                <div className="flex-1 overflow-y-auto">
                  {/* Create Post */}
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1">
                        <div className="bg-white border border-gray-300 rounded-lg">
                          <input
                            type="text"
                            placeholder="Post topic"
                            className="w-full px-4 pt-3 pb-1 text-gray-900 placeholder-gray-500 font-medium focus:outline-none"
                          />
                          <div className="px-4 pb-3">
                            <div className="flex items-center text-sm text-gray-500">
                              <AtSign className="w-4 h-4 mr-1" />
                              <span>@@</span>
                            </div>
                          </div>
                          <div className="border-t border-gray-200 px-3 py-2 flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                                <Plus className="w-4 h-4" />
                              </button>
                              <button className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded flex items-center">
                                <Bell className="w-3 h-3 mr-1" />
                                Update
                                <ChevronDown className="w-3 h-3 ml-1" />
                              </button>
                              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                                <Paperclip className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                                <AtSign className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                                <Smile className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                                <Code className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                                <Image className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                                <Video className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                                <Mic className="w-4 h-4" />
                              </button>
                            </div>
                            <button className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                              Post
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Filter Bar */}
                  <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center">
                        <FileText className="w-4 h-4 mr-1" />
                        Type
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </button>
                      <button className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        Author
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Sort:</span>
                      <button className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center">
                        Newest
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </button>
                    </div>
                  </div>

                  {/* No Posts Yet */}
                  <div className="flex-1 flex items-center justify-center p-12">
                    <div className="text-center">
                      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="w-12 h-12 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h3>
                      <p className="text-gray-600">Be the first to post in this channel</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeSidebarItem === 'dm' && selectedDM ? (
            <div className="flex-1 flex flex-col bg-white">
              <div className="border-b border-gray-200 bg-white">
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {directMessages.find(dm => dm.id === selectedDM)?.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={onlineUsers.has(selectedDM) ? 'absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white' : 'absolute bottom-0 right-0 w-3 h-3 bg-gray-400 rounded-full border-2 border-white'}></div>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {directMessages.find(dm => dm.id === selectedDM)?.name}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {onlineUsers.has(selectedDM) ? 'Active now' : 'Offline'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setShowVideoCall(true)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Video className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <Search className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {messages.length > 0 ? (
                  <div className="space-y-6">
                    {messages.map((message) => (
                      <div key={message.id} className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {message.userName.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-semibold text-gray-900">{message.userName}</span>
                            <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
                            {message.edited && <span className="text-xs text-gray-400">(edited)</span>}
                          </div>
                          <div className="text-gray-800">{message.content}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <MessageSquare className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Start a conversation
                    </h3>
                    <p className="text-gray-600 max-w-md">
                      Send a message to {directMessages.find(dm => dm.id === selectedDM)?.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="border-t border-gray-200 bg-white p-3">
                <div className="bg-white border border-gray-300 rounded-lg">
                  <div className="flex items-start p-3">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      placeholder={`Message ${directMessages.find(dm => dm.id === selectedDM)?.name}`}
                      className="flex-1 text-gray-900 placeholder-gray-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between px-3 pb-3">
                    <div className="flex items-center space-x-1">
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                      <div className="h-4 w-px bg-gray-300 mx-1" />
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                        <Bold className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                        <Italic className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                        <Link2 className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                        <Code className="w-4 h-4" />
                      </button>
                      <div className="h-4 w-px bg-gray-300 mx-1" />
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                        <Smile className="w-4 h-4" />
                      </button>
                      <div className="h-4 w-px bg-gray-300 mx-1" />
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                        <Mic className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                        <Video className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Video Call Modal */}
              {showVideoCall && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                  <div className="bg-gray-900 rounded-lg w-full max-w-4xl h-full max-h-[90vh] overflow-hidden">
                    {/* Video Call Header */}
                    <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                            {directMessages.find(dm => dm.id === selectedDM)?.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-white font-semibold">
                              {directMessages.find(dm => dm.id === selectedDM)?.name}
                            </h3>
                            <p className="text-gray-400 text-sm">Video call</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setShowVideoCall(false)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Video Call Main Area */}
                    <div className="relative flex-1 bg-gray-800 flex items-center justify-center" style={{ height: 'calc(90vh - 140px)' }}>
                      {/* Remote Video Placeholder */}
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-semibold mx-auto mb-4">
                            {directMessages.find(dm => dm.id === selectedDM)?.name.charAt(0).toUpperCase()}
                          </div>
                          <p className="text-white text-lg font-semibold">
                            {directMessages.find(dm => dm.id === selectedDM)?.name}
                          </p>
                          <p className="text-gray-400">Connecting...</p>
                        </div>
                      </div>

                      {/* Local Video (Picture in Picture) */}
                      <div className="absolute top-4 right-4 w-48 h-36 bg-gray-600 rounded-lg border-2 border-gray-500 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold mx-auto mb-2">
                            {user?.email?.charAt(0).toUpperCase() || 'Y'}
                          </div>
                          <p className="text-white text-sm">You</p>
                        </div>
                      </div>
                    </div>

                    {/* Video Call Controls */}
                    <div className="bg-gray-800 px-6 py-4">
                      <div className="flex items-center justify-center space-x-4">
                        {/* Mute Audio */}
                        <button
                          onClick={() => setIsAudioMuted(!isAudioMuted)}
                          className={`p-3 rounded-full transition-colors ${
                            isAudioMuted 
                              ? 'bg-red-600 hover:bg-red-700 text-white' 
                              : 'bg-gray-600 hover:bg-gray-700 text-white'
                          }`}
                        >
                          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>

                        {/* Mute Video */}
                        <button
                          onClick={() => setIsVideoMuted(!isVideoMuted)}
                          className={`p-3 rounded-full transition-colors ${
                            isVideoMuted 
                              ? 'bg-red-600 hover:bg-red-700 text-white' 
                              : 'bg-gray-600 hover:bg-gray-700 text-white'
                          }`}
                        >
                          {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                        </button>

                        {/* End Call */}
                        <button
                          onClick={() => setShowVideoCall(false)}
                          className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>

                        {/* Share Screen */}
                        <button className="p-3 bg-gray-600 hover:bg-gray-700 text-white rounded-full transition-colors">
                          <Monitor className="w-5 h-5" />
                        </button>

                        {/* More Options */}
                        <button className="p-3 bg-gray-600 hover:bg-gray-700 text-white rounded-full transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeSidebarItem === 'posts' ? (
            /* Posts Page Content */
            <div className="flex-1 flex flex-col bg-white">
              {/* Posts Header */}
              <div className="px-4 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Posts</h2>
                <button 
                  onClick={() => setShowNewPostModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  New Post
                </button>
              </div>

              {/* Posts Content */}
              <div className="flex-1 overflow-y-auto max-h-[75vh]">
                {/* Create Post Section */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
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
                      <div className="bg-white border border-gray-200 rounded-lg p-2">
                        <input
                          type="text"
                          placeholder="Post topic"
                          value={postTitle}
                          onChange={(e) => setPostTitle(e.target.value)}
                          className="w-full text-base font-medium placeholder-gray-500 border-0 focus:outline-none mb-1"
                        />
                        <textarea
                          placeholder="Write an update..."
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                          rows={2}
                          className="w-full placeholder-gray-500 border-0 focus:outline-none resize-none"
                        />
                        
                        {/* Post Actions */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
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
                <div className="px-4 py-4 border-b border-gray-200 bg-white">
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

                {/* Posts List - Empty State */}
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h3>
                    <p className="text-gray-600 mb-4">
                      Posts from your team will appear here when they're shared.
                    </p>
                  </div>
                </div>
              </div>

              {/* New Post Modal */}
              {showNewPostModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <button className="flex items-center justify-between w-48 px-3 py-2 text-left bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-50">
                          <span className="text-gray-700">Select Channel</span>
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                      <button 
                        onClick={() => setShowNewPostModal(false)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Modal Content */}
                    <div className="p-6">
                      {/* Post Input */}
                      <div className="space-y-4">
                        <input
                          type="text"
                          placeholder="Post topic"
                          value={postTitle}
                          onChange={(e) => setPostTitle(e.target.value)}
                          className="w-full text-lg font-medium placeholder-gray-500 border-0 focus:outline-none bg-transparent"
                        />
                        <textarea
                          placeholder="Write an update..."
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                          rows={8}
                          className="w-full placeholder-gray-500 border-0 focus:outline-none resize-none bg-transparent"
                        />
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <Paperclip className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <AtSign className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <Hash className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <Smile className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <Camera className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <Mic className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center space-x-3">
                          <button className="px-3 py-1.5 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded flex items-center">
                            <span className="mr-1">🔔</span>
                            Update
                            <ChevronDown className="w-3 h-3 ml-1" />
                          </button>
                          <button 
                            onClick={() => {
                              // Handle post submission
                              setPostTitle('');
                              setPostContent('');
                              setShowNewPostModal(false);
                            }}
                            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeSidebarItem === 'replies' ? (
            /* Replies Content */
            <div className="flex-1 flex flex-col bg-white">
              {/* Replies Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-white">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Replies</h2>
                
                {/* Unread/Read Tabs - Discord Style */}
                <div className="flex space-x-6">
                  <button
                    onClick={() => setRepliesTab('unread')}
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                      repliesTab === 'unread'
                        ? 'text-gray-900 border-blue-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    Unread
                  </button>
                  <button
                    onClick={() => setRepliesTab('read')}
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                      repliesTab === 'read'
                        ? 'text-gray-900 border-blue-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    Read
                  </button>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto max-h-[calc(100vh-200px)]">
                {repliesTab === 'unread' ? (
                  /* Unread Empty State */
                  <div className="flex-1 flex flex-col items-center justify-center p-12">
                    <div className="w-32 h-32 mb-6 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        {/* Stacked message cards */}
                        <div className="w-20 h-16 bg-gray-200 rounded-lg relative transform -rotate-12">
                          <div className="absolute top-2 left-2 w-3 h-3 bg-gray-400 rounded-full"></div>
                          <div className="absolute top-2 right-2 w-8 h-1 bg-gray-400 rounded"></div>
                          <div className="absolute bottom-2 left-2 w-12 h-1 bg-gray-400 rounded"></div>
                        </div>
                        <div className="absolute w-20 h-16 bg-gray-300 rounded-lg transform rotate-6">
                          <div className="absolute top-2 left-2 w-3 h-3 bg-gray-500 rounded-full"></div>
                          <div className="absolute top-2 right-2 w-8 h-1 bg-gray-500 rounded"></div>
                          <div className="absolute bottom-2 left-2 w-12 h-1 bg-gray-500 rounded"></div>
                        </div>
                        <div className="absolute w-20 h-16 bg-gray-400 rounded-lg transform rotate-12 translate-x-1 translate-y-1">
                          <div className="absolute top-2 left-2 w-3 h-3 bg-gray-600 rounded-full"></div>
                          <div className="absolute top-2 right-2 w-8 h-1 bg-gray-600 rounded"></div>
                          <div className="absolute bottom-2 left-2 w-12 h-1 bg-gray-600 rounded"></div>
                        </div>
                        {/* Checkmark */}
                        <div className="absolute bottom-0 right-0 w-8 h-8 bg-white border-2 border-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
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
                  <div className="flex-1 flex flex-col items-center justify-center p-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Reply className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No read replies</h3>
                    <p className="text-gray-600 text-center max-w-sm">
                      Previously read replies will appear here.
                    </p>
                  </div>
                )}
              </div>
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
            <div className="flex-1 flex flex-col bg-white">
              {/* Activity Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-white">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity</h2>
                
                {/* Filter Tabs */}
                <div className="flex space-x-1">
                  <button
                    onClick={() => setActivityTab('mentions')}
                    className={`flex items-center space-x-2 px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                      activityTab === 'mentions'
                        ? 'bg-blue-100 text-blue-800'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <AtSign className="w-4 h-4" />
                    <span>Mentions</span>
                  </button>
                  <button
                    onClick={() => setActivityTab('reactions')}
                    className={`flex items-center space-x-2 px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                      activityTab === 'reactions'
                        ? 'bg-blue-100 text-blue-800'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <span>😊</span>
                    <span>Reactions</span>
                  </button>
                  <button
                    onClick={() => setActivityTab('assigned')}
                    className={`flex items-center space-x-2 px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                      activityTab === 'assigned'
                        ? 'bg-blue-100 text-blue-800'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Assigned to me</span>
                  </button>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto max-h-[calc(100vh-200px)]">
                {activityTab === 'mentions' ? (
                  /* Mentions Content */
                  <div className="flex-1 flex items-center justify-center p-12">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AtSign className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No mentions yet</h3>
                      <p className="text-gray-600 text-center max-w-sm">
                        When someone mentions you, it will appear here.
                      </p>
                    </div>
                  </div>
                ) : activityTab === 'reactions' ? (
                  /* Reactions Content */
                  <div className="flex-1 flex items-center justify-center p-12">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">😊</span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No reactions yet</h3>
                      <p className="text-gray-600 text-center max-w-sm">
                        When people react to your messages, it will appear here.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Assigned to me Content */
                  <div className="flex-1 flex items-center justify-center p-12">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No assignments yet</h3>
                      <p className="text-gray-600 text-center max-w-sm">
                        When tasks are assigned to you, they will appear here.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : activeSidebarItem === 'drafts' ? (
            /* Drafts & Sent Page Content */
            <div className="flex-1 flex flex-col bg-white">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-white">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                    <Edit3 className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Drafts & Sent</h2>
                </div>
                
                {/* Tabs */}
                <div className="flex space-x-6">
                  <button
                    onClick={() => setDraftsTab('drafts')}
                    className={`flex items-center space-x-2 py-2 text-sm font-medium border-b-2 transition-colors ${
                      draftsTab === 'drafts'
                        ? 'text-gray-900 border-purple-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Drafts</span>
                  </button>
                  <button
                    onClick={() => setDraftsTab('sent')}
                    className={`flex items-center space-x-2 py-2 text-sm font-medium border-b-2 transition-colors ${
                      draftsTab === 'sent'
                        ? 'text-gray-900 border-purple-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>Sent</span>
                  </button>
                  <button
                    onClick={() => setDraftsTab('scheduled')}
                    className={`flex items-center space-x-2 py-2 text-sm font-medium border-b-2 transition-colors ${
                      draftsTab === 'scheduled'
                        ? 'text-gray-900 border-purple-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>Scheduled</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={
                      draftsTab === 'drafts' ? 'Search drafts...' :
                      draftsTab === 'sent' ? 'Search sent...' :
                      'Search scheduled messages...'
                    }
                    value={draftsSearchQuery}
                    onChange={(e) => setDraftsSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Thread indicator and Sent by filter */}
              <div className="px-6 py-2 bg-gray-50">
                <div className="flex items-center space-x-2">
                  <div className="inline-flex items-center space-x-2 px-2 py-1 bg-gray-200 rounded text-xs text-gray-600">
                    <MessageSquare className="w-3 h-3" />
                    <span>In thread</span>
                  </div>
                  {draftsTab === 'sent' && (
                    <div className="inline-flex items-center space-x-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      <span>Sent by: You</span>
                    </div>
                  )}
                </div>
              </div>


              {/* Table Header */}
              <div className="px-6 py-3 bg-white border-b border-gray-200">
                <div className="grid grid-cols-3 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div>Location</div>
                  <div>Message</div>
                  <div>
                    {draftsTab === 'sent' ? 'Sent' : 
                     draftsTab === 'scheduled' ? 'Send' : 'Updated'}
                  </div>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto max-h-[calc(100vh-300px)] min-h-0">
                {draftsTab === 'drafts' ? (
                  /* Drafts Content */
                  drafts.length === 0 || (draftsSearchQuery && searchDrafts(draftsSearchQuery).length === 0) ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <Edit3 className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No drafts</h3>
                      <p className="text-gray-600 text-center max-w-sm">
                        Drafts are saved messages that you have not sent yet.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {(draftsSearchQuery ? searchDrafts(draftsSearchQuery) : drafts).map((draft) => (
                        <div key={draft.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                          <div className="grid grid-cols-3 gap-4 items-start">
                            <div className="flex items-center space-x-2">
                              <Hash className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-900 truncate">{draft.location}</span>
                            </div>
                            <div className="flex-1">
                              {editingDraft === draft.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editingContent}
                                    onChange={(e) => setEditingContent(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded text-sm resize-none"
                                    rows={2}
                                  />
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => {
                                        updateDraft(draft.id, editingContent);
                                        setEditingDraft(null);
                                        setEditingContent('');
                                      }}
                                      className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        sendDraft(draft.id);
                                        setEditingDraft(null);
                                        setEditingContent('');
                                      }}
                                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                    >
                                      Send
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingDraft(null);
                                        setEditingContent('');
                                      }}
                                      className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between group">
                                  <p className="text-sm text-gray-900 flex-1 pr-4">{draft.message}</p>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                                    <button
                                      onClick={() => {
                                        setEditingDraft(draft.id);
                                        setEditingContent(draft.message);
                                      }}
                                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                      title="Edit draft"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => sendDraft(draft.id)}
                                      className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                      title="Send draft"
                                    >
                                      <Send className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteDraft(draft.id)}
                                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                                      title="Delete draft"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(draft.lastUpdated).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : draftsTab === 'sent' ? (
                  /* Sent Messages Content */
                  sentMessages.length === 0 || (draftsSearchQuery && searchSent(draftsSearchQuery).length === 0) ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <div className="w-10 h-10 border-2 border-gray-400 rounded-full flex items-center justify-center">
                          <div className="w-4 h-4 bg-gray-400 rounded-full transform rotate-45"></div>
                        </div>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">You're all caught up</h3>
                      <p className="text-gray-600 text-center max-w-sm">
                        Looks like you don't have any sent messages
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {(draftsSearchQuery ? searchSent(draftsSearchQuery) : sentMessages).map((message) => (
                        <div key={message.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                          <div className="grid grid-cols-3 gap-4 items-start">
                            <div className="flex items-center space-x-2">
                              <Hash className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-900 truncate">{message.location}</span>
                            </div>
                            <div className="flex items-start justify-between group">
                              <p className="text-sm text-gray-900 flex-1 pr-4">{message.message}</p>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                  title="View message"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(message.sentAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* Scheduled Messages Content */
                  scheduledMessages.length === 0 || (draftsSearchQuery && searchScheduled(draftsSearchQuery).length === 0) ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <Clock className="w-10 h-10 text-gray-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No scheduled messages</h3>
                      <p className="text-gray-600 text-center max-w-sm">
                        Looks like you don't have any scheduled messages
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {(draftsSearchQuery ? searchScheduled(draftsSearchQuery) : scheduledMessages).map((message) => (
                        <div key={message.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                          <div className="grid grid-cols-3 gap-4 items-start">
                            <div className="flex items-center space-x-2">
                              <Hash className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-900 truncate">{message.location}</span>
                            </div>
                            <div className="flex items-start justify-between group">
                              <p className="text-sm text-gray-900 flex-1 pr-4">{message.message}</p>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                                <button
                                  onClick={() => cancelScheduledMessage(message.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                                  title="Cancel scheduled message"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                                <button
                                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                  title="Edit schedule"
                                >
                                  <Clock className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(message.scheduledFor).toLocaleDateString()} at {new Date(message.scheduledFor).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
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

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  placeholder="What's this channel about?"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateChannelModal(false);
                    setNewChannelName('');
                    setNewChannelDescription('');
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

      {/* Add Members Modal */}
      {showAddMembersModal && selectedChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Add people to #{selectedChannel.name}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedChannel.memberCount || 0} members in this channel
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddMembersModal(false);
                    setSelectedMembers([]);
                    setSearchMember('');
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {/* Search Bar */}
              <div className="mb-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                    placeholder="Search team members by name or email"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Selected Members */}
              {selectedMembers.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Selected ({selectedMembers.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map(memberId => {
                      const member = teamMembers.find(m => m.id === memberId);
                      return member ? (
                        <div
                          key={memberId}
                          className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full"
                        >
                          <span className="text-sm">{member.name}</span>
                          <button
                            onClick={() => setSelectedMembers(selectedMembers.filter(id => id !== memberId))}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Team Members List */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 mb-3">Team Members</p>
                {teamMembers
                  .filter(member => 
                    member.name.toLowerCase().includes(searchMember.toLowerCase()) ||
                    member.email.toLowerCase().includes(searchMember.toLowerCase())
                  )
                  .filter(member => 
                    !selectedChannel.members?.some(m => m.id === member.id)
                  )
                  .map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                      onClick={() => {
                        if (selectedMembers.includes(member.id)) {
                          setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                        } else {
                          setSelectedMembers([...selectedMembers, member.id]);
                        }
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => {}}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.email} • {member.role}</p>
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        member.status === 'online' ? 'bg-green-500' :
                        member.status === 'idle' ? 'bg-yellow-500' :
                        member.status === 'dnd' ? 'bg-red-500' :
                        'bg-gray-400'
                      }`} />
                    </div>
                  ))}
              </div>

              {/* Current Members in Channel */}
              {selectedChannel.members && selectedChannel.members.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Already in channel ({selectedChannel.members.length})
                  </p>
                  <div className="space-y-2">
                    {selectedChannel.members.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{member.name}</p>
                            <p className="text-xs text-gray-500">{member.email} • {member.role}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">Member</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddMembersModal(false);
                    setSelectedMembers([]);
                    setSearchMember('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMembers}
                  disabled={selectedMembers.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add {selectedMembers.length > 0 ? `${selectedMembers.length} ${selectedMembers.length === 1 ? 'person' : 'people'}` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Upgrade Your Plan</h2>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Send className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-gray-600 text-center mb-4">
                  Access your full chat history and unlock premium features with our Pro plan.
                </p>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-center">
                    <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                    Unlimited chat history
                  </li>
                  <li className="flex items-center">
                    <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                    Advanced search features
                  </li>
                  <li className="flex items-center">
                    <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                    Priority support
                  </li>
                </ul>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Not now
                </button>
                <button
                  onClick={() => {
                    // Here you would integrate with your payment system
                    alert('Redirect to upgrade page...');
                    setShowUpgradeModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
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
  Video,
  X,
  MoreHorizontal,
  Clock,
  Trash2,
  Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDrafts } from '../contexts/DraftContext';
import { useChannels } from '../hooks/useChannels';
import { ChannelCreateModal } from '../components/ChannelCreateModal';
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
  const {
    channels: dbChannels,
    channelMessages,
    directConversations,
    directMessages,
    channelPosts,
    loading: channelsLoading,
    error: channelsError,
    createChannel,
    loadChannelMessages,
    sendChannelMessage,
    addChannelMembers,
    sendDirectMessage,
    loadDirectMessages,
    getOrCreateDirectConversation,
    loadChannelPosts,
    createChannelPost
  } = useChannels();
  const [repliesTab, setRepliesTab] = useState<'unread' | 'read'>('unread');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedDM, setSelectedDM] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [showChannelDropdown, setShowChannelDropdown] = useState(true);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState<string>('replies');
  const [postContent, setPostContent] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [channelPostTitle, setChannelPostTitle] = useState('');
  const [channelPostContent, setChannelPostContent] = useState('');
  const [selectedPostChannel, setSelectedPostChannel] = useState<string>('Select Channel');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
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
      // Step 1: Get team members where current user is involved
      const { data: teamMemberships, error: teamError } = await supabase
        .from('team_members')
        .select('user_id, admin_id, team_invite_id')
        .or(`user_id.eq.${user?.id},admin_id.eq.${user?.id}`);

      if (teamError) {
        console.error('Error fetching team memberships:', teamError);
        return;
      }

      if (!teamMemberships || teamMemberships.length === 0) {
        setTeamMembers([]);
        return;
      }

      // Step 2: Get all unique user IDs from the team memberships
      const allUserIds = new Set<string>();
      teamMemberships.forEach(membership => {
        if (membership.user_id) allUserIds.add(membership.user_id);
        if (membership.admin_id) allUserIds.add(membership.admin_id);
      });

      // Step 3: Get profile information for all these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, name, avatar_url')
        .in('id', Array.from(allUserIds));

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      // Step 4: Create team members list
      const members: TeamMember[] = [];
      const memberIds = new Set<string>();

      if (profiles) {
        profiles.forEach(profile => {
          if (!memberIds.has(profile.id) && profile.id !== user?.id) {
            memberIds.add(profile.id);
            // Check if this user is an admin in any team the current user is part of
            const isAdmin = teamMemberships.some(tm => tm.admin_id === profile.id);
            
            members.push({
              id: profile.id,
              name: profile.name || profile.full_name || 'Unknown',
              email: profile.email || '',
              avatar: profile.avatar_url || '',
              status: 'offline',
              role: isAdmin ? 'team admin' : 'team member'
            });
          }
        });
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
  const handleCreateChannel = async (data: {
    name: string;
    description?: string;
    type: 'text' | 'voice' | 'announcement';
    isPrivate: boolean;
    category?: string;
  }) => {
    setCreatingChannel(true);
    try {
      const channelId = await createChannel(
        data.name,
        data.description,
        data.type,
        data.isPrivate,
        data.category
      );
      
      if (channelId) {
        setShowCreateChannelModal(false);
        // Find and select the newly created channel
        const newChannel = dbChannels.find(ch => ch.id === channelId);
        if (newChannel) {
          setSelectedChannel({
            id: newChannel.id,
            name: newChannel.name,
            type: newChannel.channel_type as 'text' | 'voice',
            description: newChannel.description || undefined,
            memberCount: newChannel.member_count || 1
          });
        }
      }
    } catch (error) {
      console.error('Failed to create channel:', error);
    } finally {
      setCreatingChannel(false);
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
      
      // Note: Channel updates would be handled by the database and real-time subscriptions
      setSelectedChannel(updatedChannel);
      
      // Reset selection and close modal
      setSelectedMembers([]);
      setShowAddMembersModal(false);
    }
  };

  // Transform team members to direct messages format (excluding current user)
  const availableDirectMessages: DirectMessage[] = teamMembers
    .filter(member => member.id !== user?.id) // Exclude current user
    .map(member => ({
      id: member.id,
      name: member.name,
      status: getMemberStatus(member.id) as 'online' | 'offline',
      avatar: member.avatar,
      lastMessage: '',
      unread: false
    }));

  // Current user is excluded from direct messages list

  // Handle DM message loading (channels are handled by useChannels hook)
  useEffect(() => {
    const loadDMMessages = async () => {
      if (selectedDM && !selectedChannel && user) {
        // Get or create conversation ID for this DM
        const conversationId = await getOrCreateDirectConversation(selectedDM);
        if (conversationId) {
          setCurrentConversationId(conversationId);
          // Load messages for this conversation
          await loadDirectMessages(conversationId);
        }
      } else if (selectedChannel) {
        // Clear DM state for channels since they're handled by useChannels hook
        setCurrentConversationId(null);
      }
    };

    loadDMMessages();
  }, [selectedDM, selectedChannel, user?.id, getOrCreateDirectConversation, loadDirectMessages]);

  // Load posts when channel posts tab is active
  useEffect(() => {
    console.log('Posts effect triggered:', { selectedChannel, channelView, activeSidebarItem });
    if (selectedChannel && channelView === 'posts') {
      console.log('Loading posts for channel posts tab:', selectedChannel.id);
      loadChannelPosts(selectedChannel.id);
    }
  }, [selectedChannel, channelView, loadChannelPosts]);

  // Get current messages based on selected view
  const currentMessages = selectedChannel 
    ? channelMessages[selectedChannel.id] || []
    : (currentConversationId ? directMessages[currentConversationId] || [] : []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);



  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    if (selectedChannel) {
      // Send message to channel
      await sendChannelMessage(selectedChannel.id, messageInput);
      setMessageInput('');
    } else if (selectedDM) {
      // Send direct message
      const success = await sendDirectMessage(selectedDM, messageInput);
      if (success) {
        setMessageInput('');
        // Reload messages to show the new message
        if (currentConversationId) {
          await loadDirectMessages(currentConversationId);
        }
      }
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

  const formatTime = (date: Date | string) => {
    const now = new Date();
    const messageDate = typeof date === 'string' ? new Date(date) : date;
    
    // Check if the date is valid
    if (isNaN(messageDate.getTime())) {
      return 'now';
    }
    
    const diff = now.getTime() - messageDate.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes <= 0) return 'now';
    return `${minutes}m ago`;
  };

  return (
    <div className="h-screen w-full flex bg-gray-50 -m-4 sm:-m-6">
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
              
              {dbChannels.length === 0 ? (
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
                  {dbChannels.map((channel) => (
                    <button
                      key={channel.id}
                      className={`w-full flex items-center px-2 py-1.5 text-sm rounded transition-colors ${
                        selectedChannel?.id === channel.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                      }`}
                      onClick={() => {
                        setSelectedChannel({
                          id: channel.id,
                          name: channel.name,
                          type: channel.channel_type as 'text' | 'voice',
                          description: channel.description || undefined,
                          memberCount: channel.member_count || 1
                        });
                        setSelectedDM(null);
                        setActiveSidebarItem('channel');
                        // Load messages for this channel
                        loadChannelMessages(channel.id);
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
                {availableDirectMessages.length > 0 ? (
                  availableDirectMessages.map((dm) => (
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
                    {selectedChannel && channelMessages[selectedChannel.id]?.length > 0 ? (
                      <div className="space-y-6">
                        {channelMessages[selectedChannel.id].map((message) => (
                          <div key={message.id} className="flex items-start space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {message.sender_name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="font-semibold text-gray-900">{message.sender_name}</span>
                                <span className="text-xs text-gray-500">{formatTime(new Date(message.created_at))}</span>
                                {message.is_edited && <span className="text-xs text-gray-400">(edited)</span>}
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
                            value={channelPostTitle}
                            onChange={(e) => setChannelPostTitle(e.target.value)}
                            className="w-full px-4 pt-3 pb-1 text-gray-900 placeholder-gray-500 font-medium focus:outline-none"
                          />
                          <div className="px-4 pb-3">
                            <textarea
                              placeholder="What would you like to share?"
                              value={channelPostContent}
                              onChange={(e) => setChannelPostContent(e.target.value)}
                              rows={3}
                              className="w-full text-gray-900 placeholder-gray-500 focus:outline-none resize-none border-0"
                            />
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
                            <button 
                              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              disabled={!channelPostContent.trim() || !selectedChannel}
                              onClick={async () => {
                                if (!channelPostContent.trim() || !selectedChannel) return;
                                
                                try {
                                  await createChannelPost(
                                    selectedChannel.id,
                                    channelPostTitle,
                                    channelPostContent,
                                    'update',
                                    []
                                  );
                                  setChannelPostTitle('');
                                  setChannelPostContent('');
                                } catch (error) {
                                  console.error('Failed to create channel post:', error);
                                }
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

                  {/* Channel Posts List */}
                  <div className="flex-1 p-6">
                    {selectedChannel && channelPosts[selectedChannel.id]?.length > 0 ? (
                      channelPosts[selectedChannel.id].map((post: any) => (
                        <div key={post.id} className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
                          <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                              {(post.author_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="font-semibold text-gray-900">{post.author_name || 'Unknown'}</span>
                                <span className="text-sm text-gray-500">
                                  {formatTime(post.created_at)}
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded flex items-center ${
                                  post.post_type === 'update' ? 'bg-blue-100 text-blue-700' :
                                  post.post_type === 'announcement' ? 'bg-red-100 text-red-700' :
                                  post.post_type === 'idea' ? 'bg-yellow-100 text-yellow-700' :
                                  post.post_type === 'discussion' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {post.post_type === 'update' && <span className="mr-1">🔔</span>}
                                  {post.post_type || 'Update'}
                                </span>
                                {post.is_pinned && (
                                  <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                                    Pinned
                                  </span>
                                )}
                              </div>
                              
                              {post.title && (
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                  {post.title}
                                </h3>
                              )}
                              
                              <div className="text-gray-800 space-y-2">
                                <p>{post.content}</p>
                              </div>

                              {post.tags && post.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {post.tags.map((tag: string, index: number) => (
                                    <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {/* Post Actions */}
                              <div className="flex items-center space-x-4 mt-4 pt-3 border-t border-gray-100">
                                <button className="flex items-center text-gray-500 hover:text-gray-700">
                                  <span className="mr-1">👍</span>
                                  <span className="text-sm">Like</span>
                                </button>
                                <button className="flex items-center text-gray-500 hover:text-gray-700">
                                  <Reply className="w-4 h-4 mr-1" />
                                  <span className="text-sm">Reply</span>
                                </button>
                                <span className="text-sm text-gray-500">
                                  {post.view_count || 0} views
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageSquare className="w-12 h-12 text-gray-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h3>
                          <p className="text-gray-600">Be the first to post in this channel</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : activeSidebarItem === 'dm' && selectedDM ? (
            <div className="flex-1 flex flex-col bg-white">
              <div className="border-b border-gray-200 bg-white">
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {availableDirectMessages.find(dm => dm.id === selectedDM)?.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={onlineUsers.has(selectedDM) ? 'absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white' : 'absolute bottom-0 right-0 w-3 h-3 bg-gray-400 rounded-full border-2 border-white'}></div>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {availableDirectMessages.find(dm => dm.id === selectedDM)?.name}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {onlineUsers.has(selectedDM) ? 'Active now' : 'Offline'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
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
              <div className="flex-1 overflow-y-auto p-6">
                {currentMessages.length > 0 ? (
                  <div className="space-y-6">
                    {currentMessages.map((message) => (
                      <div key={message.id} className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {(message.sender_name || message.userName || 'U').charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-semibold text-gray-900">{message.sender_name || message.userName}</span>
                            <span className="text-xs text-gray-500">{formatTime(message.created_at || message.timestamp)}</span>
                            {(message.is_edited || message.edited) && <span className="text-xs text-gray-400">(edited)</span>}
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
                      Send a message to {availableDirectMessages.find(dm => dm.id === selectedDM)?.name}
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
                      placeholder={`Message ${availableDirectMessages.find(dm => dm.id === selectedDM)?.name}`}
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
            </div>
          ) : activeSidebarItem === 'posts' ? (
            /* Posts Page Content */
            <div className="flex-1 flex flex-col bg-white">
              {/* Posts Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Posts</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (selectedChannel) {
                        console.log('Manual refresh posts for:', selectedChannel.id);
                        loadChannelPosts(selectedChannel.id);
                      }
                    }}
                    className="px-3 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Refresh
                  </button>
                  <button 
                    onClick={() => setShowNewPostModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    New Post
                  </button>
                </div>
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
                          <select 
                            className="flex items-center justify-between w-48 px-3 py-2 text-left bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={selectedChannel?.id || ''}
                            onChange={(e) => {
                              const channelId = e.target.value;
                              const channel = dbChannels.find(ch => ch.id === channelId);
                              if (channel) {
                                setSelectedChannel(channel);
                                setSelectedPostChannel(channel.name);
                              }
                            }}
                          >
                            <option value="">Select Channel</option>
                            {dbChannels.map(channel => (
                              <option key={channel.id} value={channel.id}>
                                #{channel.name}
                              </option>
                            ))}
                          </select>
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
                            onClick={async () => {
                              if (!postContent.trim() || !selectedChannel) return;
                              
                              try {
                                await createChannelPost(
                                  selectedChannel.id,
                                  postTitle,
                                  postContent,
                                  'update',
                                  []
                                );
                                setPostTitle('');
                                setPostContent('');
                              } catch (error) {
                                console.error('Failed to create post:', error);
                              }
                            }}
                            disabled={!postContent.trim() || !selectedChannel}
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
                  {console.log('Rendering posts section:', { selectedChannel, channelPosts, hasPostsForChannel: selectedChannel ? channelPosts[selectedChannel.id] : 'no channel' })}
                  {selectedChannel ? (
                    channelPosts[selectedChannel.id]?.length > 0 ? (
                      channelPosts[selectedChannel.id].map((post: any) => (
                        <div key={post.id} className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
                          <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                              {(post.author_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="font-semibold text-gray-900">{post.author_name || 'Unknown'}</span>
                                <span className="text-sm text-gray-500">
                                  in #{selectedChannel.name} • {formatTime(post.created_at)} •
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded flex items-center ${
                                  post.post_type === 'update' ? 'bg-blue-100 text-blue-700' :
                                  post.post_type === 'announcement' ? 'bg-red-100 text-red-700' :
                                  post.post_type === 'idea' ? 'bg-yellow-100 text-yellow-700' :
                                  post.post_type === 'discussion' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {post.post_type === 'update' && <span className="mr-1">🔔</span>}
                                  {post.post_type || 'Update'}
                                </span>
                                {post.is_pinned && (
                                  <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                                    Pinned
                                  </span>
                                )}
                              </div>
                              
                              {post.title && (
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                  {post.title}
                                </h3>
                              )}
                              
                              <div className="text-gray-800 space-y-2">
                                <p>{post.content}</p>
                              </div>

                              {post.tags && post.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {post.tags.map((tag: string, index: number) => (
                                    <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {/* Post Actions */}
                              <div className="flex items-center space-x-4 mt-4 pt-3 border-t border-gray-100">
                                <button className="flex items-center text-gray-500 hover:text-gray-700">
                                  <span className="mr-1">👍</span>
                                  <span className="text-sm">Like</span>
                                </button>
                                <button className="flex items-center text-gray-500 hover:text-gray-700">
                                  <Reply className="w-4 h-4 mr-1" />
                                  <span className="text-sm">Reply</span>
                                </button>
                                <span className="text-sm text-gray-500">
                                  {post.view_count || 0} views
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
                        <p className="text-gray-500 mb-6">
                          Be the first to share an update in #{selectedChannel.name}
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Hash className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Select a channel</h3>
                      <p className="text-gray-500">
                        Choose a channel to view and create posts
                      </p>
                    </div>
                  )}
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

              {/* Upgrade notice banner - only for sent tab */}
              {draftsTab === 'sent' && (
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs">!</span>
                      </div>
                      <span className="text-sm text-blue-900">
                        Need to see older messages? Upgrade to access your full Chat history.
                      </span>
                    </div>
                    <button 
                      onClick={() => setShowUpgradeModal(true)}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                    >
                      Learn more
                    </button>
                  </div>
                </div>
              )}

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
              <div className="flex-1 overflow-y-auto max-h-[60vh]">
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

      {/* Channel Creation Modal */}
      <ChannelCreateModal
        isOpen={showCreateChannelModal}
        onClose={() => setShowCreateChannelModal(false)}
        onSubmit={handleCreateChannel}
        isLoading={creatingChannel}
      />

    </div>
  );
};
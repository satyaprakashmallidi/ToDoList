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
  Camera,
  X,
  MoreHorizontal,
  Clock,
  Trash2,
  Eye,
  Heart,
  Laugh,
  Frown,
  Angry,
  ThumbsUp,
  Download,
  ChevronDown as ScrollDown,
  MicOff,
  VideoOff,
  Monitor,
  MonitorSpeaker,
  Phone,
  PhoneOff,
  Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useChannels } from '../hooks/useChannels';
import { ChannelCreateModal } from '../components/ChannelCreateModal';
import { supabase } from '../lib/supabase';
import { checkAndSetupStorage, getStorageInstructions } from '../utils/setupStorage';

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
    createChannelPost,
    togglePostReaction,
    getPostReactions,
    addPostComment,
    getPostComments,
    markMessageAsRead,
    markChannelMessagesAsRead,
    markDirectMessagesAsRead,
    getUnreadReplies,
    getReadReplies,
    getSentMessages,
    loadChannelMembers
  } = useChannels();
  const [repliesTab, setRepliesTab] = useState<'unread' | 'read'>('unread');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [unreadReplies, setUnreadReplies] = useState<any[]>([]);
  const [readReplies, setReadReplies] = useState<any[]>([]);
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
  
  // Sent Messages state
  const [sentSearchQuery, setSentSearchQuery] = useState('');
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedSentByUser, setSelectedSentByUser] = useState<string | null>(null);
  
  // Notification states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showSentByDropdown, setShowSentByDropdown] = useState(false);
  const [receivedMessages, setReceivedMessages] = useState<any[]>([]);
  
  // Post reactions and comments state
  const [postReactions, setPostReactions] = useState<Record<string, any[]>>({});
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  
  // Activity state
  const [activityTab, setActivityTab] = useState<'mentions' | 'reactions' | 'assigned'>('mentions');
  const [activityReactions, setActivityReactions] = useState<any[]>([]);

  // Task Assignment state
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [resolvedTasks, setResolvedTasks] = useState<any[]>([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<TeamMember | null>(null);
  const [followupsFilter, setFollowupsFilter] = useState<'assigned' | 'resolved' | 'all'>('assigned');

  // Delete functionality state
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<'message' | 'conversation' | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);

  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [longPressTimeout, setLongPressTimeout] = useState<NodeJS.Timeout | null>(null);

  // Video/Audio Call state
  const [showVideoCallModal, setShowVideoCallModal] = useState(false);
  const [mediaPermissions, setMediaPermissions] = useState({
    camera: false,
    microphone: false,
    requested: false
  });
  const [permissionsDenied, setPermissionsDenied] = useState(false);
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [callType, setCallType] = useState<'video' | 'audio'>('video');

  // File sharing state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ top: 0, left: 0 });
  
  // Scroll state
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Call notifications state
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [callNotifications, setCallNotifications] = useState<any[]>([]);
  const callNotificationChannelRef = useRef<any>(null);
  
  // Video call state
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [showMeetInfo, setShowMeetInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [meetStartTime, setMeetStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState('00:00');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callDurationInterval = useRef<NodeJS.Timeout | null>(null);

  // Sidebar items for replies section
  const sidebarItems: SidebarItem[] = [
    { id: 'replies', label: 'Replies', icon: <Reply className="w-4 h-4" />, active: true },
    { id: 'posts', label: 'Posts', icon: <FileText className="w-4 h-4" /> },
    { id: 'followups', label: 'FollowUps', icon: <Users className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
    { id: 'drafts', label: 'Sent Messages', icon: <Edit3 className="w-4 h-4" /> }
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
        if (presenceChannelRef.current.cleanup) {
          presenceChannelRef.current.cleanup();
        }
        if (presenceChannelRef.current.channel) {
          supabase.removeChannel(presenceChannelRef.current.channel);
        }
      }
    };
  }, [user]);

  const fetchTeamMembers = async () => {
    console.log('🔍 Fetching team members for user:', user?.email);
    try {
      // Step 1: Get current user's team invite IDs
      const { data: userTeams, error: userTeamError } = await supabase
        .from('team_members')
        .select('team_invite_id')
        .eq('user_id', user?.id);
      
      console.log('📋 User teams found:', userTeams?.length || 0, userTeams);

      if (userTeamError) {
        console.error('Error fetching user teams:', userTeamError);
        return;
      }

      if (!userTeams || userTeams.length === 0) {
        setTeamMembers([]);
        return;
      }

      // Step 2: Get all team members from the same teams
      const teamInviteIds = userTeams.map(t => t.team_invite_id);
      const { data: allTeamMembers, error: teamError } = await supabase
        .from('team_members')
        .select('user_id, team_invite_id')
        .in('team_invite_id', teamInviteIds);

      if (teamError) {
        console.error('Error fetching team members:', teamError);
        return;
      }

      if (!allTeamMembers || allTeamMembers.length === 0) {
        console.log('⚠️ No team members found in any teams');
        setTeamMembers([]);
        return;
      }
      
      console.log('👥 All team members found:', allTeamMembers.length);

      // Step 3: Get all unique user IDs from the team memberships
      const allUserIds = new Set<string>();
      allTeamMembers.forEach((membership: any) => {
        if (membership.user_id) allUserIds.add(membership.user_id);
      });

      // Step 4: Get profile information for all these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, name, avatar_url')
        .in('id', Array.from(allUserIds));

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      // Step 5: Create team members list
      const members: TeamMember[] = [];
      const memberIds = new Set<string>();

      if (profiles) {
        profiles.forEach((profile: any) => {
          if (!memberIds.has(profile.id) && profile.id !== user?.id) {
            memberIds.add(profile.id);
            // Since we don't have admin info, treat all as regular members
            const isAdmin = false;
            
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

      console.log('✅ Team members set:', members.length, members.map(m => m.name));
      setTeamMembers(members);
    } catch (error) {
      console.error('❌ Error fetching team members:', error);
    }
  };

  // Setup real-time presence tracking
  const setupPresence = () => {
    if (!user?.id) return;
    
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id
        }
      }
    });

    // Track current user's presence
    channel
      .on('presence', { event: 'sync' }, () => {
        console.log('Presence sync triggered');
        const state = channel.presenceState();
        const onlineUserIds = new Set<string>();
        
        Object.keys(state).forEach(userId => {
          if (state[userId] && state[userId].length > 0) {
            onlineUserIds.add(userId);
          }
        });
        
        console.log('Online users updated:', onlineUserIds);
        setOnlineUsers(onlineUserIds);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key);
        setOnlineUsers(prev => new Set([...prev, key]));
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key);
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          updated.delete(key);
          return updated;
        });
      })
      .subscribe(async (status) => {
        console.log('Presence subscription status:', status);
        if (status === 'SUBSCRIBED') {
          // Track this user as online
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: user.id,
            status: 'online'
          });
          console.log('Started tracking presence for user:', user.id);
        }
      });

    // Clean up on browser close/beforeunload
    const handleBeforeUnload = async () => {
      console.log('Browser closing, untracking presence');
      await channel.untrack();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Also untrack when page becomes hidden (mobile/tab switching)
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        console.log('Page hidden, untracking presence');
        await channel.untrack();
      } else {
        console.log('Page visible, tracking presence again');
        await channel.track({
          online_at: new Date().toISOString(),
          user_id: user.id,
          status: 'online'
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    presenceChannelRef.current = {
      channel,
      cleanup: () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
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
          await selectChannelWithMembers(newChannel);
        }
      }
    } catch (error) {
      console.error('Failed to create channel:', error);
    } finally {
      setCreatingChannel(false);
    }
  };

  // Handle adding members to channel
  const handleAddMembers = async () => {
    if (selectedChannel && selectedMembers.length > 0) {
      try {
        console.log('Adding members to channel:', selectedChannel.id, selectedMembers);
        
        // Add members to the channel in the database
        const success = await addChannelMembers(selectedChannel.id, selectedMembers);
        
        if (success) {
          console.log('Members added successfully');
          
          // Update local state optimistically
          const membersToAdd = teamMembers.filter(member => selectedMembers.includes(member.id));
          const updatedChannel = {
            ...selectedChannel,
            members: [...(selectedChannel.members || []), ...membersToAdd],
            memberCount: (selectedChannel.memberCount || 0) + selectedMembers.length
          };
          
          setSelectedChannel(updatedChannel);
          
          // Reset selection and close modal
          setSelectedMembers([]);
          setShowAddMembersModal(false);
        } else {
          console.error('Failed to add members to channel');
          // You could add a toast notification here
        }
      } catch (error) {
        console.error('Error adding members:', error);
      }
    }
  };

  // Helper function to select a channel and load its members
  const selectChannelWithMembers = async (channel: any, loadMessages = false) => {
    try {
      // Load channel members
      const members = await loadChannelMembers(channel.id);
      
      // Create the selected channel object with members
      const selectedChannelData = {
        id: channel.id,
        name: channel.name,
        type: channel.channel_type as 'text' | 'voice',
        description: channel.description || undefined,
        memberCount: channel.member_count || 1,
        members: members.map(member => ({
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
          role: member.role as 'admin' | 'member'
        }))
      };
      
      setSelectedChannel(selectedChannelData);
      
      if (loadMessages) {
        await loadChannelMessages(channel.id);
      }
      
      console.log('Selected channel with members:', selectedChannelData);
    } catch (error) {
      console.error('Failed to load channel members:', error);
      // Fallback to basic channel selection without members
      setSelectedChannel({
        id: channel.id,
        name: channel.name,
        type: channel.channel_type as 'text' | 'voice',
        description: channel.description || undefined,
        memberCount: channel.member_count || 1
      });
    }
  };

  // Notification functions
  const addNotification = (type: string, message: string, fromUser: string) => {
    const newNotification = {
      id: Date.now(),
      type,
      message,
      fromUser,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    setUnreadNotificationCount(prev => prev + 1);
  };

  const markNotificationAsRead = (notificationId: number) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
    setUnreadNotificationCount(prev => Math.max(0, prev - 1));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
    setUnreadNotificationCount(0);
  };

  const deleteNotification = (notificationId: number) => {
    setNotifications(prev => prev.filter(notification => notification.id !== notificationId));
    // Also decrease unread count if the notification was unread
    const notificationToDelete = notifications.find(n => n.id === notificationId);
    if (notificationToDelete && !notificationToDelete.read) {
      setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    }
  };

  // Transform direct conversations to direct messages format
  console.log('🔍 Debug directConversations:', directConversations);
  
  // Get users from existing conversations
  const conversationUsers: DirectMessage[] = directConversations
    .map(conversation => {
      console.log('🔍 Processing conversation:', conversation);
      
      // Get the other user in the conversation (not the current user)
      const otherUserId = conversation.user1_id === user?.id ? conversation.user2_id : conversation.user1_id;
      const otherUserProfile = conversation.user1_id === user?.id ? conversation.user2_profile : conversation.user1_profile;
      
      console.log('🔍 Other user ID:', otherUserId);
      console.log('🔍 Other user profile:', otherUserProfile);
      
      return {
        id: otherUserId,
        name: otherUserProfile?.full_name || otherUserProfile?.name || otherUserProfile?.email || 'Unknown User',
        status: getMemberStatus(otherUserId) as 'online' | 'offline',
        avatar: otherUserProfile?.avatar_url || '',
        lastMessage: '',
        unread: false
      };
    })
    .filter(dm => dm.id !== user?.id); // Extra safety to exclude current user

  // Get team members who don't have existing conversations
  const teamMemberDirectMessages: DirectMessage[] = teamMembers
    .filter(member => 
      member.id !== user?.id && // Exclude current user
      !conversationUsers.some(convUser => convUser.id === member.id) // Exclude users with existing conversations
    )
    .map(member => ({
      id: member.id,
      name: member.name || member.email || 'Unknown User',
      status: getMemberStatus(member.id) as 'online' | 'offline',
      avatar: member.avatar || '',
      lastMessage: '',
      unread: false
    }));

  // Combine both conversation users and team members
  const availableDirectMessages: DirectMessage[] = [...conversationUsers, ...teamMemberDirectMessages];

  console.log('👥 Team members loaded:', teamMembers.length, teamMembers.map(tm => tm.name));
  console.log('💬 Conversation users:', conversationUsers.length, conversationUsers.map(cu => cu.name));
  console.log('🆕 Team member direct messages:', teamMemberDirectMessages.length, teamMemberDirectMessages.map(tmdm => tmdm.name));
  console.log('📱 Available direct messages:', availableDirectMessages.length, availableDirectMessages.map(dm => dm.name));

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

  // Auto-select first channel when opening posts section
  useEffect(() => {
    console.log('Auto-select channel effect triggered:', { activeSidebarItem, selectedChannel, dbChannels });
    if (activeSidebarItem === 'posts' && !selectedChannel && dbChannels.length > 0) {
      console.log('Auto-selecting first channel for posts:', dbChannels[0]);
      selectChannelWithMembers(dbChannels[0]);
      setActiveSidebarItem('posts');
    }
  }, [activeSidebarItem, selectedChannel, dbChannels]);

  // Load posts when navigating to main posts page
  useEffect(() => {
    console.log('Main posts page effect triggered:', { activeSidebarItem, selectedChannel });
    if (activeSidebarItem === 'posts' && selectedChannel) {
      console.log('Loading posts for main posts page:', selectedChannel.id);
      loadChannelPosts(selectedChannel.id);
    }
  }, [activeSidebarItem, selectedChannel, loadChannelPosts]);

  // Load replies when replies tab is active
  useEffect(() => {
    const loadReplies = async () => {
      if (activeSidebarItem === 'replies') {
        console.log('Loading replies for replies tab');
        try {
          const [unread, read] = await Promise.all([
            getUnreadReplies(),
            getReadReplies()
          ]);
          setUnreadReplies(unread);
          setReadReplies(read);
        } catch (error) {
          console.error('Failed to load replies:', error);
        }
      }
    };

    loadReplies();
  }, [activeSidebarItem, getUnreadReplies, getReadReplies]);

  // Load sent messages when drafts tab is active
  useEffect(() => {
    const loadSentMessages = async () => {
      if (activeSidebarItem === 'drafts') {
        console.log('Loading sent messages for drafts tab');
        try {
          const sent = await getSentMessages();
          setSentMessages(sent);
          console.log('Sent messages loaded:', sent.length);
        } catch (error) {
          console.error('Failed to load sent messages:', error);
        }
      }
    };

    loadSentMessages();
  }, [activeSidebarItem, getSentMessages]);

  // Load received messages when a specific user is selected
  useEffect(() => {
    const loadReceivedMessages = async () => {
      if (selectedSentByUser && activeSidebarItem === 'drafts') {
        console.log('Loading received messages from user:', selectedSentByUser);
        try {
          const received = await getReceivedMessagesFrom(selectedSentByUser);
          setReceivedMessages(received);
          console.log('Received messages loaded:', received.length);
        } catch (error) {
          console.error('Failed to load received messages:', error);
        }
      } else if (!selectedSentByUser) {
        // Clear received messages when no user is selected
        setReceivedMessages([]);
      }
    };

    loadReceivedMessages();
  }, [selectedSentByUser, activeSidebarItem, user]);

  // Handle clicking outside the sent by dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSentByDropdown && !(event.target as Element).closest('.relative')) {
        setShowSentByDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSentByDropdown]);

  // Load notifications from localStorage on component mount
  useEffect(() => {
    const savedNotifications = localStorage.getItem('chatNotifications');
    const savedUnreadCount = localStorage.getItem('chatUnreadCount');
    
    if (savedNotifications) {
      try {
        const parsedNotifications = JSON.parse(savedNotifications);
        setNotifications(parsedNotifications);
      } catch (error) {
        console.error('Error parsing saved notifications:', error);
      }
    }
    
    if (savedUnreadCount) {
      try {
        const parsedCount = parseInt(savedUnreadCount, 10);
        setUnreadNotificationCount(parsedCount);
      } catch (error) {
        console.error('Error parsing saved unread count:', error);
      }
    }
  }, []);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('chatNotifications', JSON.stringify(notifications));
  }, [notifications]);

  // Save unread count to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('chatUnreadCount', unreadNotificationCount.toString());
  }, [unreadNotificationCount]);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNotifications && !(event.target as Element).closest('.relative')) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Get all unique users (merge team members and direct messages, removing duplicates)
  const getAllUniqueUsers = () => {
    const allUsers = [...teamMembers, ...availableDirectMessages];
    const uniqueUsers = allUsers.reduce((acc: typeof teamMembers, current) => {
      if (!acc.find(user => user.id === current.id)) {
        acc.push(current);
      }
      return acc;
    }, []);
    return uniqueUsers;
  };

  // Get messages received from a specific user
  const getReceivedMessagesFrom = async (fromUserId: string) => {
    if (!user) return [];

    try {
      let allReceivedMessages: any[] = [];

      // Get direct messages sent by the specific user to current user (without foreign key joins)
      const { data: directMessages, error: directError } = await supabase
        .from('direct_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          created_at,
          updated_at
        `)
        .eq('is_deleted', false)
        .eq('sender_id', fromUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!directError && directMessages) {
        // Filter for conversations where current user is a participant
        const { data: userConversations } = await supabase
          .from('direct_conversations')
          .select('id')
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

        const userConversationIds = new Set(userConversations?.map(c => c.id) || []);
        
        const relevantDirectMessages = directMessages.filter(msg => 
          userConversationIds.has(msg.conversation_id)
        );

        // Get sender profile separately if we have messages
        let senderProfile = null;
        if (relevantDirectMessages.length > 0) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', fromUserId)
            .single();
          senderProfile = profile;
        }

        allReceivedMessages = [...allReceivedMessages, ...relevantDirectMessages.map(msg => ({
          ...msg,
          message_type: 'direct',
          sender_name: senderProfile?.full_name || senderProfile?.email || 'Unknown',
          location_name: 'Direct Message'
        }))];
      }

      // Get channel messages sent by the specific user in channels where current user is a member
      // First get channels where current user is a member
      const { data: userChannels } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user.id);

      if (userChannels && userChannels.length > 0) {
        const channelIds = userChannels.map(uc => uc.channel_id);

        const { data: channelMessages, error: channelError } = await supabase
          .from('channel_messages')
          .select(`
            id,
            channel_id,
            sender_id,
            content,
            created_at,
            updated_at
          `)
          .eq('is_deleted', false)
          .eq('sender_id', fromUserId)
          .in('channel_id', channelIds)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!channelError && channelMessages && channelMessages.length > 0) {
          // Get sender profile and channel names separately
          const [senderProfileResult, channelsResult] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', fromUserId)
              .single(),
            supabase
              .from('channels')
              .select('id, name')
              .in('id', channelIds)
          ]);

          const senderProfile = senderProfileResult.data;
          const channelNamesMap = new Map((channelsResult.data || []).map(ch => [ch.id, ch.name]));

          allReceivedMessages = [...allReceivedMessages, ...channelMessages.map(msg => ({
            ...msg,
            message_type: 'channel',
            sender_name: senderProfile?.full_name || senderProfile?.email || 'Unknown',
            location_name: channelNamesMap.get(msg.channel_id) || 'Unknown Channel'
          }))];
        }
      }

      // Sort all messages by created_at (most recent first)
      allReceivedMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return allReceivedMessages;
    } catch (error) {
      console.error('Failed to get received messages from user:', error);
      return [];
    }
  };

  // Search function for messages (sent or received based on selection)
  const searchSent = (query: string) => {
    // Use received messages if a specific user is selected, otherwise use sent messages
    let filtered = selectedSentByUser ? receivedMessages : sentMessages;
    
    console.log('searchSent called:', {
      selectedSentByUser,
      usingReceivedMessages: !!selectedSentByUser,
      sentMessagesCount: sentMessages.length,
      receivedMessagesCount: receivedMessages.length,
      filteredCount: filtered.length,
      query
    });
    
    // Then apply search query
    if (!query.trim()) return filtered;
    const searchResult = filtered.filter(message => 
      message.content?.toLowerCase().includes(query.toLowerCase()) ||
      message.location_name?.toLowerCase().includes(query.toLowerCase())
    );
    
    console.log('Search result count:', searchResult.length);
    return searchResult;
  };

  // Function to handle marking a reply as read
  const handleMarkReplyAsRead = async (messageId: string) => {
    try {
      await markMessageAsRead(messageId);
      // Refresh replies to update the read/unread lists
      const [unread, read] = await Promise.all([
        getUnreadReplies(),
        getReadReplies()
      ]);
      setUnreadReplies(unread);
      setReadReplies(read);
    } catch (error) {
      console.error('Failed to mark reply as read:', error);
    }
  };

  // Function to navigate to a message
  const handleNavigateToMessage = async (message: any) => {
    try {
      console.log('=== NAVIGATION DEBUG ===');
      console.log('Message object:', message);
      console.log('Message type:', message.message_type);
      console.log('Channel ID:', message.channel_id);
      console.log('Conversation ID:', message.conversation_id);
      console.log('Sender ID:', message.sender_id);
      console.log('Available channels:', dbChannels);
      console.log('Available direct messages:', availableDirectMessages);
      console.log('Current state - selectedChannel:', selectedChannel?.id);
      console.log('Current state - selectedDM:', selectedDM);
      console.log('Current state - activeSidebarItem:', activeSidebarItem);
      
      if (message.message_type === 'direct' || message.conversation_id) {
        console.log('Processing as DIRECT MESSAGE');
        
        if (message.conversation_id) {
          console.log('Setting sidebar to dm and clearing channel selection...');
          setActiveSidebarItem('dm');
          setSelectedChannel(null);
          
          // For sent messages, we need to find the recipient, not the sender
          const recipientId = message.recipient_id || message.sender_id;
          const recipient = availableDirectMessages.find(dm => dm.id === recipientId);
          console.log('Looking for recipient with ID:', recipientId);
          console.log('Found recipient:', recipient);
          
          if (recipient) {
            console.log('Setting selected DM to:', recipient.id);
            setSelectedDM(recipient.id);
            setCurrentConversationId(message.conversation_id);
            console.log('Loading direct messages for conversation:', message.conversation_id);
            await loadDirectMessages(message.conversation_id);
          } else {
            console.log('Recipient not found, loading conversation directly');
            // If we can't find the recipient in available DMs, we still need to set a selectedDM
            // Use the recipient_id or fallback to sender_id
            setSelectedDM(recipientId);
            setCurrentConversationId(message.conversation_id);
            await loadDirectMessages(message.conversation_id);
          }
        }
      } else if (message.message_type === 'channel' || message.channel_id) {
        console.log('Processing as CHANNEL MESSAGE');
        
        if (message.channel_id) {
          console.log('Setting sidebar to channel and clearing DM selection...');
          setActiveSidebarItem('channel');
          setSelectedDM(null);
          
          // Find the channel
          const channel = dbChannels.find(c => c.id === message.channel_id);
          console.log('Looking for channel with ID:', message.channel_id);
          console.log('Found channel:', channel);
          
          if (channel) {
            console.log('Setting selected channel to:', channel);
            setSelectedChannel(channel);
            console.log('Loading channel messages for channel:', message.channel_id);
            await loadChannelMessages(message.channel_id);
          } else {
            console.log('Channel not found in available channels!');
          }
        }
      } else {
        console.log('Unknown message type or missing identifiers');
      }
      
      // Mark as read when navigating
      console.log('Marking message as read...');
      await handleMarkReplyAsRead(message.id);
      console.log('=== NAVIGATION COMPLETE ===');
    } catch (error) {
      console.error('Failed to navigate to message:', error);
    }
  };

  // Get current messages based on selected view
  const currentMessages = selectedChannel 
    ? channelMessages[selectedChannel.id] || []
    : (currentConversationId ? directMessages[currentConversationId] || [] : []);

  console.log('currentMessages:', currentMessages);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll disabled - users can manually scroll
  // useEffect(() => {
  //   scrollToBottom();
  // }, [currentMessages]);

  // TEMPORARILY DISABLED: Auto-mark channel messages as read when viewing
  // useEffect(() => {
  //   if (selectedChannel && activeSidebarItem === 'chat' && currentMessages.length > 0) {
  //     // Mark channel messages as read when viewing them
  //     markChannelMessagesAsRead(selectedChannel.id);
  //   }
  // }, [selectedChannel, activeSidebarItem, currentMessages.length, markChannelMessagesAsRead]);

  // TEMPORARILY DISABLED: Auto-mark messages as read when viewing conversations
  // This was causing navigation issues due to RLS policy errors
  // Will re-enable after navigation is working properly
  
  // // Auto-mark direct messages as read when viewing a DM conversation
  // useEffect(() => {
  //   if (currentConversationId && !selectedChannel && activeSidebarItem === 'chat' && currentMessages.length > 0) {
  //     console.log('Auto-marking direct messages as read for conversation:', currentConversationId);
  //     // Mark direct messages as read when viewing them
  //     markDirectMessagesAsRead(currentConversationId);
  //   }
  // }, [currentConversationId, selectedChannel, activeSidebarItem, currentMessages.length, markDirectMessagesAsRead]);

  // // Auto-mark channel messages as read when viewing a channel
  // useEffect(() => {
  //   if (selectedChannel && !selectedDM && activeSidebarItem === 'chat' && currentMessages.length > 0) {
  //     console.log('Auto-marking channel messages as read for channel:', selectedChannel.id);
  //     // Mark channel messages as read when viewing them
  //     markChannelMessagesAsRead(selectedChannel.id);
  //   }
  // }, [selectedChannel?.id, selectedDM, activeSidebarItem, currentMessages.length, markChannelMessagesAsRead]);

  // Handle post reaction
  const handleReaction = async (postId: string, reactionType: 'like' | 'love' | 'laugh' | 'sad' | 'angry') => {
    const success = await togglePostReaction(postId, reactionType);
    if (success) {
      // Reload reactions for this post immediately
      const reactions = await getPostReactions(postId);
      setPostReactions(prev => ({
        ...prev,
        [postId]: reactions
      }));

      // Also refresh activity reactions if we're on that tab
      if (activeSidebarItem === 'activity' && activityTab === 'reactions') {
        loadActivityReactions();
      }
    }
  };

  // Handle adding comment
  const handleAddComment = async (postId: string) => {
    const content = commentInputs[postId];
    if (!content?.trim()) return;

    const comment = await addPostComment(postId, content.trim());
    if (comment) {
      // Clear input
      setCommentInputs(prev => ({
        ...prev,
        [postId]: ''
      }));
      
      // Reload comments for this post
      const comments = await getPostComments(postId);
      setPostComments(prev => ({
        ...prev,
        [postId]: comments
      }));
    }
  };

  // Toggle comments visibility
  const toggleComments = async (postId: string) => {
    setShowComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
    
    // Load comments if showing for the first time
    if (!showComments[postId] && !postComments[postId]) {
      const comments = await getPostComments(postId);
      setPostComments(prev => ({
        ...prev,
        [postId]: comments
      }));
    }
  };

  // Load reactions and comments for posts when they change
  useEffect(() => {
    const loadPostData = async () => {
      if (selectedChannel && channelPosts[selectedChannel.id]) {
        const posts = channelPosts[selectedChannel.id];
        
        // Load reactions for all posts (always refresh to get latest reactions)
        for (const post of posts) {
          const reactions = await getPostReactions(post.id);
          setPostReactions(prev => ({
            ...prev,
            [post.id]: reactions
          }));
        }
      }
    };
    
    loadPostData();
  }, [selectedChannel, channelPosts]); // Removed getPostReactions to avoid dependency issues

  // Load activity reactions for current user's posts
  const loadActivityReactions = async () => {
    if (!user) {
      return;
    }


    try {
      // First, get all posts by the current user
      const { data: userPosts, error: postsError } = await supabase
        .from('posts')
        .select('id, title, content, created_at, channel_id')
        .eq('author_id', user.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (postsError) {
        console.error('Error fetching user posts:', postsError);
        return;
      }

      console.log('Found user posts:', userPosts?.length || 0);

      if (!userPosts || userPosts.length === 0) {
        setActivityReactions([]);
        return;
      }

      const postIds = userPosts.map(post => post.id);

      // Get all reactions on user's posts (excluding user's own reactions)
      const { data: reactions, error: reactionsError } = await supabase
        .from('post_reactions')
        .select('id, post_id, user_id, reaction_type, created_at')
        .in('post_id', postIds)
        .neq('user_id', user.id) // Exclude current user's own reactions
        .order('created_at', { ascending: false });

      if (reactionsError) {
        console.error('Error fetching activity reactions:', reactionsError);
        return;
      }


      if (!reactions || reactions.length === 0) {
        setActivityReactions([]);
        return;
      }

      // Get user profiles for reaction authors
      const userIds = [...new Set(reactions.map(r => r.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles for activity reactions:', profilesError);
      }

      // Get channel names
      const channelIds = [...new Set(userPosts.map(p => p.channel_id).filter(Boolean))];
      const { data: channels, error: channelsError } = await supabase
        .from('channels')
        .select('id, name')
        .in('id', channelIds);

      if (channelsError) {
        console.error('Error fetching channels for activity reactions:', channelsError);
      }

      // Merge all data
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const postMap = new Map(userPosts.map(p => [p.id, p]));
      const channelMap = new Map((channels || []).map(c => [c.id, c]));

      const enrichedReactions = reactions.map(reaction => {
        const post = postMap.get(reaction.post_id);
        const profile = profileMap.get(reaction.user_id);
        const channel = post ? channelMap.get(post.channel_id) : null;

        return {
          ...reaction,
          post,
          profile,
          channel
        };
      });

      setActivityReactions(enrichedReactions);
    } catch (err) {
      console.error('Failed to load activity reactions:', err);
    }
  };

  // Load activity reactions when activity tab is opened
  useEffect(() => {
    if (activeSidebarItem === 'activity' && activityTab === 'reactions') {
      loadActivityReactions();
    }
  }, [activeSidebarItem, activityTab, user]);

  // Load tasks when followups tab is active
  useEffect(() => {
    if (activeSidebarItem === 'followups' && user) {
      if (followupsFilter === 'assigned') {
        loadAssignedTasks();
      } else if (followupsFilter === 'resolved') {
        loadResolvedTasks();
      }
    }
  }, [activeSidebarItem, followupsFilter, user]);

  // Close dropdown and context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDeleteMenu) {
        setShowDeleteMenu(false);
      }
      if (showContextMenu) {
        setShowContextMenu(false);
        setSelectedMessage(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDeleteMenu, showContextMenu]);

  // Real-time reaction updates using Supabase subscriptions
  useEffect(() => {
    if (!selectedChannel || !channelPosts[selectedChannel.id]) return;

    const posts = channelPosts[selectedChannel.id];
    const postIds = posts.map(post => post.id);

    // Subscribe to real-time changes on post_reactions table
    console.log('Setting up real-time subscription for posts:', postIds);
    const reactionSubscription = supabase
      .channel(`post-reactions-${selectedChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'post_reactions',
          filter: `post_id=in.(${postIds.join(',')})`
        },
        async (payload) => {
          console.log('🔥 REAL-TIME REACTION CHANGE DETECTED:', payload);
          
          // Refresh reactions for the affected post
          const postId = payload.new?.post_id || payload.old?.post_id;
          if (postId) {
            const reactions = await getPostReactions(postId);
            setPostReactions(prev => ({
              ...prev,
              [postId]: reactions
            }));
            
            // Also refresh activity reactions if on that tab
            if (activeSidebarItem === 'activity' && activityTab === 'reactions') {
              loadActivityReactions();
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
      });

    // More aggressive periodic refresh to ensure cross-user sync
    const refreshInterval = setInterval(async () => {
      for (const post of posts) {
        const reactions = await getPostReactions(post.id);
        setPostReactions(prev => ({
          ...prev,
          [post.id]: reactions
        }));
      }
    }, 5000); // Refresh every 5 seconds for testing

    return () => {
      supabase.removeChannel(reactionSubscription);
      clearInterval(refreshInterval);
    };
  }, [selectedChannel, channelPosts, activeSidebarItem, activityTab]);

  // Cleanup media stream when component unmounts or modal closes
  useEffect(() => {
    return () => {
      stopMediaStream();
    };
  }, []);

  // Check initial media permissions
  useEffect(() => {
    checkMediaPermissions();
  }, []);

  // Set up call notifications
  useEffect(() => {
    if (user) {
      setupCallNotifications();
    }
    
    return () => {
      if (callNotificationChannelRef.current) {
        callNotificationChannelRef.current.unsubscribe();
      }
    };
  }, [user]);

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

  // Media permission functions
  const requestMediaPermissions = async (type: 'video' | 'audio' = 'video'): Promise<{
    success: boolean;
    audioOnly?: boolean;
    error?: string;
  }> => {
    try {
      setMediaPermissions(prev => ({ ...prev, requested: true }));

      const constraints = type === 'video' 
        ? { video: true, audio: true }
        : { video: false, audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Check what permissions were actually granted
      const tracks = stream.getTracks();
      const hasVideo = tracks.some(track => track.kind === 'video');
      const hasAudio = tracks.some(track => track.kind === 'audio');

      setCurrentStream(stream);
      setMediaPermissions({
        camera: hasVideo,
        microphone: hasAudio,
        requested: true
      });
      setPermissionsDenied(false);

      return {
        success: true,
        audioOnly: !hasVideo && hasAudio
      };
    } catch (error: any) {
      console.error('Media permission error:', error);
      setPermissionsDenied(true);
      setMediaPermissions(prev => ({ ...prev, requested: true }));
      
      return {
        success: false,
        error: error.name === 'NotAllowedError' 
          ? 'Permission denied. Please allow camera/microphone access and try again.'
          : `Failed to access media devices: ${error.message}`
      };
    }
  };

  const stopMediaStream = () => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => {
        track.stop();
      });
      setCurrentStream(null);
      setMediaPermissions({
        camera: false,
        microphone: false,
        requested: false
      });
    }
  };

  const handleVideoCall = async () => {
    if (!selectedDM) return;
    
    setCallType('video');
    setShowVideoCallModal(true);
    
    // Auto-request permissions when modal opens
    await requestMediaPermissions('video');
  };

  const handleAudioCall = async () => {
    if (!selectedDM) return;
    
    setCallType('audio');
    setShowVideoCallModal(true);
    
    // Auto-request permissions when modal opens
    await requestMediaPermissions('audio');
  };

  const checkMediaPermissions = async () => {
    try {
      const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const micPermissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      setMediaPermissions(prev => ({
        ...prev,
        camera: permissions.state === 'granted',
        microphone: micPermissions.state === 'granted'
      }));
    } catch (error) {
      console.log('Permission API not supported');
    }
  };

  // File handling functions
  const getFileIcon = (fileType: string): JSX.Element => {
    if (fileType.startsWith('image/')) return <Image className="w-8 h-8 text-green-500" />;
    if (fileType.startsWith('video/')) return <Video className="w-8 h-8 text-red-500" />;
    if (fileType.startsWith('audio/')) return <Mic className="w-8 h-8 text-blue-500" />;
    if (fileType.includes('pdf')) return <FileText className="w-8 h-8 text-red-600" />;
    if (fileType.includes('document') || fileType.includes('msword') || fileType.includes('wordprocessingml')) 
      return <FileText className="w-8 h-8 text-blue-600" />;
    if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv')) 
      return <FileText className="w-8 h-8 text-green-600" />;
    if (fileType.includes('json')) return <Code className="w-8 h-8 text-purple-500" />;
    return <Paperclip className="w-8 h-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Task Assignment Functions
  const assignTaskToMember = async (taskId: string, memberId: string, taskDescription: string) => {
    try {
      // Create assignment record in database
      const { data, error } = await supabase
        .from('task_assignments')
        .insert({
          task_id: taskId,
          assigned_to: memberId,
          assigned_by: user?.id,
          task_description: taskDescription,
          status: 'assigned',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update local state
      const assignedMember = teamMembers.find(member => member.id === memberId);
      const newTask = {
        id: taskId,
        description: taskDescription,
        assignedTo: assignedMember,
        assignedBy: user,
        status: 'assigned',
        createdAt: new Date()
      };

      setAssignedTasks(prev => [...prev, newTask]);
      console.log('Task assigned successfully:', newTask);
    } catch (error) {
      console.error('Error assigning task:', error);
    }
  };

  const resolveTask = async (taskId: string) => {
    try {
      // Update assignment status in database
      const { error } = await supabase
        .from('task_assignments')
        .update({ 
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('task_id', taskId);

      if (error) throw error;

      // Update local state
      setAssignedTasks(prev => prev.filter(task => task.id !== taskId));
      setResolvedTasks(prev => {
        const resolvedTask = assignedTasks.find(task => task.id === taskId);
        return resolvedTask ? [...prev, { ...resolvedTask, status: 'resolved' }] : prev;
      });

      console.log('Task resolved successfully');
    } catch (error) {
      console.error('Error resolving task:', error);
    }
  };

  const loadAssignedTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('task_assignments')
        .select(`
          *,
          assigned_to_profile:profiles!task_assignments_assigned_to_fkey(id, email, full_name),
          assigned_by_profile:profiles!task_assignments_assigned_by_fkey(id, email, full_name)
        `)
        .eq('assigned_to', user?.id)
        .eq('status', 'assigned');

      if (error) throw error;

      setAssignedTasks(data || []);
    } catch (error) {
      console.error('Error loading assigned tasks:', error);
    }
  };

  const loadResolvedTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('task_assignments')
        .select(`
          *,
          assigned_to_profile:profiles!task_assignments_assigned_to_fkey(id, email, full_name),
          assigned_by_profile:profiles!task_assignments_assigned_by_fkey(id, email, full_name)
        `)
        .eq('assigned_to', user?.id)
        .eq('status', 'resolved');

      if (error) throw error;

      setResolvedTasks(data || []);
    } catch (error) {
      console.error('Error loading resolved tasks:', error);
    }
  };

  // Delete Functions
  const deleteMessage = async (messageId: string) => {
    try {
      // Try direct_messages table first
      let { error } = await supabase
        .from('direct_messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        console.log('Trying messages table...', error.message);
        // Try messages table if direct_messages fails
        const { error: messagesError } = await supabase
          .from('messages')
          .delete()
          .eq('id', messageId);
        
        if (messagesError) {
          console.error('Failed to delete from both tables:', messagesError);
          throw messagesError;
        }
      }

      // Update local state to remove the deleted message
      const conversationId = selectedDM || currentConversationId;
      if (conversationId && directMessages[conversationId]) {
        const updatedMessages = directMessages[conversationId].filter(msg => msg.id !== messageId);
        setDirectMessages(prev => ({
          ...prev,
          [conversationId]: updatedMessages
        }));
      }

      // Also update channel messages if applicable
      if (selectedChannel && channelMessages[selectedChannel.id]) {
        setChannelMessages(prev => ({
          ...prev,
          [selectedChannel.id]: prev[selectedChannel.id].filter(msg => msg.id !== messageId)
        }));
      }

      console.log('Message deleted successfully from database and UI');
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message. Please try again.');
    }
  };

  const deleteConversation = async () => {
    if (!selectedDM) return;
    
    try {
      // Delete all messages in the conversation where current user is sender
      const { error } = await supabase
        .from('direct_messages')
        .delete()
        .eq('sender_id', user?.id)
        .eq('recipient_id', selectedDM);

      if (error) throw error;

      // Clear local state
      setDirectMessages(prev => ({
        ...prev,
        [selectedDM]: []
      }));

      // Optionally navigate away from the conversation
      setSelectedDM(null);

      console.log('Conversation deleted successfully');
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const handleDeleteConfirm = async () => {
    console.log('Delete confirm clicked - Type:', deleteType, 'Message ID:', messageToDelete);
    
    if (deleteType === 'message' && messageToDelete) {
      console.log('Calling deleteMessage...');
      await deleteMessage(messageToDelete);
    } else if (deleteType === 'conversation') {
      console.log('Calling deleteConversation...');
      await deleteConversation();
    }
    
    setShowDeleteConfirm(false);
    setShowDeleteMenu(false);
    setDeleteType(null);
    setMessageToDelete(null);
    
    console.log('Delete confirmation completed');
  };

  // Context Menu Functions
  const showMessageContextMenu = (event: React.MouseEvent, message: any) => {
    event.preventDefault();
    event.stopPropagation();
    
    const x = Math.min(event.clientX, window.innerWidth - 200); // Ensure it fits on screen
    const y = Math.min(event.clientY, window.innerHeight - 150);
    
    setSelectedMessage(message);
    setContextMenuPosition({ x, y });
    setShowContextMenu(true);
  };

  const handleLongPressStart = (event: React.TouchEvent | React.MouseEvent, message: any) => {
    const timeout = setTimeout(() => {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = Math.min(rect.left + rect.width / 2, window.innerWidth - 200);
      const y = Math.min(rect.top + rect.height / 2, window.innerHeight - 150);
      
      setSelectedMessage(message);
      setContextMenuPosition({ x, y });
      setShowContextMenu(true);
    }, 500); // 500ms long press

    setLongPressTimeout(timeout);
  };

  const handleLongPressEnd = () => {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      setLongPressTimeout(null);
    }
  };

  const closeContextMenu = () => {
    setShowContextMenu(false);
    setSelectedMessage(null);
  };

  const handleDeleteFromContext = () => {
    if (selectedMessage) {
      console.log('Delete context clicked for message:', selectedMessage);
      console.log('Message ID:', selectedMessage.id);
      console.log('Selected DM:', selectedDM);
      console.log('Current Conversation ID:', currentConversationId);
      setMessageToDelete(selectedMessage.id);
      setDeleteType('message');
      setShowDeleteConfirm(true);
      closeContextMenu();
    }
  };

  const addReactionToMessage = async (messageId: string, emoji: string) => {
    try {
      // Add reaction to database
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user?.id,
          reaction: emoji,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update local state
      setMessageReactions(prev => {
        const existing = prev[messageId] || [];
        const userReaction = existing.find(r => r.user_id === user?.id);
        
        if (userReaction) {
          // Update existing reaction
          return {
            ...prev,
            [messageId]: existing.map(r => 
              r.user_id === user?.id ? { ...r, reaction: emoji } : r
            )
          };
        } else {
          // Add new reaction
          return {
            ...prev,
            [messageId]: [...existing, { user_id: user?.id, reaction: emoji }]
          };
        }
      });

      closeContextMenu();
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setSelectedFiles(fileArray);
      setShowFilePreview(true);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files) {
      const fileArray = Array.from(files);
      setSelectedFiles(fileArray);
      setShowFilePreview(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const uploadFiles = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return [];
    
    console.log('📁 Starting file upload to Supabase Storage...');
    const uploadedUrls: string[] = [];
    
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check and setup storage automatically
      const storageStatus = await checkAndSetupStorage();
      
      if (!storageStatus.success) {
        console.error('❌ Storage setup failed:', storageStatus.message);
        
        // Don't show alert here - let sendFilesMessage handle it
        // Just use fallback silently
        console.warn('🔄 Using blob URL fallback for all files');
        const fallbackUrls: string[] = [];
        for (const file of selectedFiles) {
          const blobUrl = URL.createObjectURL(file);
          fallbackUrls.push(blobUrl);
        }
        return fallbackUrls;
      }
      
      console.log('✅ Storage setup verified');

      for (const file of selectedFiles) {
        console.log(`⬆️  Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // Create a unique filename with user ID folder structure
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const fileName = `${timestamp}-${file.name}`;
        const filePath = `${user.id}/${fileName}`;
        
        // Upload to Supabase Storage with timeout
        const uploadPromise = supabase.storage
          .from('chat-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        // Add timeout to prevent stuck uploads
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000);
        });

        const { data, error } = await Promise.race([uploadPromise, timeoutPromise]) as any;

        if (error) {
          console.error('❌ Error uploading file:', file.name, error);
          
          // If bucket doesn't exist or permission issues, use blob URL fallback
          if (error.message.includes('bucket') || 
              error.message.includes('not found') || 
              error.message.includes('permission') ||
              error.message.includes('policy')) {
            console.warn('🔄 Falling back to blob URL for:', file.name);
            const blobUrl = URL.createObjectURL(file);
            uploadedUrls.push(blobUrl);
            continue;
          } else {
            // For other errors, skip this file
            console.error('❌ Skipping file due to error:', file.name);
            continue;
          }
        }

        console.log('✅ File uploaded successfully:', file.name);

        // Get public URL for the uploaded file
        const { data: { publicUrl } } = supabase.storage
          .from('chat-files')
          .getPublicUrl(filePath);
        
        console.log('🔗 Public URL generated:', publicUrl);
        uploadedUrls.push(publicUrl);
      }
      
      console.log(`📊 Upload summary: ${uploadedUrls.length}/${selectedFiles.length} files processed`);
      return uploadedUrls;
    } catch (error) {
      console.error('❌ Critical file upload error:', error);
      
      // Fallback to blob URLs if Supabase storage completely fails
      console.warn('🔄 Using blob URL fallback for all files');
      const fallbackUrls: string[] = [];
      for (const file of selectedFiles) {
        const blobUrl = URL.createObjectURL(file);
        fallbackUrls.push(blobUrl);
      }
      return fallbackUrls;
    }
  };

  // Emoji picker functions
  const handleEmojiClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setEmojiPickerPosition({
      top: rect.top - 350, // Position above the button
      left: rect.left
    });
    setShowEmojiPicker(!showEmojiPicker);
  };

  const onEmojiSelect = (emoji: string) => {
    setMessageInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const onEmojiReact = async (messageId: string, emoji: string) => {
    if (!user) return;
    
    setMessageReactions(prev => {
      const messageReacts = prev[messageId] || [];
      const existingReaction = messageReacts.find(r => r.emoji === emoji);
      
      if (existingReaction) {
        // Toggle reaction
        if (existingReaction.users.includes(user.id)) {
          // Remove user's reaction
          existingReaction.count--;
          existingReaction.users = existingReaction.users.filter(id => id !== user.id);
          if (existingReaction.count === 0) {
            return {
              ...prev,
              [messageId]: messageReacts.filter(r => r.emoji !== emoji)
            };
          }
        } else {
          // Add user's reaction
          existingReaction.count++;
          existingReaction.users.push(user.id);
        }
      } else {
        // Create new reaction
        messageReacts.push({
          emoji,
          count: 1,
          users: [user.id]
        });
      }
      
      return {
        ...prev,
        [messageId]: [...messageReacts]
      };
    });
    
    setShowReactionPicker(null);
  };

  // Comprehensive emoji categories
  const emojiCategories = {
    'Recently Used': ['😀', '❤️', '👍', '😂', '🔥', '✨'],
    'Smileys': [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
      '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬'
    ],
    'Gestures': [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟',
      '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎',
      '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'
    ],
    'People': [
      '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓',
      '👴', '👵', '👮', '👷', '💂', '🕵️', '👩‍⚕️', '👨‍⚕️', '👩‍🌾', '👨‍🌾',
      '👩‍🍳', '👨‍🍳', '👩‍🎓', '👨‍🎓', '👩‍🎤', '👨‍🎤', '👩‍🏫', '👨‍🏫', '👩‍🏭', '👨‍🏭'
    ],
    'Animals': [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇'
    ],
    'Food': [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒',
      '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬',
      '🥒', '🌶️', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🍞'
    ],
    'Activities': [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '⛳', '🪁', '🏹',
      '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿'
    ],
    'Objects': [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
      '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
      '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️'
    ],
    'Symbols': [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️',
      '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💬', '👁️‍🗨️', '🗨️'
    ],
    'Flags': [
      '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🇦🇫', '🇦🇽', '🇦🇱',
      '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼'
    ]
  };

  // Current emoji category
  const [currentEmojiCategory, setCurrentEmojiCategory] = useState('Recently Used');

  // Message reaction states
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<{[messageId: string]: {emoji: string; count: number; users: string[]}[]}>({});

  // Close emoji picker and reaction picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker && !(event.target as Element).closest('.emoji-picker-container')) {
        setShowEmojiPicker(false);
      }
      if (showReactionPicker && !(event.target as Element).closest('.reaction-picker') && 
          !(event.target as Element).closest('[title="Add reaction"]')) {
        setShowReactionPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker, showReactionPicker]);

  // Handle scroll detection for scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 100; // 100px threshold
      setShowScrollToBottom(!isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentMessages]);

  // Manual scroll to bottom function
  const scrollToBottomManual = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollToBottom(false);
  };

  // Call notification functions
  const setupCallNotifications = () => {
    if (!user) return;

    // Cleanup existing subscription
    if (callNotificationChannelRef.current) {
      callNotificationChannelRef.current.unsubscribe();
    }

    // Subscribe to incoming call notifications
    const channel = supabase
      .channel('call_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_notifications',
        filter: `receiver_id=eq.${user.id}`
      }, (payload) => {
        console.log('Incoming call notification:', payload.new);
        setIncomingCall(payload.new);
      })
      .on('postgres_changes', {
        event: 'UPDATE', 
        schema: 'public',
        table: 'call_sessions',
        filter: `caller_id=eq.${user.id},receiver_id=eq.${user.id}`
      }, (payload) => {
        console.log('Call session update:', payload.new);
        if (payload.new.status === 'active') {
          setActiveCall(payload.new);
        } else if (payload.new.status === 'ended' || payload.new.status === 'declined') {
          setActiveCall(null);
          setIncomingCall(null);
        }
      })
      .subscribe();

    callNotificationChannelRef.current = channel;
  };

  // Start a call and notify the other user
  const initiateCall = async (type: 'video' | 'audio') => {
    if (!selectedDM || !user || !currentConversationId) return;

    try {
      console.log(`Starting ${type} call with ${selectedDM}`);
      
      // First request permissions
      const permissionResult = await requestMediaPermissions(type);
      if (!permissionResult.success) {
        alert(permissionResult.error);
        return;
      }

      // Create call session using database function
      const { data, error } = await supabase.rpc('start_call', {
        p_receiver_id: selectedDM,
        p_call_type: type,
        p_conversation_id: currentConversationId
      });

      if (error) {
        console.error('Error starting call:', error);
        alert('Failed to start call. Please try again.');
        return;
      }

      console.log('Call started:', data);
      setActiveCall(data);
      setShowVideoCallModal(false);
      
      // Start video call interface with current stream
      if (currentStream) {
        await startVideoCall(currentStream);
      }
      
      // Show caller waiting UI
      console.log(`${type} call started! Waiting for ${availableDirectMessages.find(dm => dm.id === selectedDM)?.name} to answer...`);
      
    } catch (error) {
      console.error('Failed to initiate call:', error);
      alert('Failed to start call. Please try again.');
    }
  };

  // Answer an incoming call
  const answerCall = async (callSessionId: string) => {
    try {
      console.log('Answering call:', callSessionId);
      
      // Request permissions for the call
      const callType = incomingCall?.call_type || 'video';
      const permissionResult = await requestMediaPermissions(callType);
      if (!permissionResult.success) {
        // Decline call if permissions failed
        await declineCall(callSessionId);
        return;
      }

      // Answer the call using database function
      const { data, error } = await supabase.rpc('answer_call', {
        p_call_session_id: callSessionId
      });

      if (error) {
        console.error('Error answering call:', error);
        return;
      }

      console.log('Call answered:', data);
      setActiveCall(data);
      setIncomingCall(null);
      
      // Start video call interface
      if (currentStream) {
        await startVideoCall(currentStream);
      }
      
      // Show active call UI
      console.log(`Call connected! You're now in a ${callType} call.`);
      
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  };

  // Decline a call
  const declineCall = async (callSessionId: string) => {
    try {
      console.log('Declining call:', callSessionId);
      
      await supabase.rpc('end_call', {
        p_call_session_id: callSessionId,
        p_reason: 'declined'
      });

      setIncomingCall(null);
      console.log('Call declined');
      
    } catch (error) {
      console.error('Failed to decline call:', error);
    }
  };

  // End an active call
  const endActiveCall = async () => {
    if (!activeCall) return;

    try {
      console.log('Ending active call:', activeCall.id);
      
      await supabase.rpc('end_call', {
        p_call_session_id: activeCall.id,
        p_reason: 'ended'
      });

      // Stop all media streams and close video call
      stopMediaStream();
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }
      setShowVideoCall(false);
      setLocalStream(null);
      setRemoteStream(null);
      setIsScreenSharing(false);
      setIsVideoMuted(false);
      setIsAudioMuted(false);
      
      // Clear call duration timer
      if (callDurationInterval.current) {
        clearInterval(callDurationInterval.current);
        callDurationInterval.current = null;
      }
      setMeetStartTime(null);
      setCallDuration('00:00');
      
      setActiveCall(null);
      setIncomingCall(null);
      console.log('Call ended');
      
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  };

  // Video call control functions
  const startVideoCall = async (stream: MediaStream) => {
    setLocalStream(stream);
    setShowVideoCall(true);
    setMeetStartTime(new Date());
    
    // Start duration tracking
    if (callDurationInterval.current) {
      clearInterval(callDurationInterval.current);
    }
    
    callDurationInterval.current = setInterval(() => {
      if (meetStartTime) {
        const now = new Date();
        const diff = Math.floor((now.getTime() - meetStartTime.getTime()) / 1000);
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        setCallDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);
    
    // Set up local video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  };

  // Ensure video elements are connected to streams
  useEffect(() => {
    if (localVideoRef.current) {
      // Show screen share if active, otherwise show camera stream
      const streamToShow = isScreenSharing ? screenStream : localStream;
      if (streamToShow) {
        localVideoRef.current.srcObject = streamToShow;
      }
    }
  }, [localStream, screenStream, isScreenSharing]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      // Show screen share in main area if sharing, otherwise show remote stream
      const streamToShow = isScreenSharing ? screenStream : remoteStream;
      if (streamToShow) {
        remoteVideoRef.current.srcObject = streamToShow;
      }
    }
  }, [remoteStream, screenStream, isScreenSharing]);


  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          logicalSurface: true,
          cursor: 'always',
          width: { max: 1920 },
          height: { max: 1080 },
          frameRate: { max: 30 }
        } as any,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      setScreenStream(displayStream);
      setIsScreenSharing(true);

      // For screen sharing, show the screen in the main (remote) video area
      // and show the user's camera in the small local window
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = displayStream;
      }

      // Handle when user stops sharing via browser controls
      displayStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });

    } catch (error) {
      console.error('Error starting screen share:', error);
      alert('Failed to start screen sharing. Please ensure you granted the necessary permissions.');
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);

    // Restore the remote video area to show remote participant (if any)
    // The useEffect hooks will handle updating the video elements properly
  };

  const endCall = () => {
    // Stop all streams
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
    
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }

    // Reset states
    setShowVideoCall(false);
    setIsVideoMuted(false);
    setIsAudioMuted(false);
    setIsScreenSharing(false);
    setCurrentCallSession(null);
  };

  const sendFilesMessage = async () => {
    if (selectedFiles.length === 0) return;
    
    console.log('📤 Starting file upload process...');
    console.log('Selected files:', selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));
    console.log('Current conversation ID:', currentConversationId);
    console.log('Selected DM:', selectedDM);
    console.log('Selected Channel:', selectedChannel?.name);
    
    // Prevent duplicate function calls
    if (uploadingFiles) {
      console.log('⚠️ Upload already in progress, ignoring duplicate call');
      return;
    }
    
    // Ensure upload state is set at the start of this function
    setUploadingFiles(true);
    
    try {
      const uploadedUrls = await uploadFiles();
      
      if (uploadedUrls.length === 0) {
        console.error('❌ No files were uploaded successfully');
        
        // Show detailed storage setup instructions
        const instructions = await getStorageInstructions();
        alert(`Failed to upload files.\n\n${instructions}`);
        return;
      }
      
      console.log('✅ Files uploaded successfully:', uploadedUrls);
      console.log(`📨 Sending ${selectedFiles.length} files to conversation`);
      
      // Send each file as a separate message
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileUrl = uploadedUrls[i];
        
        if (selectedChannel) {
          // For channels, keep the old JSON format for now
          const messageContent = JSON.stringify({
            type: 'file',
            files: [{
              type: 'file',
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileUrl: fileUrl
            }]
          });
          console.log(`Sending file to channel: ${file.name}`);
          await sendChannelMessage(selectedChannel.id, messageContent);
        } else if (selectedDM && currentConversationId) {
          // For direct messages, use new database schema
          console.log(`Sending file to DM conversation ${currentConversationId}: ${file.name}`);
          const success = await sendDirectMessage(
            selectedDM, 
            '', // empty content, filename will be used
            'file',
            fileUrl,
            file.name,
            file.size
          );
          
          if (!success) {
            console.error(`Failed to send file: ${file.name}`);
          }
        } else {
          console.error('No conversation selected for file upload');
        }
      }
      
      // Reload messages to show the new files
      if (currentConversationId) {
        console.log(`Reloading messages for conversation: ${currentConversationId}`);
        await loadDirectMessages(currentConversationId);
      }
      
      // Clear selected files and close modal
      setSelectedFiles([]);
      setShowFilePreview(false);
      
      console.log('✅ All files sent successfully!');
    } catch (error) {
      console.error('❌ Error sending files:', error);
      alert(`❌ Failed to send files: ${error.message}. Please check console for details.`);
      
      // Keep modal open so user can try again
      // setShowFilePreview(false); // Don't close on error
    } finally {
      // Always ensure upload state is reset
      setUploadingFiles(false);
    }
  };

  // Manual storage setup function
  const setupStorageManually = async () => {
    try {
      console.log('🛠️ Attempting manual storage setup...');
      const result = await checkAndSetupStorage();
      
      if (result.success) {
        alert('✅ Storage setup completed! You can now upload files.');
      } else {
        const instructions = await getStorageInstructions();
        alert(`❌ Automatic setup failed.\n\n${instructions}`);
      }
    } catch (error) {
      console.error('❌ Manual setup error:', error);
      const instructions = await getStorageInstructions();
      alert(`❌ Setup failed: ${error.message}\n\n${instructions}`);
    }
  };

  // Helper function to render file from database schema
  const renderFileFromDB = (message: any): JSX.Element => {
    if (!message.file_url || !message.file_name) return <span>File</span>;

    const fileType = message.file_name.split('.').pop()?.toLowerCase() || '';
    const getMimeType = (extension: string): string => {
      const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
        mp4: 'video/mp4', mov: 'video/mov', avi: 'video/avi', mkv: 'video/mkv',
        mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg'
      };
      return mimeTypes[extension] || 'application/octet-stream';
    };
    
    const mimeType = getMimeType(fileType);

    return (
      <div className="max-w-sm">
        {/* Image files with preview */}
        {mimeType.startsWith('image/') ? (
          <div className="bg-gray-50 rounded-lg border p-2">
            <img
              src={message.file_url}
              alt={message.file_name}
              className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.file_url, '_blank')}
            />
            <div className="flex items-center justify-between mt-2 px-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {message.file_name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(message.file_size || 0)}
                </p>
              </div>
              <a
                href={message.file_url}
                download={message.file_name}
                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Download image"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        ) : mimeType.startsWith('video/') ? (
          /* Video files with preview */
          <div className="bg-gray-50 rounded-lg border p-2">
            <video
              src={message.file_url}
              className="w-full h-48 object-cover rounded-lg"
              controls
            />
            <div className="flex items-center justify-between mt-2 px-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {message.file_name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(message.file_size || 0)}
                </p>
              </div>
              <a
                href={message.file_url}
                download={message.file_name}
                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Download video"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        ) : mimeType.startsWith('audio/') ? (
          /* Audio files with player */
          <div className="bg-gray-50 rounded-lg border p-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Download className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {message.file_name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(message.file_size || 0)}
                </p>
              </div>
              <a
                href={message.file_url}
                download={message.file_name}
                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Download audio"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
            <audio
              src={message.file_url}
              className="w-full mt-2"
              controls
            />
          </div>
        ) : (
          /* Other files with icon and download */
          <div className="bg-gray-50 rounded-lg border p-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                {getFileIcon(mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {message.file_name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(message.file_size || 0)}
                </p>
              </div>
              <a
                href={message.file_url}
                download={message.file_name}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title={`Download ${message.file_name}`}
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFileMessage = (content: string): JSX.Element | string => {
    try {
      const parsed = JSON.parse(content);
      
      if (parsed.type === 'file' && parsed.files) {
        return (
          <div className="space-y-3">
            {parsed.files.map((file: any, index: number) => (
              <div key={index} className="max-w-sm">
                {/* Image files with preview */}
                {file.fileType.startsWith('image/') ? (
                  <div className="bg-gray-50 rounded-lg border p-2">
                    <img
                      src={file.fileUrl}
                      alt={file.fileName}
                      className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(file.fileUrl, '_blank')}
                    />
                    <div className="flex items-center justify-between mt-2 px-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {file.fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.fileSize)}
                        </p>
                      </div>
                      <a
                        href={file.fileUrl}
                        download={file.fileName}
                        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Download image"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ) : file.fileType.startsWith('video/') ? (
                  /* Video files with preview */
                  <div className="bg-gray-50 rounded-lg border p-2">
                    <video
                      src={file.fileUrl}
                      className="w-full h-48 object-cover rounded-lg"
                      controls
                    />
                    <div className="flex items-center justify-between mt-2 px-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {file.fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.fileSize)}
                        </p>
                      </div>
                      <a
                        href={file.fileUrl}
                        download={file.fileName}
                        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Download video"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ) : file.fileType.startsWith('audio/') ? (
                  /* Audio files with player */
                  <div className="bg-gray-50 rounded-lg border p-3">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <Mic className="w-8 h-8 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.fileSize)}
                        </p>
                        <audio
                          src={file.fileUrl}
                          controls
                          className="w-full mt-2"
                        />
                      </div>
                      <a
                        href={file.fileUrl}
                        download={file.fileName}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download audio"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ) : (
                  /* Other files */
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg border">
                    <div className="flex-shrink-0 mr-3">
                      {getFileIcon(file.fileType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.fileSize)}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Open file"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      <a
                        href={file.fileUrl}
                        download={file.fileName}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }
    } catch {
      // If not a file message, return as regular text
    }
    
    return content;
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
    <div className="h-screen w-full flex bg-gray-50 -mx-3 -my-4 sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8 overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-72 bg-gray-100 border-r border-gray-200 flex flex-col h-screen overflow-hidden">
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
        <div className="flex-1 flex flex-col overflow-hidden h-full">
          {/* Sidebar Navigation */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-0">
            <div className="py-2 flex-shrink-0">
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
            <div className="px-2 py-3 border-t border-gray-200 flex-shrink-0">
              <div className="max-h-64 overflow-y-auto" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
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
                        selectChannelWithMembers(channel, true);
                        setSelectedDM(null);
                        setActiveSidebarItem('channel');
                      }}
                    >
                      <Hash className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate flex-1 text-left">{channel.name}</span>
                      {(channel as any).locked && <Lock className="w-3 h-3 text-gray-400" />}
                    </button>
                  ))}
                </div>
              )}
              </div>
            </div>

            {/* Direct Messages Section */}
            <div className="px-2 py-3 border-t border-gray-200 flex-1 flex flex-col min-h-0 h-0">
              <div className="px-2 py-1 text-xs font-semibold text-gray-600 mb-1 flex-shrink-0">DIRECT MESSAGES</div>
              <div className="space-y-0.5 flex-1 overflow-y-auto min-h-0" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
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
              </div>
            </div>
            </div>
          </div>

        {/* Bottom User Section */}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col bg-white h-screen overflow-hidden">
        {/* Main Content - Chat Interface */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Content Area */}
          {activeSidebarItem === 'channel' && selectedChannel ? (
            /* Channel View */
            <div className="flex-1 flex flex-col bg-white">
              {/* Channel Header */}
              <div className="border-b border-gray-200 bg-white relative">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Hash className="w-4 h-4 text-gray-500" />
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">{selectedChannel.name}</h2>
                      <p className="text-xs text-gray-500">
                        {selectedChannel.memberCount || 0} members • {selectedChannel.description || 'Channel'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => setShowAddMembersModal(true)}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Add members"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors relative"
                    >
                      <Bell className="w-4 h-4" />
                      {unreadNotificationCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                          {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                        </span>
                      )}
                    </button>
                    <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute top-full right-4 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                        {unreadNotificationCount > 0 && (
                          <button
                            onClick={markAllNotificationsAsRead}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => markNotificationAsRead(notification.id)}
                            className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                              !notification.read ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`w-2 h-2 rounded-full mt-2 ${!notification.read ? 'bg-blue-500' : 'bg-gray-300'}`} />
                              <div className="flex-1">
                                <p className="text-sm text-gray-900">{notification.message}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className="text-xs text-gray-500">{notification.fromUser}</span>
                                  <span className="text-xs text-gray-400">
                                    {new Date(notification.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Delete notification"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center">
                          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">No notifications yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Channel/Posts Tabs */}
                <div className="px-4 flex space-x-4">
                  <button
                    onClick={() => setChannelView('channel')}
                    className={`py-2 text-xs font-medium border-b-2 transition-colors ${
                      channelView === 'channel'
                        ? 'text-gray-900 border-gray-900'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    Channel
                  </button>
                  <button
                    onClick={() => setChannelView('posts')}
                    className={`py-2 text-xs font-medium border-b-2 transition-colors ${
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
                  <div className="flex-1 overflow-y-auto p-4">
                    {selectedChannel && channelMessages[selectedChannel.id]?.length > 0 ? (
                      <div className="space-y-3">
                        {channelMessages[selectedChannel.id].map((message) => (
                          <div key={message.id} className="flex items-start space-x-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                              {message.sender_name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-sm font-semibold text-gray-900">{message.sender_name}</span>
                                <span className="text-xs text-gray-500">{formatTime(new Date(message.created_at))}</span>
                                {message.is_edited && <span className="text-xs text-gray-400">(edited)</span>}
                              </div>
                              <div className="text-sm text-gray-800">{message.content}</div>


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
                        <h3 className="text-base font-semibold text-gray-900 mb-2">
                          Welcome to #{selectedChannel.name}
                        </h3>
                        <p className="text-gray-600 max-w-md">
                          This is the beginning of the #{selectedChannel.name} channel.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="border-t border-gray-200 bg-white p-2">
                    <div className="bg-white border border-gray-300 rounded-lg">
                      <div className="flex items-start p-2">
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                          placeholder={`Message #${selectedChannel.name}`}
                          className="flex-1 text-gray-900 placeholder-gray-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center justify-between px-2 pb-1">
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
                          <button 
                            onClick={handleEmojiClick}
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                            title="Add emoji"
                          >
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
                          className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
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
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-start space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
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
                              rows={2}
                              className="w-full text-gray-900 placeholder-gray-500 focus:outline-none resize-none border-0"
                            />
                          </div>
                          <div className="border-t border-gray-200 px-3 py-2 flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                                <Plus className="w-4 h-4" />
                              </button>
                              <div className="h-4 w-px bg-gray-300 mx-1" />
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
                              <button 
                                onClick={handleEmojiClick}
                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                title="Add emoji"
                              >
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
                              className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
                  <div className="flex-1 p-4">
                    {selectedChannel && channelPosts[selectedChannel.id]?.length > 0 ? (
                      channelPosts[selectedChannel.id].map((post: any) => (
                        <div key={post.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                          <div className="flex items-start space-x-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                              {(post.author_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="font-semibold text-sm text-gray-900">{post.author_name || 'Unknown'}</span>
                                <span className="text-xs text-gray-500">
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
                                <h3 className="text-base font-semibold text-gray-900 mb-2">
                                  {post.title}
                                </h3>
                              )}
                              
                              <div className="text-sm text-gray-800 space-y-2">
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
                              <div className="mt-4 pt-3 border-t border-gray-100">
                                {/* Reactions */}
                                <div className="flex items-center space-x-1 mb-3">
                                  <button 
                                    onClick={() => handleReaction(post.id, 'like')}
                                    className="flex items-center px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
                                    title="Like"
                                  >
                                    <ThumbsUp className="w-4 h-4 text-gray-500" />
                                  </button>
                                  <button 
                                    onClick={() => handleReaction(post.id, 'love')}
                                    className="flex items-center px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
                                    title="Love"
                                  >
                                    <Heart className="w-4 h-4 text-red-500" />
                                  </button>
                                  <button 
                                    onClick={() => handleReaction(post.id, 'laugh')}
                                    className="flex items-center px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
                                    title="Laugh"
                                  >
                                    <Laugh className="w-4 h-4 text-yellow-500" />
                                  </button>
                                  <button 
                                    onClick={() => handleReaction(post.id, 'sad')}
                                    className="flex items-center px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
                                    title="Sad"
                                  >
                                    <Frown className="w-4 h-4 text-blue-500" />
                                  </button>
                                  <button 
                                    onClick={() => handleReaction(post.id, 'angry')}
                                    className="flex items-center px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
                                    title="Angry"
                                  >
                                    <Angry className="w-4 h-4 text-red-600" />
                                  </button>
                                  <button 
                                    onClick={() => toggleComments(post.id)}
                                    className="flex items-center px-2 py-1 rounded-full hover:bg-gray-100 transition-colors ml-4"
                                  >
                                    <MessageSquare className="w-4 h-4 mr-1" />
                                    <span className="text-sm">Comment</span>
                                  </button>
                                  <span className="text-sm text-gray-500 ml-4">
                                    {post.view_count || 0} views
                                  </span>
                                </div>

                                {/* Reaction Summary */}
                                {postReactions[post.id] && Array.isArray(postReactions[post.id]) && postReactions[post.id].length > 0 && (
                                  <div className="flex items-center space-x-2 mb-3 text-sm text-gray-600">
                                    {['like', 'love', 'laugh', 'sad', 'angry'].map(reactionType => {
                                      const count = postReactions[post.id].filter((r: any) => (r.reaction_type || r.type) === reactionType).length;
                                      if (count === 0) return null;
                                      
                                      const icons = {
                                        like: <span>👍</span>,
                                        love: <span>❤️</span>, 
                                        laugh: <span>😂</span>,
                                        sad: <span>😢</span>,
                                        angry: <span>😡</span>
                                      };
                                      
                                      return (
                                        <span key={reactionType} className="flex items-center space-x-1 bg-gray-200 px-2 py-1 rounded">
                                          {icons[reactionType as keyof typeof icons]}
                                          <span className="font-bold">{count}</span>
                                          <span className="text-xs">({reactionType})</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}


                                {/* Comment Input */}
                                {showComments[post.id] && (
                                  <div className="mt-3">
                                    <div className="flex space-x-3">
                                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                                      </div>
                                      <div className="flex-1">
                                        <input
                                          type="text"
                                          placeholder="Add a comment..."
                                          value={commentInputs[post.id] || ''}
                                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                          onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                      </div>
                                      <button
                                        onClick={() => handleAddComment(post.id)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                      >
                                        Post
                                      </button>
                                    </div>

                                    {/* Comments List */}
                                    {postComments[post.id] && postComments[post.id].length > 0 && (
                                      <div className="mt-4 space-y-3">
                                        {postComments[post.id].map((comment: any) => (
                                          <div key={comment.id} className="flex space-x-3">
                                            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                              {(comment.profiles?.full_name || comment.profiles?.email || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                              <div className="bg-gray-100 rounded-lg px-3 py-2">
                                                <div className="font-semibold text-sm text-gray-900">
                                                  {comment.profiles?.full_name || comment.profiles?.email || 'Unknown'}
                                                </div>
                                                <p className="text-gray-800 text-sm">{comment.content}</p>
                                              </div>
                                              <div className="text-xs text-gray-500 mt-1">
                                                {formatTime(comment.created_at)}
                                                {comment.is_edited && <span className="ml-2">(edited)</span>}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
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
                          <h3 className="text-md font-semibold text-gray-900 mb-2">No posts yet</h3>
                          <p className="text-gray-600">Be the first to post in this channel</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : activeSidebarItem === 'dm' && selectedDM ? (
            <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
              <div className="border-b border-gray-200 bg-white flex-shrink-0">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {availableDirectMessages.find(dm => dm.id === selectedDM)?.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={onlineUsers.has(selectedDM) ? 'absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white' : 'absolute bottom-0 right-0 w-2.5 h-2.5 bg-gray-400 rounded-full border-2 border-white'}></div>
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">
                        {availableDirectMessages.find(dm => dm.id === selectedDM)?.name}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {onlineUsers.has(selectedDM) ? 'Active now' : 'Offline'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={handleVideoCall}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Start video call"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleAudioCall}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Start audio call"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <Search className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <button 
                        onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {showDeleteMenu && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setDeleteType('conversation');
                                setShowDeleteConfirm(true);
                                setShowDeleteMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Conversation
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div 
                ref={messagesContainerRef}
                className={`flex-1 overflow-y-auto relative min-h-0 ${dragActive ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''}`}
                style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {currentMessages.length > 0 ? (
                  <div>
                    {currentMessages.map((message) => (
                      <div 
                        key={message.id} 
                        className="relative flex items-start space-x-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 group cursor-pointer"
                        onContextMenu={(e) => showMessageContextMenu(e, message)}
                        onMouseDown={(e) => handleLongPressStart(e, message)}
                        onMouseUp={handleLongPressEnd}
                        onMouseLeave={handleLongPressEnd}
                        onTouchStart={(e) => handleLongPressStart(e, message)}
                        onTouchEnd={handleLongPressEnd}
                      >
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                          {(message.sender_name || message.userName || 'U').charAt(0)}
                        </div>
                        <div className="flex-1 pr-8">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-gray-900 text-xs">{message.sender_name || message.userName}</span>
                            <span className="text-xs text-gray-500">{formatTime(message.created_at || message.timestamp)}</span>
                            {(message.is_edited || message.edited) && <span className="text-xs text-gray-400">(edited)</span>}
                          </div>
                          <div className="text-gray-800 text-xs">
{message.message_type === 'file' ? renderFileFromDB(message) : renderFileMessage(message.content)}
                          </div>


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
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Start a conversation
                    </h3>
                    <p className="text-sm text-gray-600 max-w-md">
                      Send a message to {availableDirectMessages.find(dm => dm.id === selectedDM)?.name}
                    </p>
                  </div>
                )}
                
                {/* Drag and drop overlay */}
                {dragActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-50 bg-opacity-90 border-2 border-dashed border-blue-300 rounded-lg z-10">
                    <div className="text-center">
                      <Paperclip className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                      <p className="text-lg font-semibold text-blue-700">Drop files to share</p>
                      <p className="text-sm text-blue-600">Support for images, videos, documents, and more</p>
                    </div>
                  </div>
                )}

                {/* Scroll to bottom button removed */}
              </div>

              {/* Message Input */}
              <div className="border-t border-gray-200 bg-white p-1.5 flex-shrink-0">
                <div className="bg-white border border-gray-300 rounded-lg">
                  <div className="flex items-center p-1.5">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      placeholder={`Message ${availableDirectMessages.find(dm => dm.id === selectedDM)?.name}`}
                      className="flex-1 text-gray-900 placeholder-gray-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center space-x-1">
                      <button className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                        <Plus className="w-3 h-3" />
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
                      <label className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer">
                        <Paperclip className="w-4 h-4" />
                        <input
                          type="file"
                          multiple
                          onChange={handleFileSelect}
                          className="hidden"
                          accept="*/*"
                        />
                      </label>
                      <button 
                        onClick={handleEmojiClick}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title="Add emoji"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                      <div className="h-4 w-px bg-gray-300 mx-1" />
                      <button 
                        onClick={handleAudioCall}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title="Start audio call"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={handleVideoCall}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title="Start video call"
                      >
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

              {/* Delete Confirmation Modal */}
              {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg max-w-md w-full mx-4">
                    <div className="p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <Trash2 className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {deleteType === 'conversation' ? 'Delete Conversation' : 'Delete Message'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {deleteType === 'conversation' 
                              ? 'This will delete all your messages in this conversation. This action cannot be undone.'
                              : 'This will permanently delete this message. This action cannot be undone.'
                            }
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteType(null);
                            setMessageToDelete(null);
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteConfirm}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Context Menu */}
              {showContextMenu && selectedMessage && (
                <div
                  className="fixed bg-white rounded-lg shadow-xl border border-gray-300 py-2 z-50 min-w-[200px]"
                  style={{
                    left: `${contextMenuPosition.x}px`,
                    top: `${contextMenuPosition.y}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  {/* Emoji Reactions */}
                  <div className="px-4 py-2 border-b border-gray-100">
                    <div className="flex space-x-2">
                      {['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => addReactionToMessage(selectedMessage.id, emoji)}
                          className="p-2 hover:bg-gray-100 rounded transition-colors text-lg"
                          title={`React with ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Options */}
                  <div className="py-1">
                    <button
                      onClick={handleDeleteFromContext}
                      className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors flex items-center"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Message
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : activeSidebarItem === 'posts' ? (
            /* Posts Page Content */
            <div className="flex-1 flex flex-col bg-white">
              {/* Posts Header */}
              <div className="px-4 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Posts</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (selectedChannel) {
                        console.log('Manual refresh posts for:', selectedChannel.id);
                        loadChannelPosts(selectedChannel.id);
                      }
                    }}
                    className="px-2 py-1.5 bg-gray-500 text-white text-xs font-medium rounded hover:bg-gray-600 transition-colors"
                  >
                    Refresh
                  </button>
                  <button 
                    onClick={() => setShowNewPostModal(true)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                  >
                    New Post
                  </button>
                </div>
              </div>

              {/* Posts Content */}
              <div className="flex-1 overflow-y-auto h-full" style={{scrollbarWidth: 'auto'}}>
                {/* Create Post Section */}
                <div className="py-2 px-0 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-start space-x-3 px-4">
                    <div className="w-10 h-10 rounded-full overflow-hidden">
                      <img 
                        src="https://res.cloudinary.com/dwf0ywsoq/image/upload/v1756368405/magicteams_k6b5jh.png" 
                        alt="Magic Teams" 
                        className="w-full h-full object-cover"
                      />
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
                                selectChannelWithMembers(channel);
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
                          rows={1}
                          className="w-full placeholder-gray-500 border-0 focus:outline-none resize-none"
                        />
                        
                        {/* Post Actions */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                          <div className="flex items-center space-x-2">
                            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                              <Plus className="w-4 h-4" />
                            </button>
                            <div className="h-4 w-px bg-gray-300 mx-1" />
                            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                              <Bold className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                              <Italic className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                              <Link2 className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                              <List className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                              <Code className="w-4 h-4" />
                            </button>
                            <div className="h-4 w-px bg-gray-300 mx-1" />
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

                {/* Posts List */}
                <div className="py-2 px-0">
                  <div className="px-4">
                  {selectedChannel ? (
                    channelPosts[selectedChannel.id]?.length > 0 ? (
                      channelPosts[selectedChannel.id].map((post: any) => (
                        <div key={post.id} className="bg-white border border-gray-200 rounded-lg p-3 mb-2">
                          <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                              {(post.author_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="font-semibold text-sm text-gray-900">{post.author_name || 'Unknown'}</span>
                                <span className="text-xs text-gray-500">
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
                                <h3 className="text-base font-semibold text-gray-900 mb-2">
                                  {post.title}
                                </h3>
                              )}
                              
                              <div className="text-sm text-gray-800 space-y-2">
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
                              <div className="mt-4 pt-3 border-t border-gray-100">
                                {/* Reactions */}
                                <div className="flex items-center space-x-1 mb-3">
                                  <button 
                                    onClick={() => handleReaction(post.id, 'like')}
                                    className="flex items-center px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
                                    title="Like"
                                  >
                                    <ThumbsUp className="w-4 h-4 text-gray-500" />
                                  </button>
                                  <button 
                                    onClick={() => handleReaction(post.id, 'love')}
                                    className="flex items-center px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
                                    title="Love"
                                  >
                                    <Heart className="w-4 h-4 text-red-500" />
                                  </button>
                                  <button 
                                    onClick={() => handleReaction(post.id, 'laugh')}
                                    className="flex items-center px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
                                    title="Laugh"
                                  >
                                    <Laugh className="w-4 h-4 text-yellow-500" />
                                  </button>
                                  <button 
                                    onClick={() => handleReaction(post.id, 'sad')}
                                    className="flex items-center px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
                                    title="Sad"
                                  >
                                    <Frown className="w-4 h-4 text-blue-500" />
                                  </button>
                                  <button 
                                    onClick={() => handleReaction(post.id, 'angry')}
                                    className="flex items-center px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
                                    title="Angry"
                                  >
                                    <Angry className="w-4 h-4 text-red-600" />
                                  </button>
                                  <button 
                                    onClick={() => toggleComments(post.id)}
                                    className="flex items-center px-2 py-1 rounded-full hover:bg-gray-100 transition-colors ml-4"
                                  >
                                    <MessageSquare className="w-4 h-4 mr-1" />
                                    <span className="text-sm">Comment</span>
                                  </button>
                                  <span className="text-sm text-gray-500 ml-4">
                                    {post.view_count || 0} views
                                  </span>
                                </div>

                                {/* Reaction Summary */}
                                {postReactions[post.id] && Array.isArray(postReactions[post.id]) && postReactions[post.id].length > 0 && (
                                  <div className="flex items-center space-x-2 mb-3 text-sm text-gray-600">
                                    {['like', 'love', 'laugh', 'sad', 'angry'].map(reactionType => {
                                      const count = postReactions[post.id].filter((r: any) => (r.reaction_type || r.type) === reactionType).length;
                                      if (count === 0) return null;
                                      
                                      const icons = {
                                        like: <span>👍</span>,
                                        love: <span>❤️</span>, 
                                        laugh: <span>😂</span>,
                                        sad: <span>😢</span>,
                                        angry: <span>😡</span>
                                      };
                                      
                                      return (
                                        <span key={reactionType} className="flex items-center space-x-1 bg-gray-200 px-2 py-1 rounded">
                                          {icons[reactionType as keyof typeof icons]}
                                          <span className="font-bold">{count}</span>
                                          <span className="text-xs">({reactionType})</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}


                                {/* Comment Input */}
                                {showComments[post.id] && (
                                  <div className="mt-3">
                                    <div className="flex space-x-3">
                                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                                      </div>
                                      <div className="flex-1">
                                        <input
                                          type="text"
                                          placeholder="Add a comment..."
                                          value={commentInputs[post.id] || ''}
                                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                          onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                      </div>
                                      <button
                                        onClick={() => handleAddComment(post.id)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                      >
                                        Post
                                      </button>
                                    </div>

                                    {/* Comments List */}
                                    {postComments[post.id] && postComments[post.id].length > 0 && (
                                      <div className="mt-4 space-y-3">
                                        {postComments[post.id].map((comment: any) => (
                                          <div key={comment.id} className="flex space-x-3">
                                            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                              {(comment.profiles?.full_name || comment.profiles?.email || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                              <div className="bg-gray-100 rounded-lg px-3 py-2">
                                                <div className="font-semibold text-sm text-gray-900">
                                                  {comment.profiles?.full_name || comment.profiles?.email || 'Unknown'}
                                                </div>
                                                <p className="text-gray-800 text-sm">{comment.content}</p>
                                              </div>
                                              <div className="text-xs text-gray-500 mt-1">
                                                {formatTime(comment.created_at)}
                                                {comment.is_edited && <span className="ml-2">(edited)</span>}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
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
                          rows={4}
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
                          <div className="h-4 w-px bg-gray-300 mx-1" />
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <Bold className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <Italic className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <Link2 className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <List className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                            <Code className="w-4 h-4" />
                          </button>
                          <div className="h-4 w-px bg-gray-300 mx-1" />
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
            <div className="flex-1 flex flex-col bg-white overflow-hidden h-full">
              {/* Replies Header */}
              <div className="px-4 py-4 border-b border-gray-200 bg-white flex-shrink-0">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-semibold text-gray-900">Replies</h2>
                </div>
                
                {/* Unread/Read Tabs - Discord Style */}
                <div className="flex space-x-4">
                  <button
                    onClick={() => setRepliesTab('unread')}
                    className={`pb-1 text-xs font-medium border-b-2 transition-colors ${
                      repliesTab === 'unread'
                        ? 'text-gray-900 border-blue-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    Unread
                  </button>
                  <button
                    onClick={() => setRepliesTab('read')}
                    className={`pb-1 text-xs font-medium border-b-2 transition-colors ${
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
              <div className="flex-1 overflow-hidden h-0">
                {repliesTab === 'unread' ? (
                  /* Unread Replies List */
                  <div className="h-full overflow-y-auto" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
                    {unreadReplies.length > 0 ? (
                      <div>
                        {unreadReplies.map((reply: any) => (
                          <div key={reply.id} className="bg-white border-b border-gray-200 px-3 py-3 hover:bg-gray-50 cursor-pointer"
                               onClick={() => handleNavigateToMessage(reply)}>
                            <div className="flex items-start space-x-2">
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                {reply.sender_name?.charAt(0) || 'U'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-medium text-gray-900">
                                    {reply.sender_name || 'Unknown User'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(reply.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <p className="text-xs text-gray-600 mb-1 line-clamp-2">
                                  {reply.content}
                                </p>
                                <div className="flex items-center text-xs text-gray-500">
                                  <span className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                                    {reply.message_type === 'channel' ? `#${reply.location_name}` : reply.location_name}
                                  </span>
                                  <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    Unread
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Empty State */
                      <div className="flex-1 flex flex-col items-center justify-center p-6">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Reply className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 mb-2">You're all caught up</h3>
                        <p className="text-gray-600 text-center mb-6">
                          Looks like you don't have any unread replies
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Read Replies List */
                  <div className="h-full overflow-y-auto" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
                    {readReplies.length > 0 ? (
                      <div>
                        {readReplies.map((reply: any) => (
                          <div key={reply.id} className="bg-white border-b border-gray-200 px-3 py-3 opacity-75 hover:bg-gray-50 cursor-pointer"
                               onClick={() => handleNavigateToMessage(reply)}>
                            <div className="flex items-start space-x-2">
                              <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                {reply.sender_name?.charAt(0) || 'U'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-medium text-gray-700">
                                    {reply.sender_name || 'Unknown User'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(reply.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <p className="text-xs text-gray-600 mb-1 line-clamp-2">
                                  {reply.content}
                                </p>
                                <div className="flex items-center text-xs text-gray-500">
                                  <span className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                                    {reply.message_type === 'channel' ? `#${reply.location_name}` : reply.location_name}
                                  </span>
                                  <span className="ml-2 bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                    Read
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Empty State */
                      <div className="flex-1 flex flex-col items-center justify-center p-6">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Reply className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-md font-semibold text-gray-900 mb-2">No read replies</h3>
                        <p className="text-gray-600 text-center max-w-sm">
                          Previously read replies will appear here.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : activeSidebarItem === 'followups' ? (
            /* FollowUps Page Content */
            <div className="flex-1 flex flex-col bg-white">
              {/* FollowUps Header */}
              <div className="px-4 py-4 border-b border-gray-200 bg-white">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">FollowUps</h2>
                
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
                  <button 
                    onClick={() => setShowAssignmentModal(true)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full flex items-center transition-colors ${
                      followupsFilter === 'assigned' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      followupsFilter === 'assigned' ? 'bg-blue-600' : 'bg-gray-400'
                    }`}></div>
                    Assigned to: {selectedAssignee ? selectedAssignee.name || selectedAssignee.email.split('@')[0] : 'You'}
                  </button>
                  <button 
                    onClick={() => setFollowupsFilter(followupsFilter === 'resolved' ? 'assigned' : 'resolved')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full flex items-center transition-colors ${
                      followupsFilter === 'resolved' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="mr-1">✓</span>
                    Resolved
                  </button>
                </div>
              </div>

              {/* Tasks Content */}
              <div className="flex-1 overflow-y-auto">
                {followupsFilter === 'assigned' ? (
                  /* Assigned Tasks */
                  <div className="p-4">
                    {assignedTasks.length > 0 ? (
                      assignedTasks.map((task: any) => (
                        <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-900 mb-1">
                                {task.task_description || task.description}
                              </h4>
                              <div className="text-xs text-gray-500 mb-2">
                                Assigned by: {task.assigned_by_profile?.full_name || task.assignedBy?.email || 'Unknown'}
                              </div>
                              <div className="text-xs text-gray-400">
                                {new Date(task.created_at || task.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <button
                              onClick={() => resolveTask(task.id)}
                              className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded hover:bg-green-200 transition-colors"
                            >
                              Mark Resolved
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Users className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No assigned tasks</h3>
                        <p className="text-gray-500">Tasks assigned to you will appear here</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Resolved Tasks */
                  <div className="p-4">
                    {resolvedTasks.length > 0 ? (
                      resolvedTasks.map((task: any) => (
                        <div key={task.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3 opacity-75">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">
                                {task.task_description || task.description}
                              </h4>
                              <div className="text-xs text-gray-500 mb-2">
                                Assigned by: {task.assigned_by_profile?.full_name || task.assignedBy?.email || 'Unknown'}
                              </div>
                              <div className="text-xs text-gray-400">
                                Resolved: {new Date(task.resolved_at || task.resolvedAt).toLocaleString()}
                              </div>
                            </div>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                              ✓ Resolved
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Users className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No resolved tasks</h3>
                        <p className="text-gray-500">Completed tasks will appear here</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Assignment Modal */}
              {showAssignmentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg max-w-md w-full max-h-96">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Assign Task</h3>
                        <button
                          onClick={() => setShowAssignmentModal(false)}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Team Member
                        </label>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {teamMembers.length > 0 ? teamMembers.map(member => (
                            <button
                              key={member.id}
                              onClick={() => setSelectedAssignee(member)}
                              className={`w-full flex items-center p-3 rounded-lg border transition-colors ${
                                selectedAssignee?.id === member.id
                                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold mr-3">
                                {(member.name || member.email).charAt(0).toUpperCase()}
                              </div>
                              <div className="text-left">
                                <div className="font-medium text-sm">
                                  {member.name || member.email.split('@')[0]}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {member.email}
                                </div>
                              </div>
                            </button>
                          )) : (
                            <div className="text-center py-4 text-gray-500 text-sm">
                              No team members found
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => setShowAssignmentModal(false)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (selectedAssignee) {
                              setFollowupsFilter('assigned');
                              setShowAssignmentModal(false);
                            }
                          }}
                          disabled={!selectedAssignee}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeSidebarItem === 'activity' ? (
            /* Activity Page Content */
            <div className="flex-1 flex flex-col bg-white">
              {/* Activity Header */}
              <div className="px-4 py-4 border-b border-gray-200 bg-white">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Activity</h2>
                
                {/* Filter Tabs */}
                <div className="flex space-x-1">
                  <button
                    onClick={() => setActivityTab('mentions')}
                    className={`flex items-center space-x-2 px-2 py-1 text-xs font-medium rounded-full transition-colors ${
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
                    className={`flex items-center space-x-2 px-2 py-1 text-xs font-medium rounded-full transition-colors ${
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
                    className={`flex items-center space-x-2 px-2 py-1 text-xs font-medium rounded-full transition-colors ${
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
                      <h3 className="text-md font-semibold text-gray-900 mb-2">No mentions yet</h3>
                      <p className="text-gray-600 text-center max-w-sm">
                        When someone mentions you, it will appear here.
                      </p>
                    </div>
                  </div>
                ) : activityTab === 'reactions' ? (
                  /* Reactions Content */
                  <div className="flex-1">
                    {activityReactions.length > 0 ? (
                      <div className="p-6 space-y-4">
                        {activityReactions.map((reaction) => {
                          const getReactionIcon = (type: string) => {
                            switch (type) {
                              case 'like': return <ThumbsUp className="w-4 h-4 text-gray-600" />;
                              case 'love': return <Heart className="w-4 h-4 text-red-500" />;
                              case 'laugh': return <Laugh className="w-4 h-4 text-yellow-500" />;
                              case 'sad': return <Frown className="w-4 h-4 text-blue-500" />;
                              case 'angry': return <Angry className="w-4 h-4 text-red-600" />;
                              default: return <span>👍</span>;
                            }
                          };

                          return (
                            <div key={reaction.id} className="flex items-start space-x-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                              <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                {(reaction.profile?.full_name || reaction.profile?.email || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-xs font-semibold text-gray-900">
                                    {reaction.profile?.full_name || reaction.profile?.email || 'Unknown'}
                                  </span>
                                  <span className="text-xs text-gray-500">reacted with</span>
                                  <span className="flex items-center space-x-1">
                                    {getReactionIcon(reaction.reaction_type)}
                                    <span className="text-xs font-medium">
                                      {reaction.reaction_type}
                                    </span>
                                  </span>
                                  <span className="text-xs text-gray-500">to your post</span>
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                  in <span className="font-medium">#{reaction.channel?.name || 'unknown'}</span> • {formatTime(reaction.created_at)}
                                </div>
                                <div className="bg-white rounded-lg p-3 border-l-4 border-blue-500">
                                  {reaction.post?.title && (
                                    <div className="font-semibold text-gray-900 mb-1">
                                      {reaction.post.title}
                                    </div>
                                  )}
                                  <div className="text-sm text-gray-700 line-clamp-2">
                                    {reaction.post?.content || 'Post content unavailable'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center p-12">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">😊</span>
                          </div>
                          <h3 className="text-md font-semibold text-gray-900 mb-2">No reactions yet</h3>
                          <p className="text-gray-600 text-center max-w-sm">
                            When people react to your posts, it will appear here.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Assigned to me Content */
                  <div className="flex-1 flex items-center justify-center p-12">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-md font-semibold text-gray-900 mb-2">No assignments yet</h3>
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
              <div className="px-4 py-4 border-b border-gray-200 bg-white">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                    <Edit3 className="w-3 h-3 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Sent Messages</h2>
                </div>
                
              </div>

              {/* Search Bar */}
              <div className="px-4 py-2 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search sent messages..."
                    value={sentSearchQuery}
                    onChange={(e) => setSentSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Sent by filter */}
              <div className="px-4 py-1 bg-gray-50">
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowSentByDropdown(!showSentByDropdown)}
                      className="inline-flex items-center space-x-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200 transition-colors"
                    >
                      <span>
                        {selectedSentByUser ? 
                          `Sent by: ${getAllUniqueUsers().find(u => u.id === selectedSentByUser)?.name || 'Unknown'}` : 
                          'Sent by: You'
                        }
                      </span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {showSentByDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                        <div className="max-h-60 overflow-y-auto">
                          <button
                            onClick={() => {
                              setSelectedSentByUser(null);
                              setShowSentByDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${!selectedSentByUser ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                          >
                            You (Your sent messages)
                          </button>
                          
                          {/* All Users (merged, no duplicates) */}
                          {getAllUniqueUsers().length > 0 && (
                            <>
                              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-t border-gray-100">
                                People
                              </div>
                              {getAllUniqueUsers().map(user => (
                                <button
                                  key={user.id}
                                  onClick={() => {
                                    setSelectedSentByUser(user.id);
                                    setShowSentByDropdown(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2 ${selectedSentByUser === user.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                                >
                                  <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-xs text-gray-500">{user.email}</div>
                                  </div>
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>


              {/* Table Header */}
              <div className="px-6 py-3 bg-white border-b border-gray-200">
                <div className="grid grid-cols-3 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div>Location</div>
                  <div>Message</div>
                  <div>Sent</div>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto max-h-[calc(100vh-300px)] min-h-0">
                {false ? (
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
                ) : true ? (
                  /* Sent Messages Content */
                  (selectedSentByUser ? receivedMessages : sentMessages).length === 0 || (sentSearchQuery && searchSent(sentSearchQuery).length === 0) ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <div className="w-10 h-10 border-2 border-gray-400 rounded-full flex items-center justify-center">
                          <div className="w-4 h-4 bg-gray-400 rounded-full transform rotate-45"></div>
                        </div>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">You're all caught up</h3>
                      <p className="text-gray-600 text-center max-w-sm">
                        {selectedSentByUser 
                          ? `No messages found from ${getAllUniqueUsers().find(u => u.id === selectedSentByUser)?.name || 'this user'}`
                          : "Looks like you don't have any sent messages"
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {(sentSearchQuery ? searchSent(sentSearchQuery) : (selectedSentByUser ? receivedMessages : sentMessages)).map((message) => (
                        <div key={message.id} className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                             onClick={() => handleNavigateToMessage(message)}>
                          <div className="grid grid-cols-3 gap-4 items-start">
                            <div className="flex items-center space-x-2">
                              {message.message_type === 'channel' ? (
                                <Hash className="w-4 h-4 text-gray-400" />
                              ) : (
                                <MessageSquare className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="text-sm text-gray-900 truncate">
                                {message.message_type === 'channel' ? `#${message.location_name}` : message.location_name}
                              </span>
                            </div>
                            <div className="flex items-start justify-between group">
                              <p className="text-sm text-gray-900 flex-1 pr-4 line-clamp-2">{message.content}</p>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                  title="Go to message"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNavigateToMessage(message);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(message.created_at).toLocaleDateString()} at {new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
                  .map(member => {
                    const isExistingMember = selectedChannel.members?.some(m => m.id === member.id) || false;
                    console.log('Member:', member.name, 'isExisting:', isExistingMember, 'channelMembers:', selectedChannel.members);
                    return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isExistingMember 
                          ? 'bg-blue-50 cursor-default' 
                          : 'hover:bg-gray-50 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!isExistingMember) {
                          if (selectedMembers.includes(member.id)) {
                            setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                          } else {
                            setSelectedMembers([...selectedMembers, member.id]);
                          }
                        }
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isExistingMember || selectedMembers.includes(member.id)}
                          onChange={() => {}}
                          disabled={isExistingMember}
                          className={`w-4 h-4 border-gray-300 rounded focus:ring-blue-500 ${
                            isExistingMember 
                              ? 'text-blue-600 bg-blue-50 cursor-not-allowed' 
                              : 'text-blue-600 cursor-pointer'
                          }`}
                        />
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.email} • {member.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isExistingMember && (
                          <span className="text-xs text-blue-600 font-medium">Already in channel</span>
                        )}
                        <div className={`w-2 h-2 rounded-full ${
                          member.status === 'online' ? 'bg-green-500' :
                          member.status === 'idle' ? 'bg-yellow-500' :
                          member.status === 'dnd' ? 'bg-red-500' :
                          'bg-gray-400'
                        }`} />
                      </div>
                    </div>
                    );
                  })}
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
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                          </div>
                          <span className="text-xs text-gray-500">Member</span>
                        </div>
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


      {/* File Preview Modal */}
      {showFilePreview && selectedFiles.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Share Files ({selectedFiles.length})
              </h3>
              <button
                onClick={() => {
                  setShowFilePreview(false);
                  setSelectedFiles([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto mb-4">
              <div className="space-y-3">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center p-4 bg-gray-50 rounded-lg border">
                    <div className="flex-shrink-0 mr-4">
                      {getFileIcon(file.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const newFiles = selectedFiles.filter((_, i) => i !== index);
                        setSelectedFiles(newFiles);
                        if (newFiles.length === 0) {
                          setShowFilePreview(false);
                        }
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {/* Add more files button */}
                <label className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
                  <Plus className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">Add more files</span>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files);
                        setSelectedFiles([...selectedFiles, ...newFiles]);
                      }
                    }}
                    className="hidden"
                    accept="*/*"
                  />
                </label>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowFilePreview(false);
                  setSelectedFiles([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendFilesMessage}
                disabled={uploadingFiles || selectedFiles.length === 0}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center ${
                  uploadingFiles || selectedFiles.length === 0
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {uploadingFiles ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video/Audio Call Modal */}
      {showVideoCallModal && selectedDM && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {callType === 'video' ? 'Start Video Call' : 'Start Audio Call'}
              </h3>
              <button
                onClick={() => {
                  setShowVideoCallModal(false);
                  stopMediaStream();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg mx-auto mb-3">
                  {availableDirectMessages.find(dm => dm.id === selectedDM)?.name.charAt(0).toUpperCase()}
                </div>
                <p className="text-gray-900 font-medium">
                  {availableDirectMessages.find(dm => dm.id === selectedDM)?.name}
                </p>
                <p className="text-sm text-gray-500">
                  Ready to start {callType === 'video' ? 'video' : 'audio'} call
                </p>
              </div>
              
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-3">Media Permissions</h4>
                {permissionsDenied ? (
                  <div className="space-y-2">
                    <div className="flex items-center p-2 bg-red-50 border border-red-200 rounded">
                      <div className="w-3 h-3 rounded-full mr-2 bg-red-500"></div>
                      <div>
                        <span className="text-sm font-medium text-red-800 block">
                          Camera/Microphone access denied
                        </span>
                        <span className="text-xs text-red-600">
                          Click the camera icon in your browser address bar, select "Allow", then try again.
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {callType === 'video' && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-2 ${mediaPermissions.camera ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          <span className="text-sm text-gray-700">Camera</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {mediaPermissions.camera ? 'Granted' : 'Not granted'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${mediaPermissions.microphone ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <span className="text-sm text-gray-700">Microphone</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {mediaPermissions.microphone ? 'Granted' : 'Not granted'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {currentStream && (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center text-sm text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    Media stream active
                  </div>
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowVideoCallModal(false);
                    stopMediaStream();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => initiateCall(callType)}
                  disabled={permissionsDenied}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center ${
                    permissionsDenied 
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <Video className="w-4 h-4 mr-2" />
                  {permissionsDenied ? 'Permissions Denied' : `Start ${callType === 'video' ? 'Video' : 'Audio'} Call`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div 
          className="emoji-picker-container fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg"
          style={{ 
            top: emojiPickerPosition.top, 
            left: emojiPickerPosition.left,
            width: '380px',
            maxHeight: '400px'
          }}
        >
          {/* Category Tabs */}
          <div className="border-b border-gray-200 p-2">
            <div className="flex space-x-1 overflow-x-auto">
              {Object.keys(emojiCategories).map((category) => (
                <button
                  key={category}
                  onClick={() => setCurrentEmojiCategory(category)}
                  className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                    currentEmojiCategory === category
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Emoji Grid */}
          <div className="p-3 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-8 gap-1">
              {emojiCategories[currentEmojiCategory].map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => onEmojiSelect(emoji)}
                  className="p-2 hover:bg-gray-100 rounded text-lg transition-colors flex items-center justify-center"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Removed duplicate File Preview Modal - keeping only the main one above */}

      {/* Incoming Call Notification */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 text-center">
            <div className="mb-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3">
                {incomingCall.caller_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Incoming {incomingCall.call_type} call
              </h3>
              <p className="text-gray-600">
                {incomingCall.caller_name} is calling you
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => declineCall(incomingCall.call_session_id)}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
              >
                <X className="w-5 h-5 mr-2" />
                Decline
              </button>
              <button
                onClick={() => answerCall(incomingCall.call_session_id)}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
              >
                {incomingCall.call_type === 'video' ? (
                  <Video className="w-5 h-5 mr-2" />
                ) : (
                  <Mic className="w-5 h-5 mr-2" />
                )}
                Answer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Video Call */}
      {showVideoCall && (
        <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
          {/* Google Meet Style Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-medium text-gray-900">
                    Meet with {availableDirectMessages.find(dm => dm.id === selectedDM)?.name}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {callDuration} • {availableDirectMessages.find(dm => dm.id === selectedDM)?.name}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowMeetInfo(!showMeetInfo)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Meeting details"
              >
                <Info className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Video Area */}
          <div className="flex-1 relative bg-gray-900">
            {/* Main Video Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 h-full">
              {/* Remote Participant Video */}
              <div className="relative bg-gray-800 rounded-xl overflow-hidden">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                
                {/* Remote participant info */}
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded-lg">
                  <span className="text-sm font-medium">
                    {availableDirectMessages.find(dm => dm.id === selectedDM)?.name}
                  </span>
                </div>

                {/* No video placeholder */}
                {!remoteStream && (
                  <div className="absolute inset-0 bg-gray-800 flex flex-col items-center justify-center">
                    <div className="w-24 h-24 bg-gray-600 rounded-full flex items-center justify-center mb-3">
                      <span className="text-2xl font-semibold text-white">
                        {availableDirectMessages.find(dm => dm.id === selectedDM)?.name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <p className="text-white font-medium">
                      {availableDirectMessages.find(dm => dm.id === selectedDM)?.name}
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      {activeCall?.status === 'calling' ? 'Joining...' : 'Camera is off'}
                    </p>
                  </div>
                )}
              </div>

              {/* Local Participant Video (You) */}
              <div className="relative bg-gray-800 rounded-xl overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                
                {/* Local participant info */}
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded-lg">
                  <span className="text-sm font-medium">You</span>
                  {isScreenSharing && (
                    <span className="ml-2 text-xs bg-green-600 px-2 py-0.5 rounded-full">
                      Presenting
                    </span>
                  )}
                </div>

                {/* Video muted overlay */}
                {isVideoMuted && (
                  <div className="absolute inset-0 bg-gray-800 flex flex-col items-center justify-center">
                    <div className="w-24 h-24 bg-gray-600 rounded-full flex items-center justify-center mb-3">
                      <VideoOff className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-white font-medium">Camera is off</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Google Meet Style Bottom Controls */}
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-center space-x-4">
              {/* Microphone */}
              <button
                onClick={toggleAudio}
                className={`p-4 rounded-full transition-all duration-200 hover:scale-105 ${
                  isAudioMuted
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title={isAudioMuted ? 'Unmute microphone (m)' : 'Mute microphone (m)'}
              >
                {isAudioMuted ? (
                  <MicOff className="w-6 h-6" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </button>

              {/* Camera */}
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full transition-all duration-200 hover:scale-105 ${
                  isVideoMuted
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title={isVideoMuted ? 'Turn on camera (c)' : 'Turn off camera (c)'}
              >
                {isVideoMuted ? (
                  <VideoOff className="w-6 h-6" />
                ) : (
                  <Video className="w-6 h-6" />
                )}
              </button>

              {/* Screen Share */}
              <button
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                className={`p-4 rounded-full transition-all duration-200 hover:scale-105 ${
                  isScreenSharing
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title={isScreenSharing ? 'Stop presenting (p)' : 'Present now (p)'}
              >
                {isScreenSharing ? (
                  <MonitorSpeaker className="w-6 h-6" />
                ) : (
                  <Monitor className="w-6 h-6" />
                )}
              </button>

              {/* More Options */}
              <button
                className="p-4 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200 hover:scale-105"
                title="More options"
              >
                <MoreVertical className="w-6 h-6" />
              </button>

              {/* End Call */}
              <button
                onClick={endActiveCall}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all duration-200 hover:scale-105 flex items-center space-x-2 font-medium"
                title="Leave call"
              >
                <PhoneOff className="w-5 h-5" />
                <span>Leave call</span>
              </button>
            </div>

            {/* Screen sharing notification */}
            {isScreenSharing && (
              <div className="mt-3 flex items-center justify-center">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-blue-700 font-medium">
                    You are presenting to everyone
                  </span>
                  <button
                    onClick={stopScreenShare}
                    className="text-blue-700 hover:text-blue-800 text-sm underline"
                  >
                    Stop presenting
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Meet Info Sidebar */}
          {showMeetInfo && (
            <div className="fixed right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-lg z-10">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Meeting details</h3>
                  <button
                    onClick={() => setShowMeetInfo(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Joining info</h4>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-600">Meeting with</p>
                    <p className="font-medium text-gray-900">
                      {availableDirectMessages.find(dm => dm.id === selectedDM)?.name}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Duration</h4>
                  <p className="text-lg font-mono text-gray-700">{callDuration}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Participants (2)</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-white">
                          {user?.email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-gray-700">You</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-white">
                          {availableDirectMessages.find(dm => dm.id === selectedDM)?.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-gray-700">
                        {availableDirectMessages.find(dm => dm.id === selectedDM)?.name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Call Overlay (when not in full video mode) */}
      {activeCall && !showVideoCall && (
        <div className="fixed top-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {activeCall.call_type} Call Active
              </p>
              <p className="text-xs text-gray-500">
                {activeCall.caller_id === user?.id ? 'Outgoing' : 'Incoming'} call
              </p>
            </div>
            <button
              onClick={() => setShowVideoCall(true)}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mr-2"
              title="Show video call"
            >
              <Video className="w-4 h-4" />
            </button>
            <button
              onClick={endActiveCall}
              className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              title="End call"
            >
              <X className="w-4 h-4" />
            </button>
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
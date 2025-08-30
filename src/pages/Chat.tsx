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
  ThumbsUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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
    getSentMessages
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

  // Transform direct conversations to direct messages format
  console.log('🔍 Debug directConversations:', directConversations);
  
  const availableDirectMessages: DirectMessage[] = directConversations
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
      setSelectedChannel({
        id: dbChannels[0].id,
        name: dbChannels[0].name,
        type: dbChannels[0].channel_type as 'text' | 'voice',
        description: dbChannels[0].description || undefined,
        memberCount: dbChannels[0].member_count || 1
      });
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

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);

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
                      {(channel as any).locked && <Lock className="w-3 h-3 text-gray-400" />}
                      {channel.member_count && channel.member_count > 0 && (
                        <span className="text-xs text-gray-500">{channel.member_count}</span>
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
              <div className="px-4 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
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
              <div className="flex-1 overflow-y-auto max-h-[75vh]">
                {/* Create Post Section */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-start space-x-3">
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
                                setSelectedChannel(channel as any);
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
                <div className="p-6">
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
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Replies</h2>
                </div>
                
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
                  /* Unread Replies List */
                  <div className="p-4">
                    {unreadReplies.length > 0 ? (
                      <div className="space-y-4">
                        {unreadReplies.map((reply: any) => (
                          <div key={reply.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                               onClick={() => handleNavigateToMessage(reply)}>
                            <div className="flex items-start space-x-3">
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {reply.sender_name?.charAt(0) || 'U'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-sm font-medium text-gray-900">
                                    {reply.sender_name || 'Unknown User'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(reply.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                  {reply.content}
                                </p>
                                <div className="flex items-center text-xs text-gray-500">
                                  <span className="bg-gray-100 px-2 py-1 rounded">
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
                      <div className="flex-1 flex flex-col items-center justify-center p-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Reply className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">You're all caught up</h3>
                        <p className="text-gray-600 text-center mb-6">
                          Looks like you don't have any unread replies
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Read Replies List */
                  <div className="p-4">
                    {readReplies.length > 0 ? (
                      <div className="space-y-4">
                        {readReplies.map((reply: any) => (
                          <div key={reply.id} className="bg-white border border-gray-200 rounded-lg p-4 opacity-75 hover:bg-gray-50 cursor-pointer"
                               onClick={() => handleNavigateToMessage(reply)}>
                            <div className="flex items-start space-x-3">
                              <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {reply.sender_name?.charAt(0) || 'U'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-sm font-medium text-gray-700">
                                    {reply.sender_name || 'Unknown User'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(reply.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                  {reply.content}
                                </p>
                                <div className="flex items-center text-xs text-gray-500">
                                  <span className="bg-gray-100 px-2 py-1 rounded">
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
                            <div key={reaction.id} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                {(reaction.profile?.full_name || reaction.profile?.email || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="font-semibold text-gray-900">
                                    {reaction.profile?.full_name || reaction.profile?.email || 'Unknown'}
                                  </span>
                                  <span className="text-gray-500">reacted with</span>
                                  <span className="flex items-center space-x-1">
                                    {getReactionIcon(reaction.reaction_type)}
                                    <span className="text-sm font-medium">
                                      {reaction.reaction_type}
                                    </span>
                                  </span>
                                  <span className="text-gray-500">to your post</span>
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
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No reactions yet</h3>
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
                  <h2 className="text-xl font-semibold text-gray-900">Sent Messages</h2>
                </div>
                
              </div>

              {/* Search Bar */}
              <div className="px-6 py-4 border-b border-gray-200">
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
              <div className="px-6 py-2 bg-gray-50">
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
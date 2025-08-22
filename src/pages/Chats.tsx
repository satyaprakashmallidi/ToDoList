import React, { useState, useEffect } from 'react';
import { Search, Plus, Users, MessageCircle, Send, MoreVertical, X, Check, UserPlus, Crown, LogOut, Trash2 } from 'lucide-react';
import { useSupabase } from '../hooks/useSupabase';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
}

interface Team {
  id: string;
  name: string;
  memberCount: number;
  unreadCount?: number;
}

interface ChatGroup {
  id: string;
  name: string;
  adminId: string;
  memberIds: string[];
  createdAt: Date;
  lastActivity?: Date;
  avatar?: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'team';
}

interface Chat {
  id: string;
  type: 'user' | 'team' | 'group';
  name: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
  isOnline?: boolean;
  avatar?: string;
  adminId?: string;
  memberIds?: string[];
}

export const Chats: React.FC = () => {
  const { user } = useAuth();
  const { supabase, loading, error } = useSupabase();
  
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatType, setChatType] = useState<'all' | 'users' | 'teams'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [showPlusDropdown, setShowPlusDropdown] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);

  const currentUserId = user?.id || '';

  // Load team members from profiles table
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .neq('id', user.id); // Exclude current user
        
        if (error) {
          console.error('Error loading team members:', error);
          return;
        }
        
        if (data) {
          const members: TeamMember[] = data.map(profile => ({
            id: profile.id,
            name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
            email: profile.email || '',
            avatar: profile.avatar_url || undefined,
            isOnline: false // This would be determined by real-time presence
          }));
          setTeamMembers(members);
        }
      } catch (err) {
        console.error('Failed to load team members:', err);
      }
    };

    loadTeamMembers();
  }, [user, supabase]);

  // Load chat groups for current user
  useEffect(() => {
    const loadChats = async () => {
      if (!user) return;
      
      try {
        // Load groups where user is a member
        const { data: groupMemberships, error: memberError } = await supabase
          .from('chat_group_members')
          .select(`
            group_id,
            chat_groups (
              id,
              name,
              admin_id,
              created_at,
              updated_at
            )
          `)
          .eq('user_id', user.id)
          .eq('is_active', true);
        
        if (memberError) {
          console.error('Error loading group memberships:', memberError);
          return;
        }
        
        if (groupMemberships) {
          const groupChats: Chat[] = groupMemberships
            .filter(membership => membership.chat_groups)
            .map(membership => {
              const group = membership.chat_groups as any;
              return {
                id: group.id,
                type: 'group' as const,
                name: group.name,
                lastMessage: undefined, // This would be populated with actual last message
                lastMessageTime: undefined,
                unreadCount: 0, // This would be calculated from unread messages
                adminId: group.admin_id,
                memberIds: [] // This would be populated with actual member IDs
              };
            });
          
          setChats(groupChats);
        }
      } catch (err) {
        console.error('Failed to load chats:', err);
      }
    };

    loadChats();
  }, [user, supabase]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPlusDropdown || showChatOptions) {
        setShowPlusDropdown(false);
        setShowChatOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPlusDropdown, showChatOptions]);

  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = chatType === 'all' || chat.type === chatType || 
                       (chatType === 'users' && chat.type === 'user') ||
                       (chatType === 'teams' && chat.type === 'team');
    return matchesSearch && matchesType;
  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || !activeChat) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: 'me',
      senderName: 'You',
      content: messageInput,
      timestamp: new Date(),
      type: 'user'
    };

    setMessages([...messages, newMessage]);
    setMessageInput('');
  };

  const handleCreateGroup = () => {
    setShowPlusDropdown(false);
    setShowCreateGroup(true);
  };

  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCreateGroupSubmit = async () => {
    if (!groupName.trim() || selectedMembers.length === 0 || !user) return;

    try {
      // Use the create_chat_group function from our schema
      const { data, error } = await supabase.rpc('create_chat_group', {
        group_name: groupName.trim(),
        group_description: null,
        member_ids: selectedMembers
      });

      if (error) {
        console.error('Error creating group:', error);
        alert('Failed to create group. Please try again.');
        return;
      }

      // Reset form
      setGroupName('');
      setSelectedMembers([]);
      setShowCreateGroup(false);
      
      // Reload chats to show the new group
      // The useEffect will handle this automatically
      
      console.log('Group created successfully:', data);
    } catch (err) {
      console.error('Failed to create group:', err);
      alert('An error occurred while creating the group.');
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase.rpc('leave_chat_group', {
        group_id: groupId
      });

      if (error) {
        console.error('Error leaving group:', error);
        alert('Failed to leave group. Please try again.');
        return;
      }

      // Remove the group from local state
      setChats(prev => prev.filter(chat => chat.id !== groupId));
      
      // Close the active chat if it was the group we left
      if (activeChat === groupId) {
        setActiveChat(null);
      }
      
      setShowChatOptions(false);
      console.log('Successfully left group');
    } catch (err) {
      console.error('Failed to leave group:', err);
      alert('An error occurred while leaving the group.');
    }
  };

  const handleKickMember = async (groupId: string, memberId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase.rpc('kick_group_member', {
        group_id: groupId,
        target_user_id: memberId
      });

      if (error) {
        console.error('Error kicking member:', error);
        alert('Failed to kick member. Please try again.');
        return;
      }

      console.log('Successfully kicked member');
      // You might want to update the UI to reflect the change
    } catch (err) {
      console.error('Failed to kick member:', err);
      alert('An error occurred while kicking the member.');
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    // Here you would delete the message from Supabase
    console.log('Deleting message:', messageId);
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Error Display */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-lg z-50">
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      {/* Chat Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Chats</h1>
            <div className="relative">
              <button 
                onClick={() => setShowPlusDropdown(!showPlusDropdown)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5 text-gray-600" />
              </button>
              
              {/* Plus Dropdown */}
              {showPlusDropdown && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <button
                    onClick={handleCreateGroup}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <Users className="w-4 h-4 text-gray-500" />
                    Create a new group
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Chat Type Tabs */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setChatType('all')}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chatType === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setChatType('users')}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chatType === 'users'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setChatType('teams')}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chatType === 'teams'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Teams
            </button>
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500 mx-auto mb-3"></div>
              <p>Loading chats...</p>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No chats found</p>
              <p className="text-sm mt-1">Start a conversation or create a group to get started</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setActiveChat(chat.id)}
                className={`flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  activeChat === chat.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                }`}
              >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                  chat.type === 'team' ? 'bg-purple-500' : 
                  chat.type === 'group' ? 'bg-green-500' : 'bg-blue-500'
                }`}>
                  {chat.type === 'team' ? (
                    <Users className="w-6 h-6" />
                  ) : chat.type === 'group' ? (
                    <Users className="w-6 h-6" />
                  ) : (
                    chat.name.charAt(0).toUpperCase()
                  )}
                </div>
                {chat.type === 'user' && chat.isOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                )}
                {chat.type === 'group' && chat.adminId === currentUserId && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-yellow-500 border-2 border-white rounded-full flex items-center justify-center">
                    <Crown className="w-2 h-2 text-white" />
                  </div>
                )}
              </div>

              {/* Chat Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-gray-900 truncate">{chat.name}</h3>
                  {chat.lastMessageTime && (
                    <span className="text-xs text-gray-500">
                      {formatTime(chat.lastMessageTime)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 truncate">{chat.lastMessage}</p>
                  {chat.unreadCount > 0 && (
                    <span className="ml-2 bg-blue-500 text-white text-xs font-medium px-2 py-1 rounded-full min-w-[20px] text-center">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                    filteredChats.find(c => c.id === activeChat)?.type === 'team' ? 'bg-purple-500' : 
                    filteredChats.find(c => c.id === activeChat)?.type === 'group' ? 'bg-green-500' : 'bg-blue-500'
                  }`}>
                    {filteredChats.find(c => c.id === activeChat)?.type === 'team' ? (
                      <Users className="w-5 h-5" />
                    ) : filteredChats.find(c => c.id === activeChat)?.type === 'group' ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      filteredChats.find(c => c.id === activeChat)?.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {filteredChats.find(c => c.id === activeChat)?.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {filteredChats.find(c => c.id === activeChat)?.type === 'team' 
                        ? 'Team Chat' 
                        : filteredChats.find(c => c.id === activeChat)?.type === 'group'
                          ? `Group • ${filteredChats.find(c => c.id === activeChat)?.memberIds?.length || 0} members`
                          : filteredChats.find(c => c.id === activeChat)?.isOnline 
                            ? 'Online' 
                            : 'Offline'
                      }
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <button 
                    onClick={() => setShowChatOptions(!showChatOptions)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-600" />
                  </button>
                  
                  {/* Chat Options Dropdown */}
                  {showChatOptions && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      {filteredChats.find(c => c.id === activeChat)?.type === 'group' && (
                        <>
                          {/* Admin Controls */}
                          {filteredChats.find(c => c.id === activeChat)?.adminId === currentUserId ? (
                            <>
                              <button className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors border-b border-gray-100">
                                <Trash2 className="w-4 h-4" />
                                Delete Messages
                              </button>
                              <button className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors border-b border-gray-100">
                                <UserPlus className="w-4 h-4" />
                                Manage Members
                              </button>
                            </>
                          ) : (
                            /* Regular Member Controls */
                            <button 
                              onClick={() => handleLeaveGroup(activeChat || '')}
                              className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                            >
                              <LogOut className="w-4 h-4" />
                              Leave Group
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderId === 'me' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.senderId === 'me'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}>
                      {message.senderId !== 'me' && (
                        <p className="text-xs font-medium mb-1 opacity-70">{message.senderName}</p>
                      )}
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.senderId === 'me' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* No Chat Selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No chat selected</h3>
              <p className="text-gray-600">Choose a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Group Creation Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Create New Group</h2>
                <button
                  onClick={() => setShowCreateGroup(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Group Name Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Team Members Selection */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    Add Team Members
                  </label>
                  <span className="text-xs text-gray-500">
                    {selectedMembers.length} selected
                  </span>
                </div>

                {/* Members List */}
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {teamMembers.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No team members found</p>
                      <p className="text-sm mt-1">Team members will appear here when loaded</p>
                    </div>
                  ) : (
                    teamMembers.filter(member => member.id !== currentUserId).map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            {member.isOnline && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{member.name}</p>
                            <p className="text-sm text-gray-500">{member.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleMemberToggle(member.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            selectedMembers.includes(member.id)
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {selectedMembers.includes(member.id) ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateGroup(false)}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGroupSubmit}
                  disabled={!groupName.trim() || selectedMembers.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
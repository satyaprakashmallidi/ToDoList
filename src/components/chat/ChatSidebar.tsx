import React, { useState } from 'react';
import { Search, Plus, Users, MessageCircle } from 'lucide-react';
import type { ChatConversation, ChatUser } from '../../types/chat';

interface ChatSidebarProps {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  onConversationSelect: (conversationId: string, type: 'direct' | 'group') => void;
  onCreateGroup: () => void;
  currentUserId: string;
  loading: boolean;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationId,
  onConversationSelect,
  onCreateGroup,
  currentUserId,
  loading
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [chatFilter, setChatFilter] = useState<'all' | 'direct' | 'groups'>('all');

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = chatFilter === 'all' || 
                         (chatFilter === 'direct' && conv.type === 'direct') ||
                         (chatFilter === 'groups' && conv.type === 'group');
    return matchesSearch && matchesFilter;
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
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
    <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
          <button
            onClick={onCreateGroup}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Create new group"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setChatFilter('all')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              chatFilter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setChatFilter('direct')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              chatFilter === 'direct'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Direct
          </button>
          <button
            onClick={() => setChatFilter('groups')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              chatFilter === 'groups'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Groups
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500 mx-auto mb-3"></div>
            <p>Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No conversations found</p>
            <p className="text-sm mt-1">Start a conversation or create a group to get started</p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => onConversationSelect(conversation.id, conversation.type)}
              className={`flex items-center gap-3 p-3 md:p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                activeConversationId === conversation.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                  conversation.type === 'group' ? 'bg-green-500' : 'bg-blue-500'
                }`}>
                  {conversation.type === 'group' ? (
                    <Users className="w-5 h-5 md:w-6 md:h-6" />
                  ) : (
                    conversation.name.charAt(0).toUpperCase()
                  )}
                </div>
                
                {/* Online indicator for direct chats */}
                {conversation.type === 'direct' && conversation.isOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                )}
                
                {/* Admin crown for groups */}
                {conversation.type === 'group' && conversation.admin_id === currentUserId && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-yellow-500 border-2 border-white rounded-full flex items-center justify-center">
                    <span className="text-xs text-white">👑</span>
                  </div>
                )}
              </div>

              {/* Conversation Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-gray-900 truncate">{conversation.name}</h3>
                  {conversation.last_message && (
                    <span className="text-xs text-gray-500">
                      {formatTime(conversation.updated_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 truncate">
                    {conversation.last_message?.content || 
                     (conversation.type === 'group' ? 
                       `Group • ${conversation.member_count || 0} members` : 
                       'Start a conversation')}
                  </p>
                  {conversation.unread_count > 0 && (
                    <span className="ml-2 bg-blue-500 text-white text-xs font-medium px-2 py-1 rounded-full min-w-[20px] text-center">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
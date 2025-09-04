import React, { useState } from 'react';
import { Search, Users, MessageCircle } from 'lucide-react';
import type { ChatConversation } from '../../types/chat';

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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">Conversations</h2>
      </header>

      {/* Search and Filters */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
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
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center py-8 px-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 text-base">No conversations found</p>
              <p className="text-gray-400 text-sm mt-1">Start a conversation or create a group</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onConversationSelect(conversation.id, conversation.type)}
                className={`w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-gray-50 transition-colors text-left ${
                  activeConversationId === conversation.id ? 'bg-blue-50 border-r-4 border-r-blue-500' : ''
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className={`w-10 sm:w-12 h-10 sm:h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                    conversation.type === 'group' ? 'bg-green-500' : 'bg-blue-500'
                  }`}>
                    {conversation.type === 'group' ? (
                      <Users className="w-4 sm:w-5 h-4 sm:h-5" />
                    ) : (
                      (conversation.name.charAt(0) || '?').toUpperCase()
                    )}
                  </div>
                  
                  {/* Online indicator for direct chats */}
                  {conversation.type === 'direct' && conversation.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                  
                  {/* Admin crown for groups */}
                  {conversation.type === 'group' && conversation.admin_id === currentUserId && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 border-2 border-white rounded-full flex items-center justify-center">
                      <span className="text-xs">👑</span>
                    </div>
                  )}
                </div>

                {/* Conversation Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-base text-gray-900 truncate">{conversation.name}</h3>
                    {conversation.last_message_time && (
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {formatTime(conversation.last_message_time)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-base text-gray-600 truncate">
                      {conversation.last_message || 
                       (conversation.type === 'group' ? 
                         `${conversation.member_count || 0} members` : 
                         'Start a conversation')}
                    </p>
                    {conversation.unread_count > 0 && (
                      <span className="ml-2 bg-blue-500 text-white text-xs font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center flex-shrink-0">
                        {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
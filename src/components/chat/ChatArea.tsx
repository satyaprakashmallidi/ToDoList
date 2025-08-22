import React, { useEffect, useRef, useState } from 'react';
import { Users, MessageCircle, Trash2 } from 'lucide-react';
import type { ChatMessage, ChatConversation } from '../../types/chat';

interface ChatAreaProps {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  currentUserId: string;
  onLoadMessages: (conversationId: string, type: 'direct' | 'group') => void;
  onDeleteGroup?: (groupId: string) => Promise<boolean>;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  messages,
  currentUserId,
  onLoadMessages,
  onDeleteGroup
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (conversation) {
      onLoadMessages(conversation.id, conversation.type);
    }
  }, [conversation, onLoadMessages]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleDeleteGroup = async () => {
    if (!conversation || !onDeleteGroup) return;
    
    setIsDeleting(true);
    const success = await onDeleteGroup(conversation.id);
    setIsDeleting(false);
    
    if (success) {
      setShowDeleteConfirm(false);
    }
  };

  const isAdmin = conversation?.type === 'group' && conversation.admin_id === currentUserId;

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No conversation selected</h3>
          <p className="text-gray-600">Choose a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header - Hidden on mobile (handled by parent) */}
      <div className="hidden md:block p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
              conversation.type === 'group' ? 'bg-green-500' : 'bg-blue-500'
            }`}>
              {conversation.type === 'group' ? (
                <Users className="w-5 h-5" />
              ) : (
                conversation.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{conversation.name}</h2>
              <p className="text-sm text-gray-500">
                {conversation.type === 'group' 
                  ? `Group • ${conversation.member_count || 0} members`
                  : conversation.isOnline 
                    ? 'Online' 
                    : 'Offline'
                }
              </p>
            </div>
          </div>
          
          {/* Delete button for group admin */}
          {isAdmin && onDeleteGroup && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete group"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Delete Button - Positioned in top right */}
      {isAdmin && onDeleteGroup && (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="md:hidden absolute top-4 right-4 z-30 p-2 bg-white text-red-600 hover:bg-red-50 rounded-lg transition-colors shadow-md"
          title="Delete group"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 md:p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Group</h3>
            <p className="text-gray-600 mb-6 text-sm md:text-base">
              Are you sure you want to delete "{conversation.name}"? This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 order-1 sm:order-2"
              >
                {isDeleting ? 'Deleting...' : 'Delete Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
        {Object.keys(groupedMessages).length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {date}
                </div>
              </div>

              {/* Messages for this date */}
              {dateMessages.map((message, index) => {
                const isOwn = message.sender_id === currentUserId;
                const showAvatar = !isOwn && (
                  index === 0 || 
                  dateMessages[index - 1]?.sender_id !== message.sender_id
                );

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
                  >
                    <div className={`flex gap-2 max-w-[75%] sm:max-w-xs lg:max-w-md ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar for other users */}
                      {!isOwn && (
                        <div className="flex-shrink-0">
                          {showAvatar ? (
                            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs md:text-sm font-medium">
                              {message.sender_name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          ) : (
                            <div className="w-6 h-6 md:w-8 md:h-8"></div>
                          )}
                        </div>
                      )}

                      {/* Message bubble */}
                      <div className={`px-3 py-2 md:px-4 md:py-2 rounded-lg ${
                        isOwn
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}>
                        {/* Sender name for other users in groups */}
                        {!isOwn && conversation.type === 'group' && showAvatar && (
                          <p className="text-xs font-medium mb-1 opacity-70">
                            {message.sender_name}
                          </p>
                        )}
                        
                        {/* Message content */}
                        <p className="text-sm break-words">{message.content}</p>
                        
                        {/* Timestamp */}
                        <p className={`text-xs mt-1 ${
                          isOwn ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {formatTime(message.created_at)}
                          {message.is_edited && (
                            <span className="ml-1">(edited)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
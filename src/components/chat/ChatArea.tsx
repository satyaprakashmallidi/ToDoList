import React, { useEffect, useRef, useState } from 'react';
import { Users, MessageCircle, Trash2, ArrowLeft } from 'lucide-react';
import type { ChatMessage, ChatConversation } from '../../types/chat';

interface ChatAreaProps {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  currentUserId: string;
  onLoadMessages: (conversationId: string, type: 'direct' | 'group') => void;
  onDeleteGroup?: (groupId: string) => Promise<boolean>;
  onBackToList?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  messages,
  currentUserId,
  onLoadMessages,
  onDeleteGroup,
  onBackToList
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
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-gray-400" />
          </div>
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
      {/* Conversation Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Mobile back button */}
            {onBackToList && (
              <button
                onClick={onBackToList}
                className="md:hidden p-1.5 sm:p-2 -ml-1 sm:-ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5" />
              </button>
            )}
            
            {/* Avatar */}
            <div className={`w-8 sm:w-10 h-8 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
              conversation.type === 'group' ? 'bg-green-500' : 'bg-blue-500'
            }`}>
              {conversation.type === 'group' ? (
                <Users className="w-4 sm:w-5 h-4 sm:h-5" />
              ) : (
                (conversation.name.charAt(0) || '?').toUpperCase()
              )}
            </div>
            
            {/* Conversation Info */}
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-gray-900 truncate text-sm sm:text-base">{conversation.name}</h2>
              <p className="text-xs sm:text-sm text-gray-500">
                {conversation.type === 'group' 
                  ? `${conversation.member_count || 0} members`
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
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 custom-scrollbar">
        {Object.keys(groupedMessages).length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-base text-gray-500">No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {Object.entries(groupedMessages).map(([date, dateMessages]) => (
              <div key={date}>
                {/* Date separator */}
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-white shadow-sm text-gray-600 text-xs px-3 py-1 rounded-full border">
                    {date}
                  </div>
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {dateMessages.map((message, index) => {
                    const isOwn = message.sender_id === currentUserId;
                    const showAvatar = !isOwn && (
                      index === 0 || 
                      dateMessages[index - 1]?.sender_id !== message.sender_id
                    );

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex gap-2 max-w-xs sm:max-w-md lg:max-w-lg ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                          {/* Avatar for other users */}
                          {!isOwn && (
                            <div className="flex-shrink-0 self-end">
                              {showAvatar ? (
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                                  {(message.sender_first_name || message.sender_name)?.charAt(0).toUpperCase() || '?'}
                                </div>
                              ) : (
                                <div className="w-8 h-8"></div>
                              )}
                            </div>
                          )}

                          {/* Message bubble */}
                          <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                            isOwn
                              ? 'bg-blue-500 text-white rounded-br-md'
                              : 'bg-white text-gray-900 rounded-bl-md border'
                          }`}>
                            {/* Sender name for other users in groups */}
                            {!isOwn && conversation.type === 'group' && showAvatar && (
                              <p className="text-sm font-medium mb-1 text-blue-600">
                                {message.sender_first_name || message.sender_name}
                              </p>
                            )}
                            
                            {/* Message content */}
                            <p className="text-base break-words leading-relaxed">{message.content}</p>
                            
                            {/* Timestamp */}
                            <p className={`text-sm mt-2 ${
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
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Group</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{conversation.name}"? This action cannot be undone.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
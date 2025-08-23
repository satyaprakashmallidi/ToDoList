import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../hooks/useChat';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatArea } from '../components/chat/ChatArea';
import { MessageInput } from '../components/chat/MessageInput';
import { CreateGroupModal } from '../components/chat/CreateGroupModal';
import type { ChatConversation } from '../types/chat';

export const Chat: React.FC = () => {
  const { user } = useAuth();
  const {
    conversations,
    messages,
    teamMembers,
    loading,
    error,
    loadMessages,
    sendMessage,
    createGroup,
    deleteGroup,
    clearError
  } = useChat();

  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true);

  const handleConversationSelect = (conversationId: string, type: 'direct' | 'group') => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setActiveConversation(conversation);
      setIsMobileSidebarOpen(false); // Close sidebar on mobile when selecting conversation
    }
  };

  const handleSendMessage = async (content: string) => {
    if (activeConversation) {
      await sendMessage(activeConversation.id, content, activeConversation.type);
    }
  };

  const handleCreateGroup = async (name: string, memberIds: string[]) => {
    const groupId = await createGroup(name, memberIds);
    if (groupId) {
      setTimeout(() => {
        const newGroup = conversations.find(c => c.id === groupId);
        if (newGroup) {
          setActiveConversation(newGroup);
          setIsMobileSidebarOpen(false);
        }
      }, 100);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const success = await deleteGroup(groupId);
    if (success) {
      setActiveConversation(null);
      setIsMobileSidebarOpen(true);
    }
    return success;
  };

  const handleBackToList = () => {
    setActiveConversation(null);
    setIsMobileSidebarOpen(true);
  };

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">💬</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Messages</h2>
          <p className="text-gray-600">Please log in to access chat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top Header - Always Visible */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-gray-900">Messages</h1>
            <p className="text-xs sm:text-sm text-gray-600">Connect with your team</p>
          </div>
          <button
            onClick={() => setShowCreateGroupModal(true)}
            className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-3 sm:w-4 h-3 sm:h-4 mr-1 sm:mr-1.5" />
            <span className="hidden xs:inline">New Group</span>
            <span className="xs:hidden">New</span>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm">{error}</p>
              <button 
                onClick={clearError}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Chat Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className={`
          ${isMobileSidebarOpen ? 'flex' : 'hidden'} 
          md:flex w-full md:w-80 lg:w-96 flex-col bg-gray-50 border-r border-gray-200
        `}>
          <ChatSidebar
            conversations={conversations}
            activeConversationId={activeConversation?.id || null}
            onConversationSelect={handleConversationSelect}
            onCreateGroup={() => setShowCreateGroupModal(true)}
            currentUserId={user.id}
            loading={loading}
          />
        </div>

        {/* Chat Area */}
        <div className={`
          ${!isMobileSidebarOpen ? 'flex' : 'hidden'} 
          md:flex flex-1 flex-col min-h-0
        `}>
          {activeConversation ? (
            <>
              <ChatArea
                conversation={activeConversation}
                messages={activeConversation ? messages[activeConversation.id] || [] : []}
                currentUserId={user.id}
                onLoadMessages={loadMessages}
                onDeleteGroup={handleDeleteGroup}
                onBackToList={handleBackToList}
              />
              
              <MessageInput
                onSendMessage={handleSendMessage}
                disabled={loading}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💬</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No conversation selected</h3>
                <p className="text-gray-600 mb-4">Choose a conversation to start messaging</p>
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first group
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreateGroup={handleCreateGroup}
        teamMembers={teamMembers}
        loading={loading}
      />
    </div>
  );
};
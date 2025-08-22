import React, { useState } from 'react';
import { ArrowLeft, Menu } from 'lucide-react';
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
  const [showSidebar, setShowSidebar] = useState(false);

  const handleConversationSelect = (conversationId: string, type: 'direct' | 'group') => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setActiveConversation(conversation);
      setShowSidebar(false); // Hide sidebar on mobile when selecting a conversation
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
      // Find the newly created group and select it
      setTimeout(() => {
        const newGroup = conversations.find(c => c.id === groupId);
        if (newGroup) {
          setActiveConversation(newGroup);
        }
      }, 100);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const success = await deleteGroup(groupId);
    if (success) {
      setActiveConversation(null);
      setShowSidebar(true); // Show sidebar on mobile after deleting
    }
    return success;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please log in to access chat.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50 relative">
      {/* Error Display */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between">
            <p className="text-sm">{error}</p>
            <button 
              onClick={clearError}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Mobile Header - Only visible on mobile when conversation is selected */}
      {activeConversation && (
        <div className="md:hidden absolute top-0 left-0 right-0 bg-white border-b border-gray-200 p-4 z-40 flex items-center gap-3">
          <button
            onClick={() => {
              setActiveConversation(null);
              setShowSidebar(true);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold ${
            activeConversation.type === 'group' ? 'bg-green-500' : 'bg-blue-500'
          }`}>
            {activeConversation.type === 'group' ? (
              <div className="w-4 h-4 flex items-center justify-center">👥</div>
            ) : (
              activeConversation.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{activeConversation.name}</h2>
            <p className="text-sm text-gray-500">
              {activeConversation.type === 'group' 
                ? `${activeConversation.member_count || 0} members`
                : 'Direct message'
              }
            </p>
          </div>
        </div>
      )}

      {/* Chat Sidebar - Desktop: always visible, Mobile: overlay when showSidebar is true or no active conversation */}
      <div className={`
        ${activeConversation && !showSidebar ? 'hidden md:flex' : 'flex'}
        ${showSidebar ? 'md:relative absolute inset-0 z-30' : 'relative'}
        w-full md:w-80 bg-white border-r border-gray-200 flex-col h-full
      `}>
        {/* Mobile close button */}
        {showSidebar && (
          <div className="md:hidden flex justify-between items-center p-4 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
            <button
              onClick={() => setShowSidebar(false)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              ×
            </button>
          </div>
        )}
        
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversation?.id || null}
          onConversationSelect={handleConversationSelect}
          onCreateGroup={() => setShowCreateGroupModal(true)}
          currentUserId={user.id}
          loading={loading}
        />
      </div>

      {/* Mobile Menu Button - Only show when no conversation is selected and sidebar is hidden */}
      {!activeConversation && !showSidebar && (
        <button
          onClick={() => setShowSidebar(true)}
          className="md:hidden fixed top-4 left-4 z-40 p-3 bg-blue-500 text-white rounded-full shadow-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Chat Area */}
      <div className={`
        flex-1 flex flex-col
        ${activeConversation ? 'block' : 'hidden md:block'}
        ${activeConversation ? 'pt-16 md:pt-0' : ''}
      `}>
        <ChatArea
          conversation={activeConversation}
          messages={activeConversation ? messages[activeConversation.id] || [] : []}
          currentUserId={user.id}
          onLoadMessages={loadMessages}
          onDeleteGroup={handleDeleteGroup}
        />

        {/* Message Input */}
        {activeConversation && (
          <MessageInput
            onSendMessage={handleSendMessage}
            disabled={loading}
          />
        )}
      </div>

      {/* Overlay for mobile sidebar */}
      {showSidebar && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setShowSidebar(false)}
        />
      )}

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
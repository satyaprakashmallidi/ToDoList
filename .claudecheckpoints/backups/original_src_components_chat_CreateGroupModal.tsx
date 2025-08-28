import React, { useState } from 'react';
import { X, Check, Plus, Users } from 'lucide-react';
import type { ChatUser } from '../../types/chat';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (name: string, memberIds: string[]) => Promise<void>;
  teamMembers: ChatUser[];
  loading?: boolean;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onCreateGroup,
  teamMembers,
  loading = false
}) => {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const handleClose = () => {
    if (!creating) {
      setGroupName('');
      setSelectedMembers([]);
      onClose();
    }
  };

  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0 || creating) return;

    setCreating(true);
    try {
      await onCreateGroup(groupName.trim(), selectedMembers);
      handleClose();
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create New Group</h2>
            <button
              onClick={handleClose}
              disabled={creating}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Group Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              maxLength={255}
              required
            />
          </div>

          {/* Team Members */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Add Team Members
              </label>
              <span className="text-xs text-gray-500">
                {selectedMembers.length} selected
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
              {teamMembers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500 mx-auto mb-3"></div>
                      <p>Loading team members...</p>
                    </>
                  ) : (
                    <>
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No team members found</p>
                      <p className="text-sm mt-1">Team members will appear here when available</p>
                    </>
                  )}
                </div>
              ) : (
                teamMembers.map((member) => (
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
                      type="button"
                      onClick={() => handleMemberToggle(member.id)}
                      disabled={creating}
                      className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
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

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={creating}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!groupName.trim() || selectedMembers.length === 0 || creating}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                'Create Group'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
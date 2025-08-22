import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { useAuth } from '../contexts/AuthContext';
import type { ChatConversation, ChatMessage, ChatUser, ChatGroup, GroupMember } from '../types/chat';

export function useChat() {
  const { supabase } = useSupabase();
  const { user } = useAuth();
  
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [teamMembers, setTeamMembers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user's conversations (both direct and group)
  const loadConversations = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Get user's groups using the safe function
      const { data: userGroups, error: groupsError } = await supabase
        .rpc('get_user_chat_groups');

      if (groupsError) {
        console.error('Error loading groups:', groupsError);
        setError('Failed to load chat groups');
        return;
      }

      // Convert groups to conversations
      const groupConversations: ChatConversation[] = (userGroups || []).map(group => ({
        id: group.group_id,
        type: 'group' as const,
        name: group.group_name,
        avatar: undefined,
        last_message: group.last_message_content,
        last_message_time: group.last_message_time,
        unread_count: 0,
        updated_at: group.group_updated_at,
        admin_id: group.group_admin_id,
        member_count: group.member_count || 0,
        user_role: group.user_role
      }));

      // TODO: Add direct chat loading here when we implement it
      // For now, we'll focus on groups

      setConversations(groupConversations);

    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  // Load messages for a specific conversation
  const loadMessages = useCallback(async (conversationId: string, type: 'direct' | 'group') => {
    if (!user) return;

    try {
      if (type === 'group') {
        // Try loading group messages using the new RPC function
        const { data: groupMessages, error } = await supabase
          .rpc('get_group_messages_with_profiles', {
            p_group_id: conversationId
          });

        if (error) {
          console.error('Error loading messages with RPC, trying fallback:', error);
          
          // Fallback to direct query if RPC fails (in case function doesn't exist yet)
          const { data: fallbackMessages, error: fallbackError } = await supabase
            .from('group_messages')
            .select('*')
            .eq('group_id', conversationId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: true });

          if (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            setError('Failed to load messages');
            return;
          }

          // Get sender info separately for fallback
          const senderIds = [...new Set(fallbackMessages?.map(m => m.sender_id) || [])];
          if (senderIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name, email, avatar_url')
              .in('id', senderIds);

            const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

            const formattedMessages: ChatMessage[] = (fallbackMessages || []).map(msg => {
              const profile = profileMap.get(msg.sender_id);
              return {
                id: msg.id,
                content: msg.content,
                sender_id: msg.sender_id,
                sender_name: profile?.full_name || profile?.email || 'Unknown',
                sender_avatar: profile?.avatar_url,
                created_at: msg.created_at,
                updated_at: msg.updated_at,
                is_edited: msg.is_edited,
                is_deleted: msg.is_deleted,
                message_type: msg.message_type as any
              };
            });

            setMessages(prev => ({
              ...prev,
              [conversationId]: formattedMessages
            }));
          } else {
            setMessages(prev => ({
              ...prev,
              [conversationId]: []
            }));
          }
          return;
        }

        // RPC function worked, format the messages
        const formattedMessages: ChatMessage[] = (groupMessages || []).map(msg => ({
          id: msg.id,
          content: msg.content,
          sender_id: msg.sender_id,
          sender_name: msg.sender_full_name || msg.sender_email || 'Unknown',
          sender_avatar: msg.sender_avatar_url,
          created_at: msg.created_at,
          updated_at: msg.updated_at,
          is_edited: msg.is_edited,
          is_deleted: msg.is_deleted,
          message_type: msg.message_type as any
        }));

        setMessages(prev => ({
          ...prev,
          [conversationId]: formattedMessages
        }));
      }
      // TODO: Handle direct messages when implemented

    } catch (err) {
      console.error('Failed to load messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    }
  }, [user, supabase]);

  // Send a message
  const sendMessage = useCallback(async (conversationId: string, content: string, type: 'direct' | 'group') => {
    if (!user || !content.trim()) return;

    try {
      if (type === 'group') {
        const { data, error } = await supabase
          .from('group_messages')
          .insert({
            group_id: conversationId,
            sender_id: user.id,
            content: content.trim(),
            message_type: 'text'
          })
          .select(`
            id,
            content,
            sender_id,
            created_at,
            updated_at,
            is_edited,
            is_deleted,
            message_type
          `)
          .single();

        if (error) {
          console.error('Error sending message:', error);
          setError('Failed to send message');
          return;
        }

        // Add the new message to local state
        const newMessage: ChatMessage = {
          id: data.id,
          content: data.content,
          sender_id: data.sender_id,
          sender_name: user.user_metadata?.full_name || user.email || 'You',
          sender_avatar: user.user_metadata?.avatar_url,
          created_at: data.created_at,
          updated_at: data.updated_at,
          is_edited: data.is_edited,
          is_deleted: data.is_deleted,
          message_type: data.message_type
        };

        setMessages(prev => ({
          ...prev,
          [conversationId]: [...(prev[conversationId] || []), newMessage]
        }));
      }
      // TODO: Handle direct messages when implemented

    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [user, supabase]);

  // Load team members for group creation (only actual team members)
  const loadTeamMembers = useCallback(async () => {
    if (!user) return;

    try {
      // Use the new function to get only team members
      const { data: teamMemberData, error } = await supabase
        .rpc('get_user_team_members');

      if (error) {
        console.error('Error loading team members:', error);
        return;
      }

      const members: ChatUser[] = (teamMemberData || []).map(member => ({
        id: member.user_id,
        name: member.full_name || member.email?.split('@')[0] || 'Unknown',
        email: member.email || '',
        avatar_url: member.avatar_url,
        isOnline: false // TODO: Implement real-time presence
      }));

      setTeamMembers(members);

    } catch (err) {
      console.error('Failed to load team members:', err);
    }
  }, [user, supabase]);

  // Create a new group
  const createGroup = useCallback(async (name: string, memberIds: string[]) => {
    if (!user || !name.trim() || memberIds.length === 0) return;

    try {
      const { data: groupId, error } = await supabase
        .rpc('create_chat_group', {
          group_name: name.trim(),
          group_description: null,
          member_ids: memberIds
        });

      if (error) {
        console.error('Error creating group:', error);
        setError('Failed to create group');
        return;
      }

      // Reload conversations to include the new group
      await loadConversations();
      
      return groupId;

    } catch (err) {
      console.error('Failed to create group:', err);
      setError(err instanceof Error ? err.message : 'Failed to create group');
    }
  }, [user, supabase, loadConversations]);

  // Delete a group (admin only)
  const deleteGroup = useCallback(async (groupId: string) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .rpc('delete_chat_group', {
          p_group_id: groupId
        });

      if (error) {
        console.error('Error deleting group:', error);
        setError('Failed to delete group');
        return false;
      }

      // Remove the group from local state
      setConversations(prev => prev.filter(c => c.id !== groupId));
      
      // Remove messages for this group
      setMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[groupId];
        return newMessages;
      });

      return true;
    } catch (err) {
      console.error('Failed to delete group:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete group');
      return false;
    }
  }, [user, supabase]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadConversations();
      loadTeamMembers();
    }
  }, [user, loadConversations, loadTeamMembers]);

  return {
    conversations,
    messages,
    teamMembers,
    loading,
    error,
    loadConversations,
    loadMessages,
    sendMessage,
    createGroup,
    deleteGroup,
    clearError: () => setError(null)
  };
}
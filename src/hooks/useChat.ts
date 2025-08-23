import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { useAuth } from '../contexts/AuthContext';
import type { ChatConversation, ChatMessage, ChatUser, ChatGroup, GroupMember } from '../types/chat';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useChat() {
  const { supabase } = useSupabase();
  const { user } = useAuth();
  
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [teamMembers, setTeamMembers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store active subscriptions
  const subscriptionsRef = useRef<Map<string, RealtimeChannel>>(new Map());

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

  // Subscribe to real-time messages for a group
  const subscribeToMessages = useCallback((conversationId: string) => {
    if (!user || !supabase) return;

    // Unsubscribe from existing subscription if any
    const existingChannel = subscriptionsRef.current.get(conversationId);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
      subscriptionsRef.current.delete(conversationId);
    }

    // Create new subscription
    const channel = supabase
      .channel(`group-messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${conversationId}`
        },
        async (payload) => {
          // New message received
          const newMessage = payload.new as any;
          
          // Skip if this is our own message (already added optimistically)
          if (newMessage.sender_id === user.id) return;
          
          // Fetch sender info
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, full_name, first_name, email, avatar_url')
            .eq('id', newMessage.sender_id)
            .single();

          const formattedMessage: ChatMessage = {
            id: newMessage.id,
            content: newMessage.content,
            sender_id: newMessage.sender_id,
            sender_name: senderProfile?.full_name || senderProfile?.email || 'Unknown',
            sender_first_name: senderProfile?.first_name,
            sender_avatar: senderProfile?.avatar_url,
            created_at: newMessage.created_at,
            updated_at: newMessage.updated_at,
            is_edited: newMessage.is_edited,
            is_deleted: newMessage.is_deleted,
            message_type: newMessage.message_type
          };

          // Add message to state
          setMessages(prev => ({
            ...prev,
            [conversationId]: [...(prev[conversationId] || []), formattedMessage]
          }));

          // Update conversation's last message
          setConversations(prev => prev.map(conv => 
            conv.id === conversationId 
              ? {
                  ...conv,
                  last_message: newMessage.content,
                  last_message_time: newMessage.created_at,
                  updated_at: newMessage.created_at
                }
              : conv
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${conversationId}`
        },
        async (payload) => {
          // Message was edited
          const updatedMessage = payload.new as any;
          
          // Update message in state
          setMessages(prev => ({
            ...prev,
            [conversationId]: (prev[conversationId] || []).map(msg =>
              msg.id === updatedMessage.id
                ? {
                    ...msg,
                    content: updatedMessage.content,
                    is_edited: updatedMessage.is_edited,
                    updated_at: updatedMessage.updated_at
                  }
                : msg
            )
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${conversationId}`
        },
        (payload) => {
          // Message was deleted
          const deletedMessage = payload.old as any;
          
          // Remove message from state
          setMessages(prev => ({
            ...prev,
            [conversationId]: (prev[conversationId] || []).filter(msg => msg.id !== deletedMessage.id)
          }));
        }
      )
      .subscribe();

    // Store the subscription
    subscriptionsRef.current.set(conversationId, channel);
  }, [user, supabase]);

  // Load messages for a specific conversation
  const loadMessages = useCallback(async (conversationId: string, type: 'direct' | 'group') => {
    if (!user) return;

    try {
      if (type === 'group') {
        // Subscribe to real-time updates
        subscribeToMessages(conversationId);
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
              .select('id, full_name, first_name, email, avatar_url')
              .in('id', senderIds);

            const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

            const formattedMessages: ChatMessage[] = (fallbackMessages || []).map(msg => {
              const profile = profileMap.get(msg.sender_id);
              return {
                id: msg.id,
                content: msg.content,
                sender_id: msg.sender_id,
                sender_name: profile?.full_name || profile?.email || 'Unknown',
                sender_first_name: profile?.first_name,
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
          sender_first_name: msg.sender_first_name,
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
  }, [user, supabase, subscribeToMessages]);

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
          sender_first_name: user.user_metadata?.first_name,
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

  // Cleanup function for subscriptions
  const cleanupSubscriptions = useCallback(() => {
    subscriptionsRef.current.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    subscriptionsRef.current.clear();
  }, [supabase]);

  // Subscribe to conversation updates (new groups, members added/removed)
  useEffect(() => {
    if (!user || !supabase) return;

    // Subscribe to group member changes for the current user
    const groupMemberChannel = supabase
      .channel('group-members-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_group_members',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Reload conversations when user is added/removed from groups
          loadConversations();
        }
      )
      .subscribe();

    // Subscribe to group updates (name changes, etc.)
    const groupChannel = supabase
      .channel('groups-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_groups'
        },
        (payload) => {
          const updatedGroup = payload.new as any;
          
          // Update group info in conversations
          setConversations(prev => prev.map(conv =>
            conv.id === updatedGroup.id
              ? {
                  ...conv,
                  name: updatedGroup.name,
                  updated_at: updatedGroup.updated_at
                }
              : conv
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(groupMemberChannel);
      supabase.removeChannel(groupChannel);
    };
  }, [user, supabase, loadConversations]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadConversations();
      loadTeamMembers();
    }
  }, [user, loadConversations, loadTeamMembers]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      cleanupSubscriptions();
    };
  }, [cleanupSubscriptions]);

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
    clearError: () => setError(null),
    cleanupSubscriptions
  };
}
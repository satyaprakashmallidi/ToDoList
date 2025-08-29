import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { useAuth } from '../contexts/AuthContext';
import type { Channel, ChannelMember, ChannelMessage } from '../types/chat';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useChannels() {
  const { supabase } = useSupabase();
  const { user } = useAuth();
  
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelMessages, setChannelMessages] = useState<Record<string, ChannelMessage[]>>({});
  const [channelMembers, setChannelMembers] = useState<Record<string, ChannelMember[]>>({});
  const [directConversations, setDirectConversations] = useState<any[]>([]);
  const [directMessages, setDirectMessages] = useState<Record<string, any[]>>({});
  const [channelPosts, setChannelPosts] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store active subscriptions
  const subscriptionsRef = useRef<Map<string, RealtimeChannel>>(new Map());

  // Load user's channels based on team membership
  const loadChannels = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // First get the user's team invite ID
      const { data: teamMember, error: teamError } = await supabase
        .from('team_members')
        .select('team_invite_id')
        .eq('user_id', user.id)
        .single();

      if (teamError || !teamMember) {
        console.error('No team membership found:', teamError);
        setChannels([]);
        setLoading(false);
        return;
      }

      // Get channels for the user's team via channel_members
      const { data: userChannelMemberships, error: membershipsError } = await supabase
        .from('channel_members')
        .select(`
          channel_id,
          channels!inner(*)
        `)
        .eq('user_id', user.id)
        .eq('channels.team_invite_id', teamMember.team_invite_id)
        .eq('channels.is_archived', false)
        .is('left_at', null);

      if (membershipsError) {
        console.error('Error loading channel memberships:', membershipsError);
        setError('Failed to load channels');
        return;
      }

      const teamChannels = userChannelMemberships?.map(membership => membership.channels) || [];

      const formattedChannels: Channel[] = (teamChannels || []).map(channel => ({
        id: channel.id,
        team_invite_id: channel.team_invite_id,
        name: channel.name,
        description: channel.description,
        channel_type: channel.channel_type || 'text',
        category: channel.category,
        is_private: channel.is_private || false,
        is_archived: channel.is_archived || false,
        created_by: channel.created_by,
        settings: channel.settings || {},
        created_at: channel.created_at,
        updated_at: channel.updated_at,
        member_count: 0,
        unread_count: 0
      }));

      setChannels(formattedChannels);

    } catch (err) {
      console.error('Failed to load channels:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  // Create a new channel
  const createChannel = useCallback(async (
    name: string, 
    description?: string, 
    channelType: 'text' | 'voice' | 'announcement' = 'text',
    isPrivate: boolean = false,
    category?: string
  ) => {
    if (!user || !name.trim()) return null;

    try {
      // Get user's team invite ID
      const { data: teamMember, error: teamError } = await supabase
        .from('team_members')
        .select('team_invite_id')
        .eq('user_id', user.id)
        .single();

      if (teamError || !teamMember) {
        setError('You must be part of a team to create channels');
        return null;
      }

      // Create the channel
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .insert({
          team_invite_id: teamMember.team_invite_id,
          name: name.trim(),
          description: description?.trim() || null,
          channel_type: channelType,
          category: category?.trim() || null,
          is_private: isPrivate,
          created_by: user.id
        })
        .select()
        .single();

      if (channelError) {
        console.error('Error creating channel:', channelError);
        setError('Failed to create channel');
        return null;
      }

      // Add the creator as a member with admin role
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channel.id,
          user_id: user.id,
          role: 'admin',
          can_post: true,
          can_manage: true,
          added_by: user.id
        });

      if (memberError) {
        console.error('Error adding creator as member:', memberError);
        // Channel was created but creator wasn't added as member - this is problematic
        // We should probably delete the channel or handle this error
      }

      // Reload channels to include the new one
      await loadChannels();
      
      return channel.id;

    } catch (err) {
      console.error('Failed to create channel:', err);
      setError(err instanceof Error ? err.message : 'Failed to create channel');
      return null;
    }
  }, [user, supabase, loadChannels]);

  // Subscribe to real-time messages for a channel
  const subscribeToChannelMessages = useCallback((channelId: string) => {
    if (!user || !supabase) return;

    // Unsubscribe from existing subscription if any
    const existingChannel = subscriptionsRef.current.get(channelId);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
      subscriptionsRef.current.delete(channelId);
    }

    // Create new subscription
    const channel = supabase
      .channel(`channel-messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_messages',
          filter: `channel_id=eq.${channelId}`
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          // Skip if this is our own message (already added optimistically)
          if (newMessage.sender_id === user.id) return;
          
          // Fetch sender info
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, full_name, first_name, email, avatar_url')
            .eq('id', newMessage.sender_id)
            .single();

          const formattedMessage: ChannelMessage = {
            id: newMessage.id,
            channel_id: newMessage.channel_id,
            sender_id: newMessage.sender_id,
            content: newMessage.content,
            message_type: newMessage.message_type || 'text',
            file_url: newMessage.file_url,
            file_name: newMessage.file_name,
            file_size: newMessage.file_size,
            reply_to_id: newMessage.reply_to_id,
            is_edited: newMessage.is_edited || false,
            is_deleted: newMessage.is_deleted || false,
            deleted_by: newMessage.deleted_by,
            deleted_at: newMessage.deleted_at,
            created_at: newMessage.created_at,
            updated_at: newMessage.updated_at,
            sender_name: senderProfile?.full_name || senderProfile?.email || 'Unknown',
            sender_first_name: senderProfile?.first_name,
            sender_avatar: senderProfile?.avatar_url
          };

          // Add message to state
          setChannelMessages(prev => ({
            ...prev,
            [channelId]: [...(prev[channelId] || []), formattedMessage]
          }));

          // Update channel's last message
          setChannels(prev => prev.map(ch => 
            ch.id === channelId 
              ? {
                  ...ch,
                  last_message: formattedMessage,
                  updated_at: newMessage.created_at
                }
              : ch
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'channel_messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          const updatedMessage = payload.new as any;
          
          setChannelMessages(prev => ({
            ...prev,
            [channelId]: (prev[channelId] || []).map(msg =>
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
          table: 'channel_messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          const deletedMessage = payload.old as any;
          
          setChannelMessages(prev => ({
            ...prev,
            [channelId]: (prev[channelId] || []).filter(msg => msg.id !== deletedMessage.id)
          }));
        }
      )
      .subscribe();

    // Store the subscription
    subscriptionsRef.current.set(channelId, channel);
  }, [user, supabase]);

  // Load messages for a specific channel
  const loadChannelMessages = useCallback(async (channelId: string) => {
    if (!user) return;

    try {
      // Subscribe to real-time updates
      subscribeToChannelMessages(channelId);

      // Load existing messages without foreign key joins (to avoid relationship errors)
      const { data: messages, error } = await supabase
        .from('channel_messages')
        .select('*')
        .eq('channel_id', channelId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading channel messages:', error);
        setError('Failed to load messages');
        return;
      }

      // Get unique sender IDs to fetch profile information separately
      const senderIds = [...new Set((messages || []).map(msg => msg.sender_id))];
      let profiles: any[] = [];
      
      if (senderIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, email, avatar_url')
          .in('id', senderIds);
          
        if (profileError) {
          console.error('Error loading sender profiles:', profileError);
        } else {
          profiles = profileData || [];
        }
      }

      // Create a profile lookup map
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const formattedMessages: ChannelMessage[] = (messages || []).map(msg => {
        const profile = profileMap.get(msg.sender_id);
        return {
          id: msg.id,
          channel_id: msg.channel_id,
          sender_id: msg.sender_id,
          content: msg.content,
          message_type: msg.message_type || 'text',
          file_url: msg.file_url,
          file_name: msg.file_name,
          file_size: msg.file_size,
          reply_to_id: msg.reply_to_id,
          is_edited: msg.is_edited || false,
          is_deleted: msg.is_deleted || false,
          deleted_by: msg.deleted_by,
          deleted_at: msg.deleted_at,
          created_at: msg.created_at,
          updated_at: msg.updated_at,
          sender_name: profile?.full_name || profile?.email || 'Unknown',
          sender_first_name: profile?.first_name,
          sender_avatar: profile?.avatar_url
        };
      });

      setChannelMessages(prev => ({
        ...prev,
        [channelId]: formattedMessages
      }));

    } catch (err) {
      console.error('Failed to load channel messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    }
  }, [user, supabase, subscribeToChannelMessages]);

  // Send a message to a channel
  const sendChannelMessage = useCallback(async (channelId: string, content: string) => {
    if (!user || !content.trim()) return;

    try {
      const { data, error } = await supabase
        .from('channel_messages')
        .insert({
          channel_id: channelId,
          sender_id: user.id,
          content: content.trim(),
          message_type: 'text'
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        setError('Failed to send message');
        return;
      }

      // Add the new message to local state (optimistic update)
      const newMessage: ChannelMessage = {
        id: data.id,
        channel_id: data.channel_id,
        sender_id: data.sender_id,
        content: data.content,
        message_type: data.message_type || 'text',
        file_url: data.file_url,
        file_name: data.file_name,
        file_size: data.file_size,
        reply_to_id: data.reply_to_id,
        is_edited: data.is_edited || false,
        is_deleted: data.is_deleted || false,
        deleted_by: data.deleted_by,
        deleted_at: data.deleted_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
        sender_name: user.user_metadata?.full_name || user.email || 'You',
        sender_first_name: user.user_metadata?.first_name,
        sender_avatar: user.user_metadata?.avatar_url
      };

      setChannelMessages(prev => ({
        ...prev,
        [channelId]: [...(prev[channelId] || []), newMessage]
      }));

    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [user, supabase]);

  // Add members to a channel
  const addChannelMembers = useCallback(async (channelId: string, userIds: string[]) => {
    if (!user || userIds.length === 0) return false;

    try {
      // Check if user has management permissions for this channel
      const { data: membership, error: membershipError } = await supabase
        .from('channel_members')
        .select('can_manage')
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .single();

      if (membershipError || !membership?.can_manage) {
        setError('You do not have permission to add members to this channel');
        return false;
      }

      // Add the new members
      const newMembers = userIds.map(userId => ({
        channel_id: channelId,
        user_id: userId,
        role: 'member' as const,
        can_post: true,
        can_manage: false,
        added_by: user.id
      }));

      const { error } = await supabase
        .from('channel_members')
        .insert(newMembers);

      if (error) {
        console.error('Error adding channel members:', error);
        setError('Failed to add members to channel');
        return false;
      }

      return true;

    } catch (err) {
      console.error('Failed to add channel members:', err);
      setError(err instanceof Error ? err.message : 'Failed to add members');
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

  // Initial load
  useEffect(() => {
    if (user) {
      loadChannels();
    }
  }, [user, loadChannels]);

  // Load direct conversations for the user
  const loadDirectConversations = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('direct_conversations')
        .select(`
          id,
          user1_id,
          user2_id,
          created_at,
          updated_at
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .eq('is_active', true);

      if (error) {
        console.error('Error loading direct conversations:', error);
        return;
      }

      setDirectConversations(data || []);
    } catch (err) {
      console.error('Failed to load direct conversations:', err);
    }
  }, [user, supabase]);

  // Get or create direct conversation between two users
  const getOrCreateDirectConversation = useCallback(async (otherUserId: string) => {
    if (!user) return null;

    const userId1 = user.id < otherUserId ? user.id : otherUserId;
    const userId2 = user.id < otherUserId ? otherUserId : user.id;

    try {
      // First try to find existing conversation
      const { data: existing, error: findError } = await supabase
        .from('direct_conversations')
        .select('id')
        .eq('user1_id', userId1)
        .eq('user2_id', userId2)
        .single();

      if (existing && !findError) {
        return existing.id;
      }

      // Create new conversation if not found
      const { data: newConv, error: createError } = await supabase
        .from('direct_conversations')
        .insert({
          user1_id: userId1,
          user2_id: userId2,
          is_active: true
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating direct conversation:', createError);
        return null;
      }

      return newConv.id;
    } catch (err) {
      console.error('Failed to get/create direct conversation:', err);
      return null;
    }
  }, [user, supabase]);

  // Send direct message
  const sendDirectMessage = useCallback(async (otherUserId: string, content: string) => {
    if (!user || !content.trim()) return false;

    try {
      const conversationId = await getOrCreateDirectConversation(otherUserId);
      if (!conversationId) return false;

      // Use dedicated direct_messages table
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim(),
          message_type: 'text'
        });

      if (error) {
        console.error('Error sending direct message:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Failed to send direct message:', err);
      return false;
    }
  }, [user, supabase, getOrCreateDirectConversation]);

  // Load messages for direct conversation
  const loadDirectMessages = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      const { data: messages, error } = await supabase
        .from('direct_messages')
        .select(`
          id,
          sender_id,
          content,
          message_type,
          created_at,
          updated_at,
          is_edited,
          is_deleted
        `)
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading direct messages:', error);
        return;
      }

      // Get sender profiles
      const senderIds = [...new Set(messages?.map(msg => msg.sender_id) || [])];
      let profiles: any[] = [];
      
      if (senderIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, email, avatar_url')
          .in('id', senderIds);
        
        profiles = profileData || [];
      }

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const formattedMessages = (messages || []).map(msg => {
        const profile = profileMap.get(msg.sender_id);
        return {
          ...msg,
          sender_name: profile?.full_name || profile?.email || 'Unknown',
          sender_first_name: profile?.first_name,
          sender_avatar: profile?.avatar_url
        };
      });

      setDirectMessages(prev => ({
        ...prev,
        [conversationId]: formattedMessages
      }));

    } catch (err) {
      console.error('Failed to load direct messages:', err);
    }
  }, [user, supabase]);

  // Load posts for a specific channel
  const loadChannelPosts = useCallback(async (channelId: string) => {
    if (!user) return;

    console.log('Loading posts for channel:', channelId);

    try {
      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          id,
          author_id,
          title,
          content,
          post_type,
          tags,
          is_published,
          is_pinned,
          view_count,
          created_at,
          updated_at,
          published_at
        `)
        .eq('channel_id', channelId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading channel posts:', error);
        setError('Failed to load posts');
        return;
      }

      console.log('Loaded posts:', posts);

      // Get unique author IDs to fetch profile information
      const authorIds = [...new Set((posts || []).map(post => post.author_id))];
      let profiles: any[] = [];
      
      if (authorIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, email, avatar_url')
          .in('id', authorIds);
          
        if (profileError) {
          console.error('Error loading author profiles:', profileError);
        } else {
          profiles = profileData || [];
        }
      }

      // Create a profile lookup map
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const formattedPosts = (posts || []).map(post => {
        const profile = profileMap.get(post.author_id);
        return {
          ...post,
          author_name: profile?.full_name || profile?.email || 'Unknown',
          author_first_name: profile?.first_name,
          author_avatar: profile?.avatar_url
        };
      });

      console.log('Setting formatted posts for channel', channelId, formattedPosts);
      
      setChannelPosts(prev => ({
        ...prev,
        [channelId]: formattedPosts
      }));

    } catch (err) {
      console.error('Failed to load channel posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    }
  }, [user, supabase]);

  // Create a new post in a channel
  const createChannelPost = useCallback(async (
    channelId: string,
    title: string,
    content: string,
    postType: 'update' | 'announcement' | 'idea' | 'discussion' = 'update',
    tags: string[] = []
  ) => {
    if (!user || !content.trim()) return null;

    try {
      const { data: post, error } = await supabase
        .from('posts')
        .insert({
          channel_id: channelId,
          author_id: user.id,
          title: title.trim() || null,
          content: content.trim(),
          post_type: postType,
          tags: tags,
          is_published: true,
          is_pinned: false,
          view_count: 0
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating post:', error);
        setError('Failed to create post');
        return null;
      }

      // Reload posts for this channel to include the new one
      await loadChannelPosts(channelId);
      
      return post.id;

    } catch (err) {
      console.error('Failed to create post:', err);
      setError(err instanceof Error ? err.message : 'Failed to create post');
      return null;
    }
  }, [user, supabase, loadChannelPosts]);

  // Initial load of direct conversations
  useEffect(() => {
    if (user) {
      loadDirectConversations();
    }
  }, [user, loadDirectConversations]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      cleanupSubscriptions();
    };
  }, [cleanupSubscriptions]);

  return {
    channels,
    channelMessages,
    channelMembers,
    directConversations,
    directMessages,
    channelPosts,
    loading,
    error,
    loadChannels,
    createChannel,
    loadChannelMessages,
    sendChannelMessage,
    addChannelMembers,
    loadDirectConversations,
    sendDirectMessage,
    loadDirectMessages,
    getOrCreateDirectConversation,
    loadChannelPosts,
    createChannelPost,
    clearError: () => setError(null),
    cleanupSubscriptions
  };
}
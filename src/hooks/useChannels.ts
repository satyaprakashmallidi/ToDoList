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
      // First get the user's team invite IDs (user might be in multiple teams)
      let teamMembers;
      let teamError;
      
      const result = await supabase
        .from('team_members')
        .select('team_invite_id')
        .eq('user_id', user.id);
        
      teamMembers = result.data;
      teamError = result.error;

      if (teamError || !teamMembers || teamMembers.length === 0) {
        console.log('No team membership found, creating default team membership');
        
        // Create a default team invite and membership for this user
        try {
          // First create a team invite with 6-character unique code
          // Try different variations if there are conflicts
          let uniqueCode = user.id.substring(0, 6).toUpperCase();
          let teamInvite = null;
          let inviteError = null;
          
          for (let attempt = 0; attempt < 5; attempt++) {
            const result = await supabase
              .from('team_invites')
              .insert({
                code: uniqueCode,
                created_by: user.id,
                expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
              })
              .select()
              .single();
              
            teamInvite = result.data;
            inviteError = result.error;
            
            if (!inviteError) break; // Success
            
            // If duplicate, try with a different variation
            if (inviteError.code === '23505') { // Unique constraint violation
              uniqueCode = (user.id.substring(0, 4) + String(attempt + 1).padStart(2, '0')).toUpperCase();
              continue;
            }
            
            // Other error, break
            break;
          }

          if (inviteError || !teamInvite) {
            console.error('Failed to create default team invite:', inviteError);
            setChannels([]);
            setLoading(false);
            return;
          }

          // Then create team membership
          const { error: memberError } = await supabase
            .from('team_members')
            .insert({
              user_id: user.id,
              team_invite_id: teamInvite.id
            });

          if (memberError) {
            console.error('Failed to create default team membership:', memberError);
            setChannels([]);
            setLoading(false);
            return;
          }

          console.log('✅ Created default team membership with code:', uniqueCode, 'team_invite_id:', teamInvite.id);
          
          // Set the newly created team membership for use
          teamMembers = [{ team_invite_id: teamInvite.id }];
        } catch (error) {
          console.error('Error creating default team membership:', error);
          setChannels([]);
          setLoading(false);
          return;
        }
      }

      // Use the first team for now (you might want to let user choose later)
      const teamMember = teamMembers[0];
      console.log(`Found ${teamMembers.length} team memberships, using first one:`, teamMember);

      // Get channels where user is a member (regardless of team_invite_id for now)
      const { data: userChannelMemberships, error: membershipsError } = await supabase
        .from('channel_members')
        .select(`
          channel_id,
          channels!inner(*)
        `)
        .eq('user_id', user.id)
        .eq('channels.is_archived', false)
        .is('left_at', null);

      console.log('Channel memberships found:', userChannelMemberships?.length || 0);

      if (membershipsError) {
        console.error('Error loading channel memberships:', membershipsError);
        setError('Failed to load channels');
        return;
      }

      const teamChannels = userChannelMemberships?.map(membership => membership.channels) || [];

      // Get member counts for all channels in parallel
      const channelIds = teamChannels.map(channel => channel.id);
      const memberCountPromises = channelIds.map(async (channelId) => {
        const { count, error } = await supabase
          .from('channel_members')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', channelId)
          .is('left_at', null);
        
        if (error) {
          console.error(`Error counting members for channel ${channelId}:`, error);
          return { channelId, count: 1 }; // Default to 1 (at least the creator)
        }
        
        return { channelId, count: count || 1 };
      });

      const memberCounts = await Promise.all(memberCountPromises);
      const memberCountMap = new Map(memberCounts.map(({ channelId, count }) => [channelId, count]));

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
        member_count: memberCountMap.get(channel.id) || 1,
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

      // Reload channels to get updated member counts
      await loadChannels();

      return true;

    } catch (err) {
      console.error('Failed to add channel members:', err);
      setError(err instanceof Error ? err.message : 'Failed to add members');
      return false;
    }
  }, [user, supabase, loadChannels]);

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
      // First get direct conversations without profile joins
      const { data: conversations, error } = await supabase
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

      console.log('📇 Direct conversations loaded (without profiles):', conversations?.length || 0);

      if (!conversations || conversations.length === 0) {
        setDirectConversations([]);
        return;
      }

      // Get unique user IDs from conversations to fetch profiles separately
      const userIds = new Set<string>();
      conversations.forEach(conv => {
        userIds.add(conv.user1_id);
        userIds.add(conv.user2_id);
      });

      // Fetch profiles for all users involved in conversations
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, name, email, avatar_url')
        .in('id', Array.from(userIds));

      if (profileError) {
        console.error('Error loading profiles for direct conversations:', profileError);
        // Continue without profile data
      }

      // Create profile lookup map
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Combine conversations with profile data
      const conversationsWithProfiles = conversations.map(conv => ({
        ...conv,
        user1_profile: profileMap.get(conv.user1_id) || null,
        user2_profile: profileMap.get(conv.user2_id) || null
      }));

      console.log('📇 Direct conversations with profiles:', conversationsWithProfiles.length, conversationsWithProfiles);
      setDirectConversations(conversationsWithProfiles);
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
  const sendDirectMessage = useCallback(async (
    otherUserId: string, 
    content: string,
    messageType: string = 'text',
    fileUrl?: string,
    fileName?: string,
    fileSize?: number
  ) => {
    if (!user) return false;
    
    // For text messages, content must not be empty
    if (messageType === 'text' && !content.trim()) return false;
    // For file messages, fileUrl must exist
    if (messageType === 'file' && !fileUrl) return false;

    try {
      const conversationId = await getOrCreateDirectConversation(otherUserId);
      if (!conversationId) return false;

      // Prepare message data based on type
      const messageData: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.trim() || fileName || 'File',
        message_type: messageType
      };

      // Add file-specific fields if it's a file message
      if (messageType === 'file' && fileUrl) {
        messageData.file_url = fileUrl;
        messageData.file_name = fileName;
        messageData.file_size = fileSize;
      }

      // Use dedicated direct_messages table
      const { error } = await supabase
        .from('direct_messages')
        .insert(messageData);

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
          file_url,
          file_name,
          file_size,
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

  // Add or toggle a reaction to a post
  const togglePostReaction = useCallback(async (
    postId: string,
    reactionType: 'like' | 'love' | 'laugh' | 'sad' | 'angry'
  ) => {
    if (!user) return false;

    try {
      // Check if user already has this reaction on this post
      const { data: existingReactions, error: checkError } = await supabase
        .from('post_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('reaction_type', reactionType);

      if (checkError) {
        console.error('Error checking existing reaction:', checkError);
        return false;
      }

      if (existingReactions && existingReactions.length > 0) {
        const existingReaction = existingReactions[0];
        // Remove existing reaction
        const { error: deleteError } = await supabase
          .from('post_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (deleteError) {
          console.error('Error removing reaction:', deleteError);
          return false;
        }
        
        console.log('Reaction removed successfully');
        return true;
      } else {
        // Add new reaction
        const { error: insertError } = await supabase
          .from('post_reactions')
          .insert({
            post_id: postId,
            user_id: user.id,
            reaction_type: reactionType
          });

        if (insertError) {
          console.error('Error adding reaction:', insertError);
          return false;
        }

        console.log('Reaction added successfully');
        return true;
      }
    } catch (err) {
      console.error('Failed to toggle post reaction:', err);
      return false;
    }
  }, [user, supabase]);

  // Get reactions for a post
  const getPostReactions = useCallback(async (postId: string) => {
    if (!user) return [];

    console.log('Fetching reactions for post:', postId);

    try {
      const { data: reactions, error } = await supabase
        .from('post_reactions')
        .select(`
          id,
          user_id,
          reaction_type,
          created_at
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching post reactions:', error);
        return [];
      }

      console.log(`Raw reactions from database for post ${postId}:`, reactions);
      console.log(`Sample reaction structure:`, reactions?.[0]);

      // Get user profiles separately if we have reactions
      if (reactions && reactions.length > 0) {
        const userIds = [...new Set(reactions.map(r => r.user_id))];
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profileError) {
          console.error('Error fetching user profiles for reactions:', profileError);
        } else {
          // Merge profile data with reactions
          const profileMap = new Map(profiles.map(p => [p.id, p]));
          return reactions.map(reaction => ({
            ...reaction,
            profiles: profileMap.get(reaction.user_id)
          }));
        }
      }

      return reactions || [];
    } catch (err) {
      console.error('Failed to get post reactions:', err);
      return [];
    }
  }, [user, supabase]);

  // Add a comment to a post
  const addPostComment = useCallback(async (
    postId: string,
    content: string,
    replyToId?: string
  ) => {
    if (!user || !content.trim()) return null;

    try {
      const { data: comment, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content: content.trim(),
          reply_to_id: replyToId || null
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding comment:', error);
        return null;
      }

      console.log('Comment added successfully');
      return comment;
    } catch (err) {
      console.error('Failed to add post comment:', err);
      return null;
    }
  }, [user, supabase]);

  // Get comments for a post
  const getPostComments = useCallback(async (postId: string) => {
    if (!user) return [];

    try {
      const { data: comments, error } = await supabase
        .from('post_comments')
        .select(`
          id,
          post_id,
          author_id,
          content,
          reply_to_id,
          is_edited,
          created_at,
          updated_at
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching post comments:', error);
        return [];
      }

      // Get user profiles separately if we have comments
      if (comments && comments.length > 0) {
        const authorIds = [...new Set(comments.map(c => c.author_id))];
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', authorIds);

        if (profileError) {
          console.error('Error fetching user profiles for comments:', profileError);
        } else {
          // Merge profile data with comments
          const profileMap = new Map(profiles.map(p => [p.id, p]));
          return comments.map(comment => ({
            ...comment,
            profiles: profileMap.get(comment.author_id)
          }));
        }
      }

      return comments || [];
    } catch (err) {
      console.error('Failed to get post comments:', err);
      return [];
    }
  }, [user, supabase]);

  // Mark a message as read
  const markMessageAsRead = useCallback(async (messageId: string, messageType?: 'direct' | 'channel') => {
    if (!user || !messageId) return false;

    try {
      console.log('Attempting to mark message as read:', { messageId, userId: user.id, messageType });
      
      // Skip message type detection since we don't need it for localStorage
      let actualMessageType = messageType || 'unknown';
      console.log('Skipping message type detection, using:', actualMessageType);
      
      console.log('Determined message type:', actualMessageType);
      
      // Use localStorage directly since database table doesn't exist
      console.log('Using localStorage for read tracking');
      const readKey = `read_${user.id}_${messageId}`;
      localStorage.setItem(readKey, new Date().toISOString());
      console.log('Stored read status in localStorage:', readKey);
      return true;
    } catch (err) {
      console.error('Failed to mark message as read:', err);
      return false;
    }
  }, [user, supabase]);

  // Mark multiple channel messages as read
  const markChannelMessagesAsRead = useCallback(async (channelId: string) => {
    if (!user || !channelId) return false;

    try {
      console.log('Marking channel messages as read for channel:', channelId);
      
      // Get all messages for this channel that are not sent by the current user
      const { data: messages, error: messagesError } = await supabase
        .from('channel_messages')
        .select('id, sender_id, content')
        .eq('channel_id', channelId)
        .eq('is_deleted', false)
        .neq('sender_id', user.id);

      if (messagesError) {
        console.error('Error fetching channel messages:', messagesError);
        return false;
      }

      console.log('Found channel messages to mark as read:', messages);

      if (!messages || messages.length === 0) {
        console.log('No channel messages to mark as read');
        return true;
      }

      // Mark all messages as read using localStorage
      const timestamp = new Date().toISOString();
      messages.forEach(msg => {
        const readKey = `read_${user.id}_${msg.id}`;
        localStorage.setItem(readKey, timestamp);
      });

      console.log(`Successfully marked ${messages.length} channel messages as read using localStorage`);
      return true;
    } catch (err) {
      console.error('Failed to mark channel messages as read:', err);
      return false;
    }
  }, [user, supabase]);

  // Mark direct messages as read for a conversation
  const markDirectMessagesAsRead = useCallback(async (conversationId: string) => {
    if (!user || !conversationId) return false;

    try {
      console.log('Marking direct messages as read for conversation:', conversationId);
      
      // Get all messages for this conversation that are not sent by the current user
      const { data: messages, error: messagesError } = await supabase
        .from('direct_messages')
        .select('id, sender_id, content')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .neq('sender_id', user.id);

      if (messagesError) {
        console.error('Error fetching messages for conversation:', messagesError);
        return false;
      }

      console.log('Found messages to mark as read:', messages);

      if (!messages || messages.length === 0) {
        console.log('No messages to mark as read');
        return true;
      }

      // Mark messages as read using localStorage
      const timestamp = new Date().toISOString();
      messages.forEach(msg => {
        const readKey = `read_${user.id}_${msg.id}`;
        localStorage.setItem(readKey, timestamp);
      });

      console.log(`Successfully marked ${messages.length} direct messages as read using localStorage`);
      return true;
    } catch (err) {
      console.error('Failed to mark direct messages as read:', err);
      return false;
    }
  }, [user, supabase]);

  // Simple test function to verify basic message_reads functionality
  const testMessageReads = useCallback(async () => {
    if (!user) return;

    console.log('Testing message_reads functionality...');
    
    try {
      // WORKAROUND: Skip messages table due to RLS recursion
      console.log('Skipping messages table - RLS policies still causing infinite recursion');
      console.log('Please disable ALL RLS policies on messages table in Supabase dashboard');
      
      // Only test message_reads table directly
      console.log('Testing alternative message tables...');
      
      // Check channel_messages table instead
      const { data: channelMessages, error: channelError } = await supabase
        .from('channel_messages')
        .select('id, content, sender_id, channel_id')
        .eq('is_deleted', false)
        .limit(5);
        
      console.log('Channel messages found:', channelMessages);
      
      if (channelError) {
        console.error('Channel messages error:', channelError);
      }
      
      // Check group_messages table instead
      const { data: groupMessages, error: groupError } = await supabase
        .from('group_messages')
        .select('id, content, sender_id, group_id')
        .eq('is_deleted', false)
        .limit(5);
        
      console.log('Group messages found:', groupMessages);
      
      if (groupError) {
        console.error('Group messages error:', groupError);
      }

      // Test message_reads table directly
      const { data: existingReads, error: readsError } = await supabase
        .from('message_reads')
        .select('*')
        .eq('user_id', user.id)
        .limit(5);

      if (readsError) {
        console.error('Error fetching existing reads:', readsError);
        return;
      }

      console.log('Existing read records for user:', existingReads);
      console.log('Message reads test completed successfully');

    } catch (err) {
      console.error('Test failed:', err);
    }
  }, [user, supabase]);

  // Helper function to get user's message IDs
  const getUserMessageIds = useCallback(async () => {
    if (!user) return '';

    try {
      const { data: userMessages, error } = await supabase
        .from('channel_messages')
        .select('id')
        .eq('sender_id', user.id)
        .eq('is_deleted', false);

      if (error || !userMessages) {
        return '';
      }

      return userMessages.map(m => m.id).join(',');
    } catch (err) {
      console.error('Failed to get user message IDs:', err);
      return '';
    }
  }, [user, supabase]);

  // Get unread replies for the current user
  const getUnreadReplies = useCallback(async () => {
    if (!user) return [];

    try {
      let allMessages: any[] = [];

      // Get messages from direct_messages table
      console.log('Fetching from direct_messages table...');
      const { data: directMessages, error: directError } = await supabase
        .from('direct_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          created_at,
          updated_at,
          reply_to_id
        `)
        .eq('is_deleted', false)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(25);

      if (directError) {
        console.error('Error fetching direct messages:', directError);
      } else {
        console.log('Direct messages found:', directMessages?.length || 0);
        allMessages = [...allMessages, ...(directMessages || []).map(msg => ({ ...msg, message_type: 'direct' }))];
      }

      // Get messages from channel_messages table
      console.log('Fetching from channel_messages table...');
      const { data: channelMessages, error: channelError } = await supabase
        .from('channel_messages')
        .select(`
          id,
          channel_id,
          sender_id,
          content,
          created_at,
          updated_at,
          reply_to_id
        `)
        .eq('is_deleted', false)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(25);

      if (channelError) {
        console.error('Error fetching channel messages:', channelError);
      } else {
        console.log('Channel messages found:', channelMessages?.length || 0);
        allMessages = [...allMessages, ...(channelMessages || []).map(msg => ({ ...msg, message_type: 'channel' }))];
      }

      console.log('Total messages found:', allMessages.length);

      if (allMessages.length === 0) {
        console.log('No messages found in any table');
        return [];
      }

      // Sort all messages by created_at
      allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Get read status for all these messages - use localStorage since database table doesn't exist
      let readMessageIds = new Set<string>();

      console.log('Checking localStorage for read status...');

      // Fallback: Check localStorage for read status
      allMessages.forEach(msg => {
        const readKey = `read_${user.id}_${msg.id}`;
        if (localStorage.getItem(readKey)) {
          readMessageIds.add(msg.id);
        }
      });

      console.log('Read message IDs (combined):', readMessageIds);

      // Get channel names for messages that have channel_id (separate query to avoid RLS issues)
      const channelIds = [...new Set(allMessages.filter(m => m.channel_id).map(m => m.channel_id))];
      let channelNames: Record<string, string> = {};
      
      if (channelIds.length > 0) {
        const { data: channels, error: channelsError } = await supabase
          .from('channels')
          .select('id, name')
          .in('id', channelIds);
          
        if (channelsError) {
          console.error('Error fetching channel names:', channelsError);
        } else {
          channelNames = Object.fromEntries((channels || []).map(c => [c.id, c.name]));
        }
      }

      // Filter to only unread messages and format them
      const unreadMessages = allMessages
        .filter(msg => !readMessageIds.has(msg.id))
        .map(msg => ({
          ...msg,
          message_type: msg.channel_id ? 'channel' as const : 'direct' as const,
          sender_name: 'User', // You can enhance this by joining with profiles table later
          location_name: msg.channel_id ? 
            (channelNames[msg.channel_id] || 'Unknown Channel') : 
            'Direct Message'
        }));

      console.log('Filtered unread messages:', unreadMessages);
      return unreadMessages;

    } catch (err) {
      console.error('Failed to get unread replies:', err);
      return [];
    }
  }, [user, supabase]);

  // Get read replies for the current user
  const getReadReplies = useCallback(async () => {
    if (!user) return [];

    try {
      console.log('Getting read replies for user:', user.email);
      let allMessages: any[] = [];

      // Get messages from direct_messages table
      const { data: directMessages, error: directError } = await supabase
        .from('direct_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          created_at,
          updated_at,
          reply_to_id
        `)
        .eq('is_deleted', false)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(25);

      if (directError) {
        console.error('Error fetching direct messages for read:', directError);
      } else {
        allMessages = [...allMessages, ...(directMessages || []).map(msg => ({ ...msg, message_type: 'direct' }))];
      }

      // Get messages from channel_messages table
      const { data: channelMessages, error: channelError } = await supabase
        .from('channel_messages')
        .select(`
          id,
          channel_id,
          sender_id,
          content,
          created_at,
          updated_at,
          reply_to_id
        `)
        .eq('is_deleted', false)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(25);

      if (channelError) {
        console.error('Error fetching channel messages for read:', channelError);
      } else {
        allMessages = [...allMessages, ...(channelMessages || []).map(msg => ({ ...msg, message_type: 'channel' }))];
      }

      if (allMessages.length === 0) {
        console.log('No messages found for read check');
        return [];
      }

      // Sort all messages by created_at
      allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Get read status for all these messages - use localStorage since database table doesn't exist
      let readMessageIds = new Set<string>();

      console.log('Checking localStorage for read status (read section)...');

      // Fallback: Check localStorage for read status
      allMessages.forEach(msg => {
        const readKey = `read_${user.id}_${msg.id}`;
        if (localStorage.getItem(readKey)) {
          readMessageIds.add(msg.id);
        }
      });

      console.log('Read message IDs for read section (combined):', readMessageIds);

      // Get channel names for messages that have channel_id
      const channelIds = [...new Set(allMessages.filter(m => m.channel_id).map(m => m.channel_id))];
      let channelNames: Record<string, string> = {};
      
      if (channelIds.length > 0) {
        const { data: channels, error: channelsError } = await supabase
          .from('channels')
          .select('id, name')
          .in('id', channelIds);
          
        if (!channelsError) {
          channelNames = Object.fromEntries((channels || []).map(c => [c.id, c.name]));
        }
      }

      // Filter to only READ messages and format them
      const readMessagesFormatted = allMessages
        .filter(msg => readMessageIds.has(msg.id))
        .map(msg => ({
          ...msg,
          message_type: msg.channel_id ? 'channel' as const : 'direct' as const,
          sender_name: 'User',
          location_name: msg.channel_id ? 
            (channelNames[msg.channel_id] || 'Unknown Channel') : 
            'Direct Message'
        }));

      console.log('Read messages found:', readMessagesFormatted.length);
      return readMessagesFormatted;

    } catch (err) {
      console.error('Failed to get read replies:', err);
      return [];
    }
  }, [user, supabase]);

  // Get sent messages for the current user
  const getSentMessages = useCallback(async () => {
    if (!user) return [];

    try {
      let allMessages: any[] = [];

      // Get messages from direct_messages table that user sent
      console.log('Fetching sent direct messages...');
      const { data: directMessages, error: directError } = await supabase
        .from('direct_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          created_at,
          updated_at
        `)
        .eq('is_deleted', false)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (directError) {
        console.error('Error fetching sent direct messages:', directError);
      } else {
        console.log('Sent direct messages found:', directMessages?.length || 0);
        allMessages = [...allMessages, ...(directMessages || []).map(msg => ({ ...msg, message_type: 'direct' }))];
      }

      // Get messages from channel_messages table that user sent
      console.log('Fetching sent channel messages...');
      const { data: channelMessages, error: channelError } = await supabase
        .from('channel_messages')
        .select(`
          id,
          channel_id,
          sender_id,
          content,
          created_at,
          updated_at
        `)
        .eq('is_deleted', false)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (channelError) {
        console.error('Error fetching sent channel messages:', channelError);
      } else {
        console.log('Sent channel messages found:', channelMessages?.length || 0);
        allMessages = [...allMessages, ...(channelMessages || []).map(msg => ({ ...msg, message_type: 'channel' }))];
      }

      console.log('Total sent messages found:', allMessages.length);

      if (allMessages.length === 0) {
        console.log('No sent messages found in any table');
        return [];
      }

      // Sort all messages by created_at (most recent first)
      allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Get channel and conversation names for display
      const channelIds = [...new Set(allMessages.filter(msg => msg.channel_id).map(msg => msg.channel_id))];
      const conversationIds = [...new Set(allMessages.filter(msg => msg.conversation_id).map(msg => msg.conversation_id))];

      // Get channel names
      let channelNames: Record<string, string> = {};
      if (channelIds.length > 0) {
        const { data: channelData } = await supabase
          .from('channels')
          .select('id, name')
          .in('id', channelIds);
        
        if (channelData) {
          channelNames = channelData.reduce((acc, channel) => {
            acc[channel.id] = channel.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Get conversation partner names for direct messages
      let conversationNames: Record<string, string> = {};
      if (conversationIds.length > 0) {
        // First get conversations without profile joins
        const { data: conversations } = await supabase
          .from('direct_conversations')
          .select(`
            id,
            user1_id,
            user2_id
          `)
          .in('id', conversationIds);

        if (conversations && conversations.length > 0) {
          // Get user IDs for profile lookup
          const allUserIds = new Set<string>();
          conversations.forEach(conv => {
            allUserIds.add(conv.user1_id);
            allUserIds.add(conv.user2_id);
          });

          // Fetch profiles separately
          const { data: userProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', Array.from(allUserIds));

          const profileMap = new Map((userProfiles || []).map(p => [p.id, p]));

          conversationNames = conversations.reduce((acc, conv) => {
            // Get the other user's info (not the current user)
            const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
            const otherUser = profileMap.get(otherUserId);
            acc[conv.id] = otherUser?.full_name || otherUser?.email || 'Unknown User';
            
            // Also store the other user's ID for navigation purposes
            acc[`${conv.id}_recipient_id`] = otherUserId;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Format messages with location information
      const sentMessagesFormatted = allMessages.map(msg => ({
        ...msg,
        sender_name: user.full_name || user.email || 'You',
        location_name: msg.message_type === 'channel' 
          ? channelNames[msg.channel_id] || 'Unknown Channel'
          : conversationNames[msg.conversation_id] || 'Direct Message',
        recipient_id: msg.message_type === 'direct' 
          ? conversationNames[`${msg.conversation_id}_recipient_id`]
          : null,
        sentAt: msg.created_at
      }));

      console.log('Formatted sent messages:', sentMessagesFormatted.length);
      return sentMessagesFormatted;

    } catch (err) {
      console.error('Failed to get sent messages:', err);
      return [];
    }
  }, [user, supabase]);

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
    togglePostReaction,
    getPostReactions,
    addPostComment,
    getPostComments,
    markMessageAsRead,
    markChannelMessagesAsRead,
    markDirectMessagesAsRead,
    getUnreadReplies,
    getReadReplies,
    getSentMessages,
    testMessageReads,
    clearError: () => setError(null),
    cleanupSubscriptions
  };
}
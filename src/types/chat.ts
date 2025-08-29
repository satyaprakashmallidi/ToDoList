export interface ChatUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  isOnline?: boolean;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  sender_first_name?: string;
  sender_avatar?: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  is_deleted: boolean;
  message_type: 'text' | 'image' | 'file' | 'system';
}

export interface ChatGroup {
  id: string;
  name: string;
  description?: string;
  admin_id: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
  last_message?: ChatMessage;
  unread_count?: number;
}

export interface DirectChat {
  id: string;
  user: ChatUser;
  last_message?: ChatMessage;
  unread_count?: number;
}

export type ChatConversation = {
  id: string;
  type: 'direct' | 'group';
  name: string;
  avatar?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  updated_at: string;
  isOnline?: boolean;
  member_count?: number;
  admin_id?: string;
  user_role?: string;
};

export interface GroupMember {
  id: string;
  user_id: string;
  group_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  is_active: boolean;
  user: ChatUser;
}

export interface Channel {
  id: string;
  team_invite_id: string | null;
  name: string;
  description?: string;
  channel_type: 'text' | 'voice' | 'announcement';
  category?: string;
  is_private: boolean;
  is_archived: boolean;
  created_by: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  member_count?: number;
  unread_count?: number;
  last_message?: ChannelMessage;
}

export interface ChannelMember {
  id: string;
  channel_id: string | null;
  user_id: string | null;
  role: 'admin' | 'moderator' | 'member' | null;
  can_post: boolean | null;
  can_manage: boolean | null;
  added_by: string | null;
  joined_at: string | null;
  left_at: string | null;
  created_at: string | null;
  user: ChatUser;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  reply_to_id?: string;
  is_edited: boolean;
  is_deleted: boolean;
  deleted_by?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  sender_name: string;
  sender_first_name?: string;
  sender_avatar?: string;
}
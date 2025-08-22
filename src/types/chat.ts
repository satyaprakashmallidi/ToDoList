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
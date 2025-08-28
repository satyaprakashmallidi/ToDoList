# chat.ts - TypeScript Type Definitions

## File Location
`src/types/chat.ts`

## Purpose
Defines all TypeScript interfaces and types used throughout the chat feature, ensuring type safety and consistency across components.

## Type Definitions

### ChatUser
Represents a user in the chat system.
```typescript
interface ChatUser {
  id: string;              // User's unique ID
  name: string;            // Display name
  email: string;           // Email address
  avatar_url?: string;     // Optional profile picture URL
  isOnline?: boolean;      // Online status indicator
}
```
**Usage**: Team member selection, message sender info, user profiles

### ChatMessage
Represents a single message in a conversation.
```typescript
interface ChatMessage {
  id: string;                    // Message unique ID
  content: string;               // Message text content
  sender_id: string;             // ID of message sender
  sender_name: string;           // Display name of sender
  sender_first_name?: string;    // First name for avatar
  sender_avatar?: string;        // Sender's profile picture
  created_at: string;            // Timestamp of creation
  updated_at: string;            // Timestamp of last edit
  is_edited: boolean;            // Edit status flag
  is_deleted: boolean;           // Soft delete flag
  message_type: 'text' | 'image' | 'file' | 'system';  // Message type enum
}
```
**Usage**: Message display, message history, real-time updates

### ChatGroup
Represents a group conversation with multiple members.
```typescript
interface ChatGroup {
  id: string;                 // Group unique ID
  name: string;               // Group name
  description?: string;       // Optional group description
  admin_id: string;           // Group creator/admin ID
  avatar_url?: string;        // Group avatar image
  is_active: boolean;         // Active status
  created_at: string;         // Creation timestamp
  updated_at: string;         // Last update timestamp
  member_count?: number;      // Total members in group
  last_message?: ChatMessage; // Most recent message
  unread_count?: number;      // Unread messages count
}
```
**Usage**: Group management, group info display, admin features

### DirectChat
Represents a one-on-one conversation between two users.
```typescript
interface DirectChat {
  id: string;                 // Chat unique ID
  user: ChatUser;             // Other participant info
  last_message?: ChatMessage; // Most recent message
  unread_count?: number;      // Unread messages count
}
```
**Usage**: Direct message conversations, user-to-user chat

### ChatConversation
Unified type for both direct and group conversations.
```typescript
type ChatConversation = {
  id: string;                    // Conversation ID
  type: 'direct' | 'group';      // Conversation type
  name: string;                  // Display name
  avatar?: string;               // Avatar image URL
  last_message?: string;         // Latest message preview
  last_message_time?: string;    // Timestamp of last message
  unread_count: number;          // Unread count
  updated_at: string;            // Last update timestamp
  isOnline?: boolean;            // Online status (direct chats)
  member_count?: number;         // Member count (groups)
  admin_id?: string;             // Admin ID (groups)
  user_role?: string;            // Current user's role
}
```
**Usage**: Conversation list, active conversation state, sidebar display

### GroupMember
Represents a member of a group chat.
```typescript
interface GroupMember {
  id: string;              // Membership record ID
  user_id: string;         // User's ID
  group_id: string;        // Group's ID
  role: 'admin' | 'member'; // Member's role in group
  joined_at: string;       // Join timestamp
  is_active: boolean;      // Active membership status
  user: ChatUser;          // User details
}
```
**Usage**: Group member management, role assignments, member lists

## Type Relationships

### Hierarchy
1. **ChatUser**: Base user entity
2. **ChatMessage**: Uses ChatUser for sender info
3. **ChatGroup/DirectChat**: Contains ChatMessages
4. **ChatConversation**: Abstraction over ChatGroup/DirectChat
5. **GroupMember**: Links ChatUser to ChatGroup

### Key Relationships
- Messages belong to conversations (group or direct)
- Users can be members of multiple groups
- Groups have one admin (creator) and multiple members
- Direct chats involve exactly two users
- Conversations unify the interface for both chat types

## Usage Patterns

### Component Usage
- **ChatSidebar**: Uses `ChatConversation[]` for list
- **ChatArea**: Uses `ChatMessage[]` for display
- **CreateGroupModal**: Uses `ChatUser[]` for selection
- **useChat Hook**: Manages all types in state

### Type Guards
```typescript
// Check if conversation is a group
if (conversation.type === 'group') {
  // Access group-specific properties
  console.log(conversation.member_count);
}

// Check message type
if (message.message_type === 'system') {
  // Handle system messages differently
}
```

### Optional Properties
Many properties are optional (`?`) to handle:
- Partial data during loading
- Different states (online/offline)
- Feature availability (avatars, descriptions)

## Benefits
1. **Type Safety**: Prevents runtime errors
2. **IntelliSense**: IDE autocompletion
3. **Documentation**: Self-documenting code
4. **Refactoring**: Safe code changes
5. **Consistency**: Uniform data structures
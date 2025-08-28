# useChat.ts - Chat Management Hook

## File Location
`src/hooks/useChat.ts`

## Purpose
Central custom hook that manages all chat-related state and operations including conversations, messages, real-time subscriptions, and group management.

## Key Functionalities

### State Management
- **conversations**: Array of all user's conversations (groups and direct)
- **messages**: Object mapping conversation IDs to message arrays
- **teamMembers**: Available team members for group creation
- **loading**: Loading state indicator
- **error**: Error message state
- **subscriptionsRef**: Tracks active real-time subscriptions

### Core Features

1. **Conversation Management**
   - Load user's conversations (groups)
   - Real-time updates for conversation changes
   - Sort and filter conversations
   - Handle conversation metadata updates

2. **Message Operations**
   - Load message history for conversations
   - Send new messages with optimistic updates
   - Real-time message subscriptions
   - Handle message edits and deletions

3. **Real-time Subscriptions**
   - Subscribe to new messages in active conversations
   - Listen for message edits and deletions
   - Monitor group membership changes
   - Track group info updates (name changes, etc.)

4. **Group Management**
   - Create new chat groups with selected members
   - Delete groups (admin only)
   - Load team members for group creation
   - Handle group member additions/removals

## Key Methods

### loadConversations
- Fetches all user's chat groups using RPC function
- Converts database records to conversation format
- Updates local state with formatted conversations
- Handles errors gracefully

### subscribeToMessages
- Creates real-time subscription for a specific conversation
- Handles INSERT, UPDATE, and DELETE events
- Fetches sender profile information
- Updates local state optimistically
- Manages subscription lifecycle

### loadMessages
- Loads message history for a conversation
- Uses RPC function with profile data included
- Falls back to direct query if RPC fails
- Formats messages with sender information
- Triggers real-time subscription

### sendMessage
- Validates message content
- Inserts message to database
- Adds message to local state immediately (optimistic)
- Includes sender profile information
- Handles errors with user feedback

### loadTeamMembers
- Fetches team members via RPC function
- Formats member data for UI display
- Filters to only actual team members
- Used for group creation member selection

### createGroup
- Validates group name and members
- Calls RPC function to create group
- Adds creator as admin automatically
- Reloads conversations to show new group
- Returns group ID for navigation

### deleteGroup
- Admin-only operation
- Calls RPC function for safe deletion
- Removes group from local state
- Cleans up related messages
- Returns success/failure status

### cleanupSubscriptions
- Removes all active real-time channels
- Clears subscription references
- Called on unmount or user change

## Real-time Features

### Message Subscriptions
- **New Messages**: Instant updates when messages arrive
- **Edits**: Live updates when messages are edited
- **Deletions**: Immediate removal from UI
- **Sender Info**: Fetches profile data for display

### Group Subscriptions
- **Member Changes**: Updates when users join/leave
- **Group Updates**: Name and settings changes
- **Deletion**: Removes group from UI when deleted

## Database Integration

### RPC Functions Used
- `get_user_chat_groups`: Fetch user's groups with metadata
- `get_group_messages_with_profiles`: Load messages with sender info
- `get_user_team_members`: Fetch available team members
- `create_chat_group`: Create new group with members
- `delete_chat_group`: Admin group deletion

### Tables Accessed
- `chat_groups`: Group metadata
- `chat_group_members`: Group membership
- `group_messages`: Message content
- `profiles`: User profile information

## Error Handling
- Comprehensive error catching
- User-friendly error messages
- Fallback queries for compatibility
- Console logging for debugging
- Error state management

## Performance Optimizations
- Optimistic UI updates for messages
- Efficient subscription management
- Batched profile fetching
- Memoized callbacks with useCallback
- Cleanup on component unmount

## Hook Return Values
```typescript
{
  conversations: ChatConversation[];
  messages: Record<string, ChatMessage[]>;
  teamMembers: ChatUser[];
  loading: boolean;
  error: string | null;
  loadConversations: Function;
  loadMessages: Function;
  sendMessage: Function;
  createGroup: Function;
  deleteGroup: Function;
  clearError: Function;
  cleanupSubscriptions: Function;
}
```

## Usage Example
```tsx
const {
  conversations,
  messages,
  sendMessage,
  createGroup
} = useChat();
```

## Dependencies
- Supabase client for database operations
- Auth context for user information
- Chat type definitions
- RealtimeChannel from Supabase
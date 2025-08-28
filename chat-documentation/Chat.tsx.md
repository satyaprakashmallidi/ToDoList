# Chat.tsx - Main Chat Page Component

## File Location
`src/pages/Chat.tsx`

## Purpose
Main orchestrator component for the chat feature. Manages overall chat state, conversation selection, and coordinates between sidebar and chat area components.

## Key Functionalities

### State Management
- **activeConversation**: Currently selected conversation (direct message or group)
- **showCreateGroupModal**: Controls visibility of group creation modal
- **isMobileSidebarOpen**: Manages sidebar visibility on mobile devices

### Core Features

1. **Conversation Management**
   - Loads and displays all conversations (direct & group)
   - Handles conversation selection and switching
   - Manages active conversation state

2. **Message Handling**
   - Sends messages to active conversation
   - Loads message history when conversation is selected
   - Real-time message display through useChat hook

3. **Group Management**
   - Create new group conversations
   - Delete existing groups
   - Add/manage group members

4. **Responsive Design**
   - Mobile-first approach with collapsible sidebar
   - Automatic sidebar toggle on conversation selection (mobile)
   - Back navigation to conversation list on mobile

### Component Dependencies
- `ChatSidebar`: Displays list of conversations
- `ChatArea`: Shows messages for active conversation
- `MessageInput`: Text input for sending messages
- `CreateGroupModal`: Modal for creating new groups
- `useChat`: Custom hook for all chat operations
- `useAuth`: Authentication context for user info

### Data Flow
1. Fetches conversations and team members via `useChat` hook
2. User selects conversation from sidebar
3. Loads messages for selected conversation
4. Displays messages in ChatArea
5. Sends new messages through MessageInput

### Error Handling
- Displays error messages with dismissible alerts
- Graceful loading states
- Fallback UI when user not authenticated

### Mobile Optimizations
- Toggle between sidebar and chat area on small screens
- Back button to return to conversation list
- Responsive button text and spacing

## Usage Example
```tsx
// Component is used in App.tsx routing
<Route path="/app/chat" element={<Chat />} />
```

## Key Methods

### handleConversationSelect
- Updates active conversation
- Closes mobile sidebar
- Triggers message loading

### handleSendMessage
- Sends message to active conversation
- Updates UI immediately

### handleCreateGroup
- Creates new group with selected members
- Auto-selects new group after creation

### handleDeleteGroup
- Removes group from database
- Resets UI to conversation list

### handleBackToList
- Mobile navigation back to sidebar
- Clears active conversation
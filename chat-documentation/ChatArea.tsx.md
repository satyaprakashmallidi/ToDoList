# ChatArea.tsx - Message Display Component

## File Location
`src/components/chat/ChatArea.tsx`

## Purpose
Displays messages for the active conversation, handles message rendering, grouping, and provides group management features for admins.

## Key Functionalities

### Message Display Features
1. **Message Grouping**
   - Groups messages by date (Today, Yesterday, specific dates)
   - Shows date separators between message groups
   - Maintains chronological order

2. **Message Rendering**
   - Different styling for own vs. other users' messages
   - Shows sender avatars and names in group chats
   - Displays timestamps and edit indicators
   - Responsive message bubbles with proper text wrapping

3. **Auto-scroll Behavior**
   - Automatically scrolls to bottom on new messages
   - Smooth scrolling animation
   - Maintains scroll position during conversations

4. **Conversation Header**
   - Shows conversation name and avatar
   - Displays member count for groups
   - Shows online/offline status for direct messages
   - Mobile back button for navigation

### Group Management
- **Delete Group**: Admin-only feature with confirmation modal
- **Member Display**: Shows total member count
- **Admin Indicators**: Special permissions for group creators

### Mobile Optimizations
- Back button to return to conversation list
- Responsive text sizes and spacing
- Touch-friendly button sizes
- Adaptive message bubble widths

## Props Interface
```typescript
interface ChatAreaProps {
  conversation: ChatConversation | null;  // Active conversation
  messages: ChatMessage[];                // Array of messages
  currentUserId: string;                  // Current user's ID
  onLoadMessages: Function;               // Load messages callback
  onDeleteGroup?: Function;               // Delete group callback
  onBackToList?: Function;                // Mobile back navigation
}
```

## Key Methods

### formatTime
- Converts timestamp to readable time format (HH:MM)
- Locale-aware formatting

### formatDate
- Groups dates into "Today", "Yesterday", or specific date
- Used for message date separators

### handleDeleteGroup
- Shows confirmation modal
- Calls parent's delete handler
- Manages loading state during deletion

### Message Grouping Logic
- Reduces messages array into date-grouped object
- Maintains message order within each date group
- Creates visual separation between different dates

## UI Components

### Empty State
- Shows when no conversation selected
- Encourages user to select a conversation
- Clean, centered design with icon

### Message Bubbles
- **Own Messages**: Blue background, right-aligned
- **Others' Messages**: White background, left-aligned
- Avatar shown for first message in a sequence
- Sender name shown in group chats

### Delete Confirmation Modal
- Overlay with centered modal
- Clear warning message
- Cancel and confirm buttons
- Loading state during deletion

## Styling Classes
- Custom scrollbar for message area
- Responsive max-widths for message bubbles
- Smooth transitions for hover states
- Shadow effects for depth perception

## Performance Considerations
- Ref-based scrolling to avoid re-renders
- Efficient message grouping algorithm
- Conditional rendering for avatars
- Memoized time formatting functions

## Accessibility
- Proper button labels and hover states
- Clear visual hierarchy
- Sufficient color contrast
- Keyboard navigation support
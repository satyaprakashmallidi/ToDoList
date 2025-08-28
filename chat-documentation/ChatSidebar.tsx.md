# ChatSidebar.tsx - Conversation List Component

## File Location
`src/components/chat/ChatSidebar.tsx`

## Purpose
Displays a searchable, filterable list of all conversations (direct messages and groups) with visual indicators for status, unread counts, and user roles.

## Key Functionalities

### Search & Filter System
1. **Real-time Search**
   - Case-insensitive search by conversation name
   - Instant filtering as user types
   - Clean search input with icon

2. **Filter Tabs**
   - Three filter options: All, Direct, Groups
   - Visual tab selection with active state
   - Smooth transitions between filter states

### Conversation List Features
1. **Visual Indicators**
   - Online status dot for direct messages (green)
   - Admin crown emoji for group admins
   - Unread message count badges
   - Different avatar colors (blue for direct, green for groups)

2. **Conversation Info Display**
   - Conversation name with truncation
   - Last message preview or member count
   - Relative time since last message (now, 5m, 2h, 3d)
   - Active conversation highlighting

3. **Interactive Elements**
   - Click to select conversation
   - Hover effects for better UX
   - Loading spinner during data fetch
   - Empty state with helpful message

### Time Formatting
- Intelligent relative time display:
  - "now" for messages < 1 minute old
  - "Xm" for minutes (1-59)
  - "Xh" for hours (1-23)
  - "Xd" for days (24+)

## Props Interface
```typescript
interface ChatSidebarProps {
  conversations: ChatConversation[];      // List of all conversations
  activeConversationId: string | null;    // Currently selected conversation
  onConversationSelect: Function;         // Selection callback
  onCreateGroup: Function;                // Create group callback
  currentUserId: string;                  // Current user's ID
  loading: boolean;                       // Loading state
}
```

## Key Methods

### filteredConversations
- Filters conversations based on search query and active filter
- Combines both search and filter criteria
- Returns filtered array for rendering

### formatTime
- Converts timestamps to relative time strings
- Calculates time difference from now
- Returns user-friendly time format

## UI Components

### Header Section
- Title "Conversations"
- Clean, minimal design
- Consistent padding and spacing

### Search Bar
- Full-width input with icon
- Gray background for subtle contrast
- Focus states with blue ring
- Placeholder text for guidance

### Filter Tabs
- Three-button toggle group
- Active state with white background
- Inactive states with hover effects
- Smooth color transitions

### Conversation Items
- **Avatar Section**:
  - Circular avatar with initials or icon
  - Color-coded by type (blue/green)
  - Online indicator overlay
  - Admin crown overlay

- **Content Section**:
  - Name with truncation for long text
  - Last message or member count
  - Time stamp aligned to right
  - Unread count badge

### Empty State
- Centered message with icon
- Helpful instructions
- Encourages user action

## Styling Features
- Custom scrollbar for list area
- Responsive padding and sizing
- Active conversation border highlight
- Hover states for interactivity
- Smooth transitions throughout

## Performance Considerations
- Efficient filtering with single pass
- Memoized time formatting
- Conditional rendering for indicators
- Optimized re-renders with proper keys

## Responsive Design
- Adaptive spacing (sm: breakpoints)
- Touch-friendly button sizes
- Flexible layout for various screens
- Text truncation for long content

## Visual Hierarchy
1. Active conversation (blue background, border)
2. Unread messages (badge)
3. Admin status (crown)
4. Online status (green dot)
5. Regular conversations
6. Empty state
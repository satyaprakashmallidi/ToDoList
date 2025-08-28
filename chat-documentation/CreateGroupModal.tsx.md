# CreateGroupModal.tsx - Group Creation Modal Component

## File Location
`src/components/chat/CreateGroupModal.tsx`

## Purpose
Modal dialog for creating new group conversations, allowing users to name the group and select team members to include.

## Key Functionalities

### Modal Management
1. **Open/Close Control**
   - Controlled by `isOpen` prop
   - Close on backdrop click or X button
   - Reset form state on close
   - Prevent closing during creation

2. **Form State Management**
   - Group name input with validation
   - Member selection tracking
   - Creating/loading states
   - Form reset on successful submission

### Member Selection
1. **Member List Display**
   - Shows all available team members
   - Avatar with first letter of name
   - Online status indicator (green dot)
   - Email display for identification

2. **Selection Mechanism**
   - Toggle selection with Plus/Check icons
   - Visual feedback for selected members
   - Counter showing selected count
   - Multiple selection support

### Form Validation
- Requires non-empty group name
- Requires at least one selected member
- Disables submit button when invalid
- Max length limit for group name (255 chars)

## Props Interface
```typescript
interface CreateGroupModalProps {
  isOpen: boolean;                    // Modal visibility state
  onClose: () => void;                // Close callback
  onCreateGroup: Function;            // Group creation callback
  teamMembers: ChatUser[];            // Available team members
  loading?: boolean;                  // Loading state for members
}
```

## Component States
- **groupName**: Text input for group name
- **selectedMembers**: Array of selected member IDs
- **creating**: Boolean for submission state

## Key Methods

### handleClose
- Resets form fields
- Clears selected members
- Calls parent's onClose callback
- Prevents closing during creation

### handleMemberToggle
- Adds/removes member ID from selection
- Uses functional state update for safety
- Provides immediate visual feedback

### handleSubmit
- Validates form data
- Sets loading state
- Calls parent's create function
- Handles success and error cases
- Auto-closes on success

## UI Components

### Modal Structure
1. **Backdrop**
   - Semi-transparent black overlay
   - Centers modal content
   - Responsive padding

2. **Modal Container**
   - White background with rounded corners
   - Shadow for depth
   - Max height with scroll support
   - Responsive width

### Header Section
- Title "Create New Group"
- Close button with X icon
- Border separator
- Disabled state during creation

### Form Elements

#### Group Name Input
- Label and input field
- Placeholder text
- Focus ring styling
- Required field validation
- Character limit enforcement

#### Member Selection Area
- Scrollable list container
- Empty state with loading spinner
- No members available message
- Member items with:
  - Avatar with initial
  - Name and email
  - Online status
  - Selection button

### Action Buttons
- **Cancel Button**:
  - Secondary styling
  - Closes modal without saving
  - Disabled during creation

- **Create Button**:
  - Primary blue styling
  - Loading spinner when creating
  - Disabled when form invalid
  - Success transitions to close

## Visual States

### Loading States
1. **Member Loading**
   - Spinning loader animation
   - "Loading team members..." text
   - Centered in member area

2. **Creation Loading**
   - Button spinner animation
   - "Creating..." text
   - All inputs disabled
   - Close button disabled

### Empty States
- Icon representation
- Helpful message text
- Subtle gray coloring
- Centered layout

### Selected State
- Blue background for button
- White checkmark icon
- Visual distinction from unselected

## Styling Features
- Smooth color transitions
- Hover effects on interactive elements
- Focus rings for accessibility
- Disabled state opacity changes
- Responsive spacing and sizing

## Error Handling
- Console error logging
- Maintains modal open on error
- Preserves form state
- Allows retry attempts

## Accessibility
- Proper form structure
- Required field attributes
- Button disabled states
- Focus management
- Label associations

## Performance Considerations
- Conditional rendering when closed
- Efficient member list rendering
- Single state update for toggles
- Prevents unnecessary re-renders
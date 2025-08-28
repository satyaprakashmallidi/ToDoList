# MessageInput.tsx - Message Input Component

## File Location
`src/components/chat/MessageInput.tsx`

## Purpose
Text input component for composing and sending chat messages with auto-resizing textarea and keyboard shortcuts.

## Key Functionalities

### Message Composition
1. **Auto-resizing Textarea**
   - Dynamically adjusts height based on content
   - Minimum height of 44px
   - Maximum height of 120px
   - Smooth height transitions

2. **Keyboard Shortcuts**
   - Enter key sends message
   - Shift+Enter adds new line
   - Prevents default form submission

3. **Form Management**
   - Controlled input with state
   - Clears input after sending
   - Trims whitespace before sending
   - Validates non-empty messages

## Props Interface
```typescript
interface MessageInputProps {
  onSendMessage: (content: string) => void;  // Message send callback
  disabled?: boolean;                        // Disable input state
}
```

## Component State
- **message**: Current message text being composed

## Key Methods

### handleSubmit
- Prevents default form submission
- Validates message has content
- Trims whitespace
- Calls parent's send callback
- Clears input field

### handleKeyPress
- Detects Enter key without Shift
- Prevents default behavior
- Triggers message submission
- Allows Shift+Enter for new lines

### Auto-resize Handler
- Resets height to minimum
- Calculates content scroll height
- Sets height up to maximum
- Maintains smooth transitions

## UI Components

### Container Layout
- Fixed position at bottom
- White background
- Top border separator
- Responsive padding

### Textarea Features
- Gray background (focus: white)
- Rounded corners (pill-shaped)
- Focus ring animation
- Placeholder text
- Disabled state styling
- No resize handle
- Smooth background transitions

### Send Button
- Circular shape
- Color states:
  - Active: Blue with white icon
  - Inactive: Gray with gray icon
- Hover effects:
  - Scale animation (105%)
  - Darker blue color
  - Shadow enhancement
- Disabled when:
  - Message is empty
  - Component is disabled
- Responsive sizing

## Styling Features

### Visual States
1. **Default State**
   - Gray background for textarea
   - Gray send button
   - Standard borders

2. **Focus State**
   - White background for textarea
   - Blue focus ring
   - Smooth transition

3. **Active State**
   - Blue send button
   - Shadow on button
   - Hover scale effect

4. **Disabled State**
   - Reduced opacity
   - Cursor not-allowed
   - No hover effects

### Responsive Design
- Adaptive spacing (sm: breakpoints)
- Button size adjustments
- Icon size variations
- Padding modifications

## Interaction Flow
1. User clicks or tabs to textarea
2. Textarea gains focus (white background)
3. User types message (auto-resize)
4. Send button becomes active (blue)
5. User presses Enter or clicks Send
6. Message sent to parent
7. Input cleared and reset

## Accessibility Features
- Proper form structure
- Keyboard navigation support
- Visual focus indicators
- Disabled state management
- Clear placeholder text

## Performance Optimizations
- Single state variable
- Efficient height calculations
- Minimal re-renders
- CSS transitions for smoothness
- Conditional class application

## CSS Properties
- **Textarea Sizing**:
  - Min height: 44px
  - Max height: 120px
  - Line height: 1.5
- **Transitions**:
  - Duration: 200ms
  - All properties animated
- **Border Radius**:
  - Textarea: rounded-2xl (pill)
  - Button: rounded-full (circle)
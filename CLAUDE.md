# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint for code quality
- `npm run preview` - Preview production build

## Architecture Overview

This is a task management application built with React + TypeScript + Vite, using Supabase for backend services and Google AI (Gemini) for intelligent task breakdown.

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **AI Integration**: Google Generative AI (Gemini 1.5 Flash)
- **Styling**: Tailwind CSS + Lucide React icons
- **Routing**: React Router DOM v7

### Key Architecture Components

**Authentication Flow**:
- Supabase Auth with email/password
- `AuthContext` (`src/contexts/AuthContext.tsx`) manages user state globally
- Automatic profile creation/update in `profiles` table on sign-in
- Protected routes via `ProtectedRoute` component

**Database Architecture**:
- Row Level Security (RLS) enabled on all tables
- Users isolated by `auth.uid()` in policies
- Schema documented in `docs/db-schema.md`
- Tables: `profiles`, `tasks`, `subtasks`, `todo_lists`, `todo_list_items`, `task_sessions`

**AI Integration**:
- Gemini API for intelligent task breakdown (`src/lib/ai.ts`)
- Generates ordered subtasks with validation and error handling
- Configurable number of subtasks (2-6 steps)

**State Management**:
- React Context for authentication state
- Custom hook `useSupabase` for database operations
- Local state for UI components

### Environment Setup

Required environment variables:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key  
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### Code Patterns

**Components**: Functional components with TypeScript interfaces, following React 18 patterns
**Database Operations**: Always use RLS-enabled queries through Supabase client
**Error Handling**: Try-catch blocks with user-friendly error messages
**TypeScript**: Strict typing with database types in `src/types/database.ts`

### Application Structure

**Pages**:
- `/login`, `/signup` - Authentication (public routes)
- `/app` - Main application (protected, redirects to Dashboard)
- `/app/add-tasks` - AI-powered task creation
- `/app/tasks` - Task management
- `/app/calendar` - Calendar view

**Layout**: Header + Sidebar layout with responsive design, controlled by local state in `AppLayout`

### Database Schema Notes

All tables use RLS policies keyed by `auth.uid()` for user isolation. The `tasks` table supports:
- Status: 'open' | 'in_progress' | 'completed'  
- Priority: 'low' | 'medium' | 'high'
- Optional date ranges and due dates
- Cascading subtasks with ordering

Time tracking via `task_sessions` with computed duration fields.
- never auto run this project i only run it
import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { TimeStoreProvider } from './contexts/TimeStore'
import { TaskStoreProvider } from './contexts/TaskStore'
import { NotificationProvider } from './contexts/NotificationContext'
import { DraftProvider } from './contexts/DraftContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Sidebar } from './components/Sidebar'
import { Menu } from 'lucide-react'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { Dashboard } from './pages/Dashboard'
import { Tasks } from './pages/Tasks'
import { Calendar } from './pages/Calendar'
import { AddTasks } from './pages/AddTasks'
import { Teams } from './pages/Teams'
import { Chat } from './pages/Chat'
import { Profile } from './pages/Profile'
import { DebugSupabase } from './pages/DebugSupabase'

const AppLayout: React.FC = () => {
  // Default to true on tablet and desktop, false on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 640
    }
    return true
  })
  
  // State to control toggle button visibility with delay
  const [showToggleButton, setShowToggleButton] = useState(!sidebarOpen)

  // Toggle sidebar function
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  // Handle toggle button visibility with animation delay
  React.useEffect(() => {
    if (sidebarOpen) {
      // Hide button immediately when sidebar opens
      setShowToggleButton(false)
    } else {
      // Show button after sidebar close animation completes (300ms)
      const timer = setTimeout(() => {
        setShowToggleButton(true)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [sidebarOpen])

  // Handle window resize
  React.useEffect(() => {
    let resizeTimer: NodeJS.Timeout

    const handleResize = () => {
      // Debounce resize events to prevent flickering
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        // Only auto-close on mobile, let user control tablet+ state
        if (window.innerWidth < 640 && sidebarOpen) {
          setSidebarOpen(false)
        }
        // Auto-open on tablet+ if previously closed due to mobile
        else if (window.innerWidth >= 640 && !sidebarOpen) {
          setSidebarOpen(true)
        }
      }, 100)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
    }
  }, [sidebarOpen])

  return (
    <div className="h-screen bg-white flex overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={toggleSidebar} onToggle={toggleSidebar} />
      
      {/* Mobile toggle button when sidebar is closed - only for very small screens */}
      {showToggleButton && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-all duration-200 sm:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4 text-gray-600" />
        </button>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto">
          <div className={`animate-in fade-in duration-300 h-full py-4 sm:py-6 ${
            !sidebarOpen 
              ? 'pl-16 pr-3 sm:pl-8 sm:pr-6 lg:pr-8' // Extra left padding on xs for button, normal on sm+ for collapsed sidebar
              : 'px-3 sm:px-6 lg:px-8'
          }`}>
            <div className="h-full flex flex-col">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-purple-200 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-b-blue-400 rounded-full animate-spin mx-auto" style={{ animationDelay: '0.15s', animationDuration: '1.5s' }}></div>
          </div>
          <p className="text-white font-medium">Loading Magic Teams...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/app" replace />
  }

  return <React.Fragment>{children}</React.Fragment>
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <DraftProvider>
            <TimeStoreProvider>
              <TaskStoreProvider>
                <Router>
              <Routes>
                <Route path="/login" element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } />
                <Route path="/signup" element={
                  <PublicRoute>
                    <Signup />
                  </PublicRoute>
                } />
                
                <Route path="/app" element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<AddTasks />} />
                  <Route path="new-task" element={<AddTasks />} />
                  <Route path="tasks" element={<Tasks />} />
                  <Route path="teams" element={<Teams />} />
                  <Route path="chats" element={<Chat />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="calendar" element={<Calendar />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="debug" element={<DebugSupabase />} />
                </Route>
                
                <Route path="/" element={
                  <PublicRoute>
                    <Landing />
                  </PublicRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </TaskStoreProvider>
        </TimeStoreProvider>
      </DraftProvider>
      </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
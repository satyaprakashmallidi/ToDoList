import React from 'react'
import { NavLink, type NavLinkRenderProps } from 'react-router-dom'
import { Home, PlusSquare, CheckSquare, Calendar, Users, User, Sparkles, X, Menu, MessageCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onToggle: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onToggle }) => {
  const { user } = useAuth()
  
  const navigation = [
    { name: 'New Task', href: '/app', icon: PlusSquare, label: 'Add New Tasks' },
    { name: 'Dashboard', href: '/app/dashboard', icon: Home, label: 'Go to Dashboard' },
    { name: 'Teams', href: '/app/teams', icon: Users, label: 'View Teams' },
    { name: 'Tasks', href: '/app/tasks', icon: CheckSquare, label: 'View Tasks' },
    { name: 'Chats', href: '/app/chats', icon: MessageCircle, label: 'View Chats' },
    { name: 'Calendar', href: '/app/calendar', icon: Calendar, label: 'View Calendar' },
    { name: 'Profile', href: '/app/profile', icon: User, label: 'View Profile' },
  ]

  // Handle escape key to close sidebar on mobile
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* CSS Animation Keyframes */}
      <style>{`
        @keyframes fadeIn {
          from { 
            opacity: 0; 
            transform: translateX(-10px);
          }
          to { 
            opacity: 1; 
            transform: translateX(0);
          }
        }
      `}</style>
      
      {/* Mobile overlay - only on very small screens */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`
          bg-white border-r border-gray-200 transition-all duration-300 h-screen flex-shrink-0
          ${isOpen 
            ? 'w-64 min-w-64' 
            : 'w-0 sm:w-16 sm:min-w-16 overflow-hidden'
          }
          fixed sm:relative inset-y-0 left-0 z-50 sm:z-0
          ${isOpen ? 'shadow-lg sm:shadow-none' : ''}
          ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
        `}
        aria-label="Sidebar navigation"
        role="navigation"
      >
        {/* Full Sidebar Content */}
        {isOpen ? (
          <div className="flex flex-col h-full w-64" style={{ 
            overflow: 'hidden',
            opacity: 0,
            animation: 'fadeIn 250ms cubic-bezier(0.4, 0, 0.2, 1) 100ms forwards'
          }}>
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="px-5 py-6 border-b border-gray-200/50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-6 h-6 text-purple-500" />
                      <h2 className="text-xl font-semibold text-gray-900">Magic Teams</h2>
                    </div>
                 
                  </div>
                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all duration-200"
                    aria-label="Close sidebar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto px-2 py-4">
                <div className="text-xs font-bold text-gray-400 mb-3 px-3 tracking-wider">NAVIGATION</div>
                <div className="space-y-1">
                  {navigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) => {
                        // Fix New Task active state - only active on exact path match
                        const currentPath = window.location.pathname;
                        const isExactlyActive = item.href === '/app' ? 
                          (currentPath === '/app' || currentPath === '/app/new-task') :
                          isActive;
                        
                        return `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                          isExactlyActive
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`
                      }}
                      onClick={() => window.innerWidth < 1024 && onClose()}
                      aria-label={item.label}
                    >
                      <item.icon className="w-5 h-5 text-gray-500" />
                      <span className="font-medium leading-tight">{item.name}</span>
                    </NavLink>
                  ))}
                </div>
              </nav>
            </div>

            {/* Footer - Account information only */}
            <div className="border-t border-gray-200 p-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-600 text-sm font-semibold">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="text-sm text-gray-700 truncate min-w-0">
                  {user?.email || 'user@example.com'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Collapsed Sidebar - Icons Only */
          <div className="hidden sm:flex flex-col h-full w-16 min-w-16 overflow-hidden">
            {/* Collapsed Header */}
            <div className="px-3 py-5 border-b border-gray-200/50 flex-shrink-0 flex justify-center">
              <button
                onClick={onToggle}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all duration-200 flex items-center justify-center"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5 flex-shrink-0" />
              </button>
            </div>

            {/* Collapsed Navigation - Icons Only */}
            <nav className="flex-1 overflow-y-auto px-2 py-4">
              <div className="space-y-2">
                {navigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) => {
                      // Fix New Task active state - only active on exact path match
                      const currentPath = window.location.pathname;
                      const isExactlyActive = item.href === '/app' ? 
                        (currentPath === '/app' || currentPath === '/app/new-task') :
                        isActive;
                      
                      return `flex items-center justify-center p-3 rounded-lg transition-all duration-200 group relative min-h-12 ${
                        isExactlyActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                      }`
                    }}
                    title={item.name}
                    aria-label={item.label}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                  </NavLink>
                ))}
              </div>
            </nav>

            {/* Collapsed Footer - Account avatar only */}
            <div className="border-t border-gray-200 p-2 flex-shrink-0 flex justify-center">
              <div className="w-7 h-7 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-gray-600 text-sm font-semibold">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
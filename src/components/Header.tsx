import React from 'react'
import { Menu, PanelLeftClose } from 'lucide-react'
import { useLocation } from 'react-router-dom'

interface HeaderProps {
  onMenuClick?: () => void
  sidebarOpen?: boolean
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, sidebarOpen = true }) => {
  const location = useLocation()
  
  // Map routes to display names
  const getPageName = () => {
    const path = location.pathname
    switch (path) {
      case '/app':
      case '/app/new-task':
        return 'New Task'
      case '/app/dashboard':
        return 'Dashboard'
      case '/app/tasks':
        return 'Tasks'
      case '/app/teams':
        return 'Teams'
      case '/app/calendar':
        return 'Calendar'
      case '/app/profile':
        return 'Profile'
      default:
        return 'Magic Teams'
    }
  }

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-4 py-3 shadow-sm sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-all duration-200"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        )}
        <h1 className="text-lg font-semibold text-gray-900">
          {getPageName()}
        </h1>
      </div>
    </header>
  )
}
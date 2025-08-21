import React from 'react'
import { NavLink, type NavLinkRenderProps } from 'react-router-dom'
import { Home, CheckSquare, Calendar, X, PlusSquare } from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigation = [
    { name: 'Dashboard', href: '/app', icon: Home, label: 'Go to Dashboard' },
    { name: 'Add Tasks', href: '/app/add-tasks', icon: PlusSquare, label: 'Add New Tasks' },
    { name: 'Tasks', href: '/app/tasks', icon: CheckSquare, label: 'View Tasks' },
    { name: 'Calendar', href: '/app/calendar', icon: Calendar, label: 'View Calendar' },
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
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`
          fixed left-0 top-0 h-full bg-white/80 backdrop-blur-xl border-r border-gray-200/50 z-50 transition-all duration-300 shadow-2xl shadow-gray-900/10
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-0 lg:shadow-none
          w-72
        `}
        aria-label="Sidebar navigation"
        role="navigation"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200/50 lg:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <h2 className="text-lg font-bold text-blue-600">
              TaskFlow
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-6 space-y-3 flex-1">
          {navigation.map((item, index) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-[1.02] ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md'
                }`
              }
              onClick={() => window.innerWidth < 1024 && onClose()}
              aria-label={item.label}
              aria-current={undefined}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {({ isActive }: NavLinkRenderProps) => (
                <>
                  <item.icon 
                    className={`w-5 h-5 mr-4 transition-transform duration-200 ${
                      isActive ? 'scale-110' : 'group-hover:scale-110'
                    }`} 
                    aria-hidden="true" 
                  />
                  {item.name}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
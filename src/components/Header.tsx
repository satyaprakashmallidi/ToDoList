import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Menu } from 'lucide-react'

interface HeaderProps {
  onMenuClick?: () => void
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, signOut, loading } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      const { error } = await signOut()
      if (error) {
        console.error('Sign out error:', error)
        // Show error toast or notification here
      }
    } catch (error) {
      console.error('Unexpected error during sign out:', error)
      // Show error toast or notification here
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 shadow-lg shadow-gray-100/50 sticky top-0 z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-4">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-xl hover:bg-purple-50 text-gray-600 hover:text-purple-600 transition-all duration-200 transform hover:scale-105"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <h1 className="text-2xl font-bold text-blue-600">
              TaskFlow
            </h1>
          </div>
        </div>
        
        {!loading && user && (
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-3 px-4 py-2 bg-gray-50/80 rounded-2xl border border-gray-200/50">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700">{user.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="group flex items-center space-x-2 px-4 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-red-200/50 transform hover:scale-105 active:scale-95 shadow-lg shadow-red-100/50"
              aria-label="Sign out"
            >
              <LogOut className={`w-4 h-4 transition-transform duration-200 ${
                isSigningOut ? 'animate-spin' : 'group-hover:scale-110'
              }`} />
              <span className="font-medium">
                {isSigningOut ? 'Signing Out...' : 'Sign Out'}
              </span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
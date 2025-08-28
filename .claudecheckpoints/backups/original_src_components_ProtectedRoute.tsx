import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, session } = useAuth()

  // Show loading state only for initial auth check
  if (loading && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Redirect if no user or session
  if (!loading && (!user || !session)) {
    return <Navigate to="/login" replace />
  }

  // Only render children if we have both user and session
  if (user && session) {
    return <React.Fragment>{children}</React.Fragment>
  }

  // Fallback loading state for edge cases
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )
}
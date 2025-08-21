import React from 'react'
import { useAuth } from '../contexts/AuthContext'

export const Profile: React.FC = () => {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric', 
      year: 'numeric'
    })
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-2xl px-5 py-5">
        <h1 className="text-3xl font-normal mb-2">Profile Settings</h1>
        <p className="text-gray-600 mb-6">Manage your account information and preferences</p>

        {/* Personal Information */}
        <div className="border border-gray-200 rounded-lg p-5 mb-5 bg-white">
          <h2 className="text-xl font-normal mb-4">👤 Personal Information</h2>
          <p className="text-gray-600 mb-4">Update your personal details and contact information</p>
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder="Your first name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-gray-400"
            />
            <input 
              type="text" 
              placeholder="Your last name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-gray-400"
            />
          </div>
          <button 
            className="px-5 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors duration-200"
          >
            Update Profile
          </button>
        </div>

        {/* Account Information */}
        <div className="border border-gray-200 rounded-lg p-5 mb-5 bg-white">
          <h2 className="text-xl font-normal mb-4">✉️ Account Information</h2>
          <p className="text-gray-600 mb-4">View your account details and status</p>
          <div className="space-y-2">
            <div>
              <span className="font-semibold">Email Address:</span> {user?.email || 'user@example.com'}
            </div>
            <div>
              <span className="font-semibold">User ID:</span> {user?.id || 'N/A'}
            </div>
            <div>
              <span className="font-semibold">Member Since:</span> {user?.created_at ? formatDate(new Date(user.created_at)) : formatDate(new Date())}
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="border border-gray-200 rounded-lg p-5 bg-white">
          <h2 className="text-xl font-normal mb-4">⚠️ Account Actions</h2>
          <p className="text-gray-600 mb-4">Actions that affect your account</p>
          <button 
            onClick={handleSignOut}
            className="px-5 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
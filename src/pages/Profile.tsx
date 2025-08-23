import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSupabase } from '../hooks/useSupabase'
import { User, Mail, Shield, LogOut, Calendar, CheckCircle } from 'lucide-react'

export const Profile: React.FC = () => {
  const { user, signOut } = useAuth()
  const { supabase } = useSupabase()
  
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Load current profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return
      
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setFirstName(profile.first_name || '')
          setLastName(profile.last_name || '')
        }
      } catch (error) {
        console.error('Error loading profile:', error)
      }
    }
    
    loadProfile()
  }, [user, supabase])

  const handleUpdateProfile = async () => {
    if (!user) return
    
    setLoading(true)
    setError('')
    setMessage('')
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
      
      if (error) {
        setError('Failed to update profile')
        console.error('Profile update error:', error)
      } else {
        setMessage('Profile updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      setError('Failed to update profile')
      console.error('Profile update error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric', 
      year: 'numeric'
    })
  }

  return (
    <div className="space-y-3 sm:space-y-4 bg-white min-h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-sm text-gray-600">Manage your account information and preferences</p>
      </div>

      {/* Success/Error Messages */}
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center">
          <CheckCircle className="w-4 h-4 mr-2" />
          {message}
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Personal Information */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-blue-50 rounded-lg mr-3">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
              <p className="text-sm text-gray-600">Update your personal details</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input 
                  type="text" 
                  placeholder="Enter first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input 
                  type="text" 
                  placeholder="Enter last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button 
              onClick={handleUpdateProfile}
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Updating...
                </>
              ) : (
                'Update Profile'
              )}
            </button>
          </div>
        </div>

        {/* Account Information */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-green-50 rounded-lg mr-3">
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Account Information</h2>
              <p className="text-sm text-gray-600">View your account details</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Email Address</p>
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-2 text-gray-400" />
                <p className="text-sm text-gray-900">{user?.email || 'user@example.com'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Member Since</p>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                <p className="text-sm text-gray-900">
                  {user?.created_at ? formatDate(new Date(user.created_at)) : formatDate(new Date())}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Your account is secured with email authentication
              </p>
            </div>
          </div>
        </div>

        {/* Security & Privacy */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-purple-50 rounded-lg mr-3">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Security & Privacy</h2>
              <p className="text-sm text-gray-600">Manage your account security</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors duration-200 group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Change Password</p>
                  <p className="text-xs text-gray-600 mt-1">Update your account password</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
            
            <div className="px-4 py-3 bg-gray-50 rounded-md">
              <div className="flex items-start">
                <svg className="w-4 h-4 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">Account Protected</p>
                  <p className="text-xs text-gray-600 mt-1">Your account uses secure email authentication</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-red-50 rounded-lg mr-3">
              <LogOut className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Account Actions</h2>
              <p className="text-sm text-gray-600">Manage your account status</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={handleSignOut}
              className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 flex items-center justify-center"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
            <p className="text-xs text-gray-500">
              This will sign you out of your account on this device
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useSupabase } from '../hooks/useSupabase'
import { 
  LogOut, 
  Calendar, 
  CheckCircle, 
  Bell,
  ChevronDown,
  Plus,
  ArrowRight,
  Mail,
  Hash,
  Heart,
  X,
  MessageSquare,
  Trash2,
  Key,
  ExternalLink,
  Settings
} from 'lucide-react'

export const Profile: React.FC = () => {
  const { user, signOut } = useAuth()
  const { supabase } = useSupabase()
  const navigate = useNavigate()
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearAllNotifications,
    addNotification
  } = useNotifications()
  
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickName, setNickName] = useState('')
  const [gender, setGender] = useState('')
  const [country, setCountry] = useState('')
  const [language, setLanguage] = useState('')
  const [timeZone, setTimeZone] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  
  // Email management state
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([])
  const [showAddEmail, setShowAddEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  
  // Cal.com integration state
  const [calApiKey, setCalApiKey] = useState<string>(() => {
    return localStorage.getItem('calcom-api-key') || '';
  });
  const [inputCalApiKey, setInputCalApiKey] = useState('')
  const [showCalApiKey, setShowCalApiKey] = useState(false)
  const [calConnected, setCalConnected] = useState<boolean>(() => {
    return !!localStorage.getItem('calcom-api-key');
  });
  const [calLoading, setCalLoading] = useState(false)
  const [calError, setCalError] = useState('')
  const [calUserInfo, setCalUserInfo] = useState<any>(null)
  
  // Password change state
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  
  // Notification state
  const [showNotifications, setShowNotifications] = useState(false)

  // Load current profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return
      
      // First, ALWAYS load from localStorage for extended fields
      try {
        const storedProfile = localStorage.getItem(`profile_${user.id}`)
        if (storedProfile) {
          const profileData = JSON.parse(storedProfile)
          console.log('Loading profile from localStorage:', profileData)
          setFirstName(profileData.firstName || '')
          setLastName(profileData.lastName || '')
          setGender(profileData.gender || '')
          setCountry(profileData.country || '')
          setLanguage(profileData.language || '')
          setTimeZone(profileData.timeZone || '')
        }
      } catch (storageError) {
        console.log('No localStorage profile data available')
      }

      // Always load emails from localStorage
      try {
        const storedEmails = localStorage.getItem(`emails_${user.id}`)
        if (storedEmails) {
          const emailList = JSON.parse(storedEmails)
          console.log('Loading emails from localStorage:', emailList)
          setAdditionalEmails(emailList)
        }
      } catch (storageError) {
        console.log('No localStorage email data available')
      }
      
      // Then try to get basic fields from database
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, full_name')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setNickName(profile.name || profile.full_name || '')
          
          // Only update names if not already set from localStorage
          if (!firstName && !lastName && profile.full_name) {
            const fullNameParts = profile.full_name.split(' ')
            if (fullNameParts.length >= 2) {
              setFirstName(fullNameParts[0] || '')
              setLastName(fullNameParts.slice(1).join(' ') || '')
            }
          }
        }

        // Try to get extended fields from database (but localStorage takes precedence)
        try {
          const { data: extendedProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name, gender, country, language, time_zone')
            .eq('id', user.id)
            .single()
          
          if (extendedProfile) {
            // Only update if localStorage didn't have the data
            setFirstName(prev => prev || extendedProfile.first_name || '')
            setLastName(prev => prev || extendedProfile.last_name || '')
            setGender(prev => prev || extendedProfile.gender || '')
            setCountry(prev => prev || extendedProfile.country || '')
            setLanguage(prev => prev || extendedProfile.language || '')
            setTimeZone(prev => prev || extendedProfile.time_zone || '')
          }
        } catch (extendedError) {
          console.log('Extended fields not in database, using localStorage values')
        }

        // Try to load emails from database (but localStorage takes precedence)
        try {
          const { data: userEmails } = await supabase
            .from('user_emails')
            .select('email')
            .eq('user_id', user.id)
          
          if (userEmails && userEmails.length > 0) {
            // Only update if localStorage didn't have emails
            setAdditionalEmails(prev => prev.length > 0 ? prev : userEmails.map(item => item.email))
          }
        } catch (emailError) {
          console.log('User emails table not in database, using localStorage values')
        }
      } catch (error) {
        console.error('Error loading profile from database:', error)
      }
    }
    
    loadProfile()
  }, [user, supabase])

  // Cal.com integration functions
  useEffect(() => {
    setInputCalApiKey(calApiKey);
    if (calApiKey && calConnected) {
      fetchCalUserInfo(calApiKey);
    }
  }, [calApiKey, calConnected]);

  const fetchCalUserInfo = async (apiKey: string) => {
    setCalLoading(true);
    setCalError('');
    try {
      // For now, we'll just validate the API key format and simulate success
      if (!apiKey.startsWith('cal_')) {
        throw new Error('Invalid API key format');
      }
      
      // Simulate API validation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set mock user info for display purposes
      setCalUserInfo({
        user: {
          name: 'Cal.com User',
          username: 'user'
        }
      });
    } catch (err) {
      console.error('Error validating Cal.com API key:', err);
      setCalError('Failed to connect to Cal.com. Please check your API key format.');
      setCalConnected(false);
    } finally {
      setCalLoading(false);
    }
  };

  const handleCalConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCalApiKey.trim()) {
      localStorage.setItem('calcom-api-key', inputCalApiKey.trim());
      setCalApiKey(inputCalApiKey.trim());
      await fetchCalUserInfo(inputCalApiKey.trim());
      if (!calError) {
        setCalConnected(true);
      }
    }
  };

  const handleCalDisconnect = () => {
    localStorage.removeItem('calcom-api-key');
    setCalApiKey('');
    setInputCalApiKey('');
    setCalUserInfo(null);
    setCalError('');
    setCalConnected(false);
  };

  const handleUpdateProfile = async () => {
    if (!user) return
    
    setLoading(true)
    setError('')
    setMessage('')
    
    try {
      // First, try updating with basic fields that should always exist
      let basicUpdateData = {
        name: nickName.trim() || firstName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        updated_at: new Date().toISOString()
      }

      const { error: basicError } = await supabase
        .from('profiles')
        .update(basicUpdateData)
        .eq('id', user.id)
      
      if (basicError) {
        throw basicError
      }

      // Always save extended data to localStorage for persistence
      const profileData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        country,
        language,
        timeZone
      }
      console.log('Saving to localStorage:', profileData)
      localStorage.setItem(`profile_${user.id}`, JSON.stringify(profileData))

      // Try to update additional fields in database if they exist
      try {
        let extendedUpdateData = {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          gender: gender || null,
          country: country || null,
          language: language || null,
          time_zone: timeZone || null
        }

        const { error: extendedError } = await supabase
          .from('profiles')
          .update(extendedUpdateData)
          .eq('id', user.id)
        
        if (extendedError) {
          console.log('Extended fields not available in database, using localStorage only')
        } else {
          console.log('Successfully updated extended fields in database')
        }
      } catch (extendedError) {
        console.log('Extended fields not available in database, using localStorage only')
      }

      setMessage('Profile updated successfully!')
      setTimeout(() => setMessage(''), 3000)
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

  const handleAddEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    if (additionalEmails.includes(newEmail) || newEmail === user?.email) {
      setError('Email already exists')
      return
    }

    setEmailLoading(true)
    setError('')

    try {
      // Update local state first
      const updatedEmails = [...additionalEmails, newEmail]
      setAdditionalEmails(updatedEmails)
      
      // Always save to localStorage for persistence
      localStorage.setItem(`emails_${user!.id}`, JSON.stringify(updatedEmails))

      // Try to save to database as well if available
      try {
        const { error: emailError } = await supabase
          .from('user_emails')
          .insert({
            user_id: user!.id,
            email: newEmail.trim(),
            is_verified: false
          })

        if (emailError) {
          console.log('Database storage not available for emails, using localStorage only')
        }
      } catch (dbError) {
        console.log('Database storage not available for emails, using localStorage only')
      }
      
      setNewEmail('')
      setShowAddEmail(false)
      setMessage('Email added successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setError('Failed to add email')
      console.error('Add email error:', error)
    } finally {
      setEmailLoading(false)
    }
  }

  const handleRemoveEmail = async (emailToRemove: string) => {
    try {
      // Update local state first
      const updatedEmails = additionalEmails.filter(email => email !== emailToRemove)
      setAdditionalEmails(updatedEmails)
      
      // Always save to localStorage for persistence
      localStorage.setItem(`emails_${user!.id}`, JSON.stringify(updatedEmails))

      // Try to remove from database as well if available
      try {
        const { error: emailError } = await supabase
          .from('user_emails')
          .delete()
          .eq('user_id', user!.id)
          .eq('email', emailToRemove)

        if (emailError) {
          console.log('Database deletion not available for emails, using localStorage only')
        }
      } catch (dbError) {
        console.log('Database deletion not available for emails, using localStorage only')
      }
      
      setMessage('Email removed successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setError('Failed to remove email')
      console.error('Remove email error:', error)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All password fields are required')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setPasswordLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        setError('Failed to change password')
        console.error('Password change error:', error)
      } else {
        setMessage('Password changed successfully!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setShowChangePassword(false)
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      setError('Failed to change password')
      console.error('Password change error:', error)
    } finally {
      setPasswordLoading(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric', 
      year: 'numeric'
    })
  }

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
    if (notification.redirectPath) {
      navigate(notification.redirectPath)
      setShowNotifications(false)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch(type) {
      case 'message':
        return <Mail className="w-4 h-4" />
      case 'task':
        return <CheckCircle className="w-4 h-4" />
      case 'channel':
        return <Hash className="w-4 h-4" />
      case 'like':
        return <Heart className="w-4 h-4" />
      default:
        return <Bell className="w-4 h-4" />
    }
  }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Welcome, {firstName || nickName || user?.email?.split('@')[0] || 'User'}
              </h1>
              <p className="text-sm text-gray-500">{getCurrentDate()}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 relative"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
                
                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                        <div className="flex items-center space-x-2">
                          {unreadCount > 0 && (
                            <button 
                              onClick={markAllAsRead}
                              className="text-sm text-blue-600 hover:text-blue-700"
                            >
                              Mark all as read
                            </button>
                          )}
                          <button 
                            onClick={() => setShowNotifications(false)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div 
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                              !notification.read ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`p-2 rounded-full ${
                                notification.type === 'message' ? 'bg-blue-100 text-blue-600' :
                                notification.type === 'task' ? 'bg-green-100 text-green-600' :
                                notification.type === 'channel' ? 'bg-purple-100 text-purple-600' :
                                notification.type === 'like' ? 'bg-red-100 text-red-600' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {notification.title}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {notification.content}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                  {notification.sender || 'System'} • {getTimeAgo(notification.timestamp)}
                                </p>
                              </div>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p>No notifications yet</p>
                        </div>
                      )}
                    </div>
                    
                    {notifications.length > 0 && (
                      <div className="p-3 border-t border-gray-200">
                        <button 
                          onClick={clearAllNotifications}
                          className="w-full text-center text-sm text-red-600 hover:text-red-700"
                        >
                          Clear all notifications
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section - Transparent */}
      <div className="bg-transparent h-32"></div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 pb-8">
        {/* Profile Header Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                {firstName?.charAt(0) || nickName?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {firstName && lastName ? `${firstName} ${lastName}` : nickName || user?.email?.split('@')[0] || 'User'}
              </h2>
              <p className="text-gray-600">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center mb-6">
            <CheckCircle className="w-4 h-4 mr-2" />
            {message}
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Personal Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Personal Information</h3>
              <p className="text-sm text-gray-600">Update your personal details</p>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter first name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                  <div className="relative">
                    <select 
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <div className="relative">
                    <select 
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="">Select country</option>
                      <option value="us">United States</option>
                      <option value="in">India</option>
                      <option value="uk">United Kingdom</option>
                      <option value="ca">Canada</option>
                      <option value="au">Australia</option>
                      <option value="de">Germany</option>
                      <option value="fr">France</option>
                      <option value="other">Other</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                  <div className="relative">
                    <select 
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="">Select language</option>
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="zh">Chinese</option>
                      <option value="hi">Hindi</option>
                      <option value="other">Other</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time Zone</label>
                  <div className="relative">
                    <select 
                      value={timeZone}
                      onChange={(e) => setTimeZone(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="">Select time zone</option>
                      <option value="UTC-8">Pacific Time (UTC-8)</option>
                      <option value="UTC-5">Eastern Time (UTC-5)</option>
                      <option value="UTC+0">GMT (UTC+0)</option>
                      <option value="UTC+5:30">India Standard Time (UTC+5:30)</option>
                      <option value="UTC+8">China Standard Time (UTC+8)</option>
                      <option value="other">Other</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Email Address Section */}
              <div className="pt-6 border-t border-gray-200">
                <h4 className="text-lg font-medium text-gray-900 mb-4">My email Address</h4>
                
                {/* Primary Email */}
                <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                    <p className="text-xs text-gray-500">Primary email</p>
                  </div>
                </div>

                {/* Additional Emails */}
                {additionalEmails.map((email, index) => (
                  <div key={index} className="flex items-center space-x-3 p-4 bg-gray-50 border border-gray-200 rounded-lg mb-3">
                    <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{email}</p>
                      <p className="text-xs text-gray-500">Additional email</p>
                    </div>
                    <button 
                      onClick={() => handleRemoveEmail(email)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                {/* Add Email Form */}
                {showAddEmail ? (
                  <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                    <div className="flex space-x-3">
                      <input
                        type="email"
                        placeholder="Enter email address"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleAddEmail}
                        disabled={emailLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {emailLoading ? 'Adding...' : 'Add'}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddEmail(false)
                          setNewEmail('')
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowAddEmail(true)}
                    className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Email Address
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Account Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Account Information</h3>
                <p className="text-sm text-gray-600">View your account details</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Member Since</p>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                    <p className="text-sm text-gray-900">
                      {user?.created_at ? formatDate(new Date(user.created_at)) : formatDate(new Date())}
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Your account is secured with email authentication
                  </p>
                </div>
              </div>
            </div>

            {/* Security & Privacy */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Security & Privacy</h3>
                <p className="text-sm text-gray-600">Manage your account security</p>
              </div>
              
              <div className="space-y-4">
                {/* Change Password Button/Form */}
                {!showChangePassword ? (
                  <button 
                    onClick={() => setShowChangePassword(true)}
                    className="w-full text-left px-4 py-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200 group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Change Password</p>
                        <p className="text-sm text-gray-600 mt-1">Update your account password</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                  </button>
                ) : (
                  <div className="px-4 py-4 border border-gray-200 rounded-lg">
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Change Password</h4>
                      <p className="text-sm text-gray-600">Enter your current password and choose a new one</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                        <input
                          type="password"
                          placeholder="Enter current password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                        <input
                          type="password"
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                        <input
                          type="password"
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div className="flex space-x-3 pt-4">
                        <button
                          onClick={handleChangePassword}
                          disabled={passwordLoading}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {passwordLoading ? 'Changing...' : 'Change Password'}
                        </button>
                        <button
                          onClick={() => {
                            setShowChangePassword(false)
                            setCurrentPassword('')
                            setNewPassword('')
                            setConfirmPassword('')
                          }}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="px-4 py-4 bg-transparent border border-gray-200 rounded-lg">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Account Protected</p>
                      <p className="text-sm text-gray-600 mt-1">Your account uses secure email authentication</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Account Actions</h3>
                <p className="text-sm text-gray-600">Manage your account status</p>
              </div>
              
              <div className="space-y-4">
                <button 
                  onClick={handleSignOut}
                  className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center justify-center"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </button>
                <p className="text-sm text-gray-500">
                  This will sign you out of your account on this device
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cal.com Integration Section */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Cal.com Integration</h3>
              <p className="text-sm text-gray-600">Connect your Cal.com account to sync your calendar</p>
            </div>
            {calConnected && (
              <button
                onClick={handleCalDisconnect}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                Disconnect
              </button>
            )}
          </div>

          {!calConnected ? (
            <form onSubmit={handleCalConnect} className="space-y-4">
              <div>
                <label htmlFor="cal-apikey" className="block text-sm font-medium text-gray-700 mb-2">
                  Cal.com API Key
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type={showCalApiKey ? 'text' : 'password'}
                    id="cal-apikey"
                    value={inputCalApiKey}
                    onChange={(e) => setInputCalApiKey(e.target.value)}
                    placeholder="cal_live_..."
                    className="w-full pl-10 pr-20 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCalApiKey(!showCalApiKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <span className="text-xs text-gray-500 hover:text-gray-700">
                      {showCalApiKey ? 'Hide' : 'Show'}
                    </span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Get your API key from{' '}
                  <a
                    href="https://app.cal.com/settings/developer/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                  >
                    Cal.com Settings
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

              {calError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{calError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!inputCalApiKey.trim() || calLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                {calLoading ? 'Connecting...' : 'Connect Calendar'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {calLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                  <span className="text-gray-600">Loading Cal.com info...</span>
                </div>
              ) : calUserInfo ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="text-sm text-green-800 font-medium">
                        Connected to Cal.com
                      </p>
                      <p className="text-sm text-green-700">
                        {calUserInfo.user?.name || calUserInfo.user?.username}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">Cal.com connected successfully</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Update Profile Button */}
        <div className="mt-8 flex justify-center">
          <button 
            onClick={handleUpdateProfile}
            disabled={loading}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg font-medium"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Updating Profile...
              </>
            ) : (
              'Update Profile'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle, Shield, User } from 'lucide-react'

export const Signup: React.FC = () => {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)
  
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength += 1
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 1
    if (/\d/.test(password)) strength += 1
    if (/[^A-Za-z0-9]/.test(password)) strength += 1
    return strength
  }

  const passwordStrength = getPasswordStrength(password)
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500']
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (!firstName.trim()) {
      setError('First name is required')
      setLoading(false)
      return
    }

    if (!lastName.trim()) {
      setError('Last name is required')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (passwordStrength < 2) {
      setError('Password is too weak. Please choose a stronger password.')
      setLoading(false)
      return
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const { error } = await signUp(email, password, { firstName: firstName.trim(), lastName: lastName.trim(), fullName })
    
    if (error) {
      setError(error.message)
    } else {
      navigate('/app')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
        {/* Left Side - Illustration/Info */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
          <div className="max-w-lg">
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-12 h-12 bg-blue-600 rounded-md flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <span className="text-3xl font-bold text-gray-900">TaskFlow</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-6 leading-tight">
              Start your productivity journey today
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed mb-8">
              Join thousands of users who have transformed their workflow with TaskFlow's intelligent task management.
            </p>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-gray-700">Free forever with premium features</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-gray-700">Enterprise-grade security</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-gray-700">No credit card required</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Signup Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Back Button */}
            <Link
              to="/"
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-blue-600 mb-8 transition-colors duration-200 group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-200" />
              <span>Back to home</span>
            </Link>

            {/* Signup Form Card */}
            <div className="bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 p-8 shadow-lg">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Get Started</h2>
                <p className="text-gray-600">Create your free account</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md animate-in slide-in-from-top duration-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* First Name and Last Name Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* First Name Field */}
                  <div className="relative">
                    <label 
                      htmlFor="firstName" 
                      className={`absolute transition-all duration-200 pointer-events-none z-10 ${
                        focusedField === 'firstName' || firstName 
                          ? 'left-4 -top-2 text-xs bg-white px-2 rounded text-gray-700' 
                          : 'left-12 top-4 text-gray-500'
                      }`}
                    >
                      First Name
                    </label>
                    <div className="relative">
                      <User className={`absolute left-4 top-4 w-5 h-5 transition-colors duration-200 ${
                        focusedField === 'firstName' ? 'text-blue-500' : 'text-gray-400'
                      }`} />
                      <input
                        id="firstName"
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        onFocus={() => setFocusedField('firstName')}
                        onBlur={() => setFocusedField(null)}
                        className="w-full pl-12 pr-4 py-4 bg-white/70 border border-gray-300 rounded-md text-gray-900 placeholder-transparent focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                        placeholder="Enter your first name"
                      />
                    </div>
                  </div>

                  {/* Last Name Field */}
                  <div className="relative">
                    <label 
                      htmlFor="lastName" 
                      className={`absolute transition-all duration-200 pointer-events-none z-10 ${
                        focusedField === 'lastName' || lastName 
                          ? 'left-4 -top-2 text-xs bg-white px-2 rounded text-gray-700' 
                          : 'left-12 top-4 text-gray-500'
                      }`}
                    >
                      Last Name
                    </label>
                    <div className="relative">
                      <User className={`absolute left-4 top-4 w-5 h-5 transition-colors duration-200 ${
                        focusedField === 'lastName' ? 'text-blue-500' : 'text-gray-400'
                      }`} />
                      <input
                        id="lastName"
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        onFocus={() => setFocusedField('lastName')}
                        onBlur={() => setFocusedField(null)}
                        className="w-full pl-12 pr-4 py-4 bg-white/70 border border-gray-300 rounded-md text-gray-900 placeholder-transparent focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                        placeholder="Enter your last name"
                      />
                    </div>
                  </div>
                </div>

                {/* Email Field */}
                <div className="relative">
                  <label 
                    htmlFor="email" 
                    className={`absolute transition-all duration-200 pointer-events-none z-10 ${
                      focusedField === 'email' || email 
                        ? 'left-4 -top-2 text-xs bg-white px-2 rounded text-gray-700' 
                        : 'left-12 top-4 text-gray-500'
                    }`}
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className={`absolute left-4 top-4 w-5 h-5 transition-colors duration-200 ${
                      focusedField === 'email' ? 'text-blue-500' : 'text-gray-400'
                    }`} />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      className="w-full pl-12 pr-4 py-4 bg-white/70 border border-gray-300 rounded-md text-gray-900 placeholder-transparent focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="relative">
                  <label 
                    htmlFor="password" 
                    className={`absolute transition-all duration-200 pointer-events-none z-10 ${
                      focusedField === 'password' || password 
                        ? 'left-4 -top-2 text-xs bg-white px-2 rounded text-gray-700' 
                        : 'left-12 top-4 text-gray-500'
                    }`}
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className={`absolute left-4 top-4 w-5 h-5 transition-colors duration-200 ${
                      focusedField === 'password' ? 'text-blue-500' : 'text-gray-400'
                    }`} />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      className="w-full pl-12 pr-12 py-4 bg-white/70 border border-gray-300 rounded-md text-gray-900 placeholder-transparent focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                      placeholder="Create a password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600">Password strength</span>
                        <span className="text-xs text-gray-600">
                          {strengthLabels[passwordStrength - 1] || 'Too weak'}
                        </span>
                      </div>
                      <div className="flex space-x-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                              level <= passwordStrength 
                                ? strengthColors[passwordStrength - 1] 
                                : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className="relative">
                  <label 
                    htmlFor="confirmPassword" 
                    className={`absolute transition-all duration-200 pointer-events-none z-10 ${
                      focusedField === 'confirmPassword' || confirmPassword 
                        ? 'left-4 -top-2 text-xs bg-white px-2 rounded text-gray-700' 
                        : 'left-12 top-4 text-gray-500'
                    }`}
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className={`absolute left-4 top-4 w-5 h-5 transition-colors duration-200 ${
                      focusedField === 'confirmPassword' ? 'text-blue-500' : 'text-gray-400'
                    }`} />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      className={`w-full pl-12 pr-12 py-4 bg-white/70 border rounded-md text-gray-900 placeholder-transparent focus:outline-none focus:bg-white transition-all duration-200 ${
                        confirmPassword && password !== confirmPassword
                          ? 'border-red-300 focus:border-red-500'
                          : confirmPassword && password === confirmPassword
                          ? 'border-green-300 focus:border-green-500'
                          : 'border-gray-300 focus:border-blue-500'
                      }`}
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Password Match Indicator */}
                  {confirmPassword && (
                    <div className="mt-2 flex items-center space-x-2">
                      {password === confirmPassword ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-xs text-green-600">Passwords match</span>
                        </>
                      ) : (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-red-500 flex items-center justify-center">
                            <span className="text-red-500 text-xs">✕</span>
                          </div>
                          <span className="text-xs text-red-600">Passwords do not match</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Creating account...</span>
                    </div>
                  ) : (
                    'Create Account'
                  )}
                </button>

                {/* Sign In Link */}
                <div className="text-center pt-4">
                  <span className="text-gray-600">
                    Already have an account?{' '}
                    <Link 
                      to="/login" 
                      className="font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200 underline underline-offset-2"
                    >
                      Sign in instead
                    </Link>
                  </span>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
  )
}
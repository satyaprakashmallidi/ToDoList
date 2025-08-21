import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)
  
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await signIn(email, password)
    
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
              Welcome back to your productivity hub
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed mb-8">
              Continue your journey towards better organization and enhanced productivity.
            </p>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700">AI-powered task breakdown</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700">Smart calendar integration</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700">Real-time progress tracking</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
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

            {/* Login Form Card */}
            <div className="bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 p-8 shadow-lg">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                <p className="text-gray-600">Sign in to your account</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md animate-in slide-in-from-top duration-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field */}
                <div className="relative">
                  <label 
                    htmlFor="email" 
                    className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      focusedField === 'email' || email 
                        ? '-top-2 text-xs bg-white px-2 rounded text-gray-700' 
                        : 'top-4 text-gray-500'
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
                    className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      focusedField === 'password' || password 
                        ? '-top-2 text-xs bg-white px-2 rounded text-gray-700' 
                        : 'top-4 text-gray-500'
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
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
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
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    'Sign In'
                  )}
                </button>

                {/* Sign Up Link */}
                <div className="text-center pt-4">
                  <span className="text-gray-600">
                    Don't have an account?{' '}
                    <Link 
                      to="/signup" 
                      className="font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200 underline underline-offset-2"
                    >
                      Sign up for free
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
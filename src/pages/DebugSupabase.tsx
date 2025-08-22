import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export const DebugSupabase: React.FC = () => {
  const { user, connectionStatus } = useAuth()
  const [testResults, setTestResults] = useState<any[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const addResult = (test: string, status: 'success' | 'error', data?: any) => {
    setTestResults(prev => [...prev, { test, status, data, timestamp: new Date().toISOString() }])
  }

  const runTests = async () => {
    setIsRunning(true)
    setTestResults([])

    // Test 1: Basic Supabase client
    try {
      addResult('Supabase Client', 'success', 'Client initialized')
    } catch (error) {
      addResult('Supabase Client', 'error', error)
    }

    // Test 2: Environment variables
    try {
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (url && key) {
        addResult('Environment Variables', 'success', { url, keyLength: key.length })
      } else {
        addResult('Environment Variables', 'error', 'Missing env vars')
      }
    } catch (error) {
      addResult('Environment Variables', 'error', error)
    }

    // Test 3: Auth session
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        addResult('Auth Session', 'error', error)
      } else {
        addResult('Auth Session', 'success', { hasSession: !!data.session, user: data.session?.user?.email })
      }
    } catch (error) {
      addResult('Auth Session', 'error', error)
    }

    // Test 4: Database connection (basic query)
    try {
      const { data, error } = await supabase.from('profiles').select('count').limit(1)
      if (error) {
        addResult('Database Connection', 'error', error)
      } else {
        addResult('Database Connection', 'success', 'Can query database')
      }
    } catch (error) {
      addResult('Database Connection', 'error', error)
    }

    // Test 5: User-specific query (if logged in)
    if (user) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, title')
          .eq('user_id', user.id)
          .limit(5)
        
        if (error) {
          addResult('User Tasks Query', 'error', error)
        } else {
          addResult('User Tasks Query', 'success', { taskCount: data?.length || 0 })
        }
      } catch (error) {
        addResult('User Tasks Query', 'error', error)
      }

      // Test 6: Profile query
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (error) {
          addResult('Profile Query', 'error', error)
        } else {
          addResult('Profile Query', 'success', { profile: data })
        }
      } catch (error) {
        addResult('Profile Query', 'error', error)
      }
    }

    setIsRunning(false)
  }

  useEffect(() => {
    runTests()
  }, [user])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Supabase Debug Dashboard</h1>
        <div className="flex items-center gap-4 text-sm">
          <span>Auth Status: <span className={`font-medium ${connectionStatus === 'connected' ? 'text-green-600' : 'text-red-600'}`}>{connectionStatus}</span></span>
          <span>User: <span className="font-medium">{user?.email || 'Not logged in'}</span></span>
          <button 
            onClick={runTests} 
            disabled={isRunning}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
          >
            {isRunning ? 'Running...' : 'Run Tests'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {testResults.map((result, index) => (
          <div key={index} className={`p-4 rounded-lg border-l-4 ${
            result.status === 'success' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{result.test}</h3>
              <span className={`text-xs px-2 py-1 rounded ${
                result.status === 'success' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
              }`}>
                {result.status}
              </span>
            </div>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(result.data, null, 2)}
            </pre>
            <div className="text-xs text-gray-500 mt-2">
              {new Date(result.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>

      {testResults.length === 0 && !isRunning && (
        <div className="text-center py-8 text-gray-500">
          No test results yet. Click "Run Tests" to start.
        </div>
      )}
    </div>
  )
}
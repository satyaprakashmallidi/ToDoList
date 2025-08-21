import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Database } from '../types/database'

type Tables = Database['public']['Tables']

export function useSupabase() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleError = (error: any) => {
    console.error('Supabase error:', error)
    setError(error.message || 'An error occurred')
    setLoading(false)
  }

  const clearError = () => setError(null)

  // Generic query function with error handling
  const query = async <T>(queryFn: () => Promise<{ data: T | null; error: any }>) => {
    setLoading(true)
    clearError()
    
    try {
      const { data, error } = await queryFn()
      
      if (error) {
        handleError(error)
        return { data: null, error }
      }
      
      setLoading(false)
      return { data, error: null }
    } catch (err) {
      handleError(err)
      return { data: null, error: err }
    }
  }

  // Tasks operations
  const tasks = {
    getAll: () => query(() => 
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
    ),
    
    create: (task: Tables['tasks']['Insert']) => query(() =>
      supabase
        .from('tasks')
        .insert({ ...task, user_id: user?.id })
        .select()
        .single()
    ),
    
    update: (id: string, updates: Tables['tasks']['Update']) => query(() =>
      supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user?.id)
        .select()
        .single()
    ),
    
    delete: (id: string) => query(() =>
      supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id)
    )
  }

  // Profiles operations
  const profiles = {
    getCurrent: () => query(() =>
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single()
    ),
    
    update: (updates: Tables['profiles']['Update']) => query(() =>
      supabase
        .from('profiles')
        .update(updates)
        .eq('id', user?.id)
        .select()
        .single()
    )
  }

  return {
    loading,
    error,
    clearError,
    tasks,
    profiles,
    supabase // Direct access for custom queries
  }
}
import React, { useEffect, useState } from 'react'
import { CheckCircle, Clock, TrendingUp, ListTodo, Link, Users } from 'lucide-react'
import { useSupabase } from '../hooks/useSupabase'
import { useAuth } from '../contexts/AuthContext'
import { Task } from '../types/tasks'
import { supabase } from '../lib/supabase'

interface InviteLink {
  id: string
  code: string
  expires_at: string
  created_at: string
}

export const Dashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeInvite, setActiveInvite] = useState<InviteLink | null>(null)
  const { supabase: supabaseHook } = useSupabase()
  const { user } = useAuth()

  useEffect(() => {
    const fetchTaskStats = async () => {
      if (!user?.id) return

      try {
        setLoading(true)
        setError(null)

        const { data, error } = await supabaseHook
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_deleted', false)

        if (error) throw error
        setTasks(data || [])

        // Fetch active invite link
        const { data: inviteData, error: inviteError } = await supabase
          .from('team_invites')
          .select('*')
          .eq('created_by', user.id)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)

        if (inviteError) {
          console.error('Error fetching invite:', inviteError)
        } else if (inviteData && inviteData.length > 0) {
          setActiveInvite(inviteData[0])
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
        setError('Failed to load dashboard statistics')
      } finally {
        setLoading(false)
      }
    }

    fetchTaskStats()
  }, [user?.id, supabaseHook])

  const totalTasks = tasks.length
  const openTasks = tasks.filter(task => task.status === 'open').length
  const inProgressTasks = tasks.filter(task => task.status === 'in_progress').length
  const completedTasks = tasks.filter(task => task.status === 'completed').length

  const stats = [
    { name: 'Total Tasks', value: totalTasks.toString(), icon: ListTodo, color: 'text-blue-600' },
    { name: 'Open Tasks', value: openTasks.toString(), icon: Clock, color: 'text-yellow-600' },
    { name: 'In Progress', value: inProgressTasks.toString(), icon: TrendingUp, color: 'text-orange-600' },
    { name: 'Completed', value: completedTasks.toString(), icon: CheckCircle, color: 'text-green-600' }
  ]

  if (error) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening.</p>
        </div>
        <div className="bg-red-50 border border-red-200 p-3 rounded-md text-red-700">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's what's happening.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg bg-gray-50 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? '...' : stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Tasks</h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No tasks yet. Create your first task!</p>
        ) : (
          <div className="space-y-3">
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center justify-between py-2">
                <span className="text-gray-900">{task.title}</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  task.status === 'completed' ? 'bg-green-100 text-green-800' :
                  task.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
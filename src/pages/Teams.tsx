import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Link, 
  UserPlus, 
  Copy, 
  Check,
  Mail
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface InviteLink {
  id: string
  code: string
  expires_at: string
  created_at: string
}

interface TeamMember {
  id: string
  user_id: string
  team_invite_id: string
  joined_at: string
  email?: string
  name?: string
}

export const Teams: React.FC = () => {
  const { user } = useAuth()
  const [inviteLink, setInviteLink] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [currentInvite, setCurrentInvite] = useState<InviteLink | null>(null)
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Check for existing invite link on component mount
  useEffect(() => {
    if (user) {
      checkExistingInvite()
      loadTeamMembers()
    }
  }, [user])

  const checkExistingInvite = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('team_invites')
        .select('*')
        .eq('created_by', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error

      if (data && data.length > 0) {
        const invite = data[0]
        setCurrentInvite(invite)
        setInviteLink(`https://magicteams.app/join/${invite.code}`)
      }
    } catch (error) {
      console.error('Error checking existing invite:', error)
    }
  }

  const generateInviteCode = () => {
    // Generate 6-digit alphanumeric code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const generateInviteLink = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const code = generateInviteCode()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 15) // 15 days from now

      const { data, error } = await supabase
        .from('team_invites')
        .insert({
          code: code,
          created_by: user.id,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single()

      if (error) throw error

      const link = `https://magicteams.app/join/${code}`
      setInviteLink(link)
      setCurrentInvite(data)
      
      // Show success message
      console.log('Invite link generated successfully')
    } catch (error) {
      console.error('Error generating invite link:', error)
      alert('Failed to generate invite link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const loadTeamMembers = async () => {
    if (!user) return

    try {
      setLoadingMembers(true)

      // Get team members who joined through this user's invite codes
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          profiles(email, name)
        `)
        .eq('admin_id', user.id)

      if (error) throw error
      setTeamMembers(data || [])
    } catch (error) {
      console.error('Error loading team members:', error)
    } finally {
      setLoadingMembers(false)
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)
        .eq('admin_id', user?.id) // Ensure only admin can remove

      if (error) throw error

      // Refresh team members list
      await loadTeamMembers()
      alert('Team member removed successfully')
    } catch (error) {
      console.error('Error removing team member:', error)
      alert('Failed to remove team member')
    }
  }

  const joinTeam = async () => {
    if (joinCode.length !== 6) {
      alert('Please enter a 6-digit team code.')
      return
    }

    if (!user) {
      alert('You must be logged in to join a team.')
      return
    }

    try {
      // First, find the invite code
      const { data: inviteData, error: inviteError } = await supabase
        .from('team_invites')
        .select('*')
        .eq('code', joinCode)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (inviteError || !inviteData) {
        alert('Invalid or expired team code.')
        return
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('team_invite_id', inviteData.id)
        .single()

      if (existingMember) {
        alert('You are already a member of this team.')
        setJoinCode('')
        return
      }

      // Add user as team member
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          user_id: user.id,
          team_invite_id: inviteData.id,
          admin_id: inviteData.created_by
        })

      if (memberError) throw memberError

      alert('Successfully joined the team!')
      setJoinCode('')
    } catch (error) {
      console.error('Error joining team:', error)
      alert('Failed to join team. Please try again.')
    }
  }

  const isLinkDisabled = currentInvite && new Date(currentInvite.expires_at) > new Date()

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Teams</h1>
          <p className="text-gray-600">Manage team invitations and join existing teams.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create Invite Link */}
          <div className="p-6 border border-gray-200 bg-white rounded-lg">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-50 rounded-lg mr-3">
                <Link className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Create Invite Link
                </h2>
                <p className="text-sm text-gray-600">
                  Generate a link to invite team members
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={generateInviteLink} 
                disabled={isLinkDisabled || loading}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center ${
                  isLinkDisabled 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Mail className="w-4 h-4 mr-2" />
                {loading ? 'Generating...' : isLinkDisabled ? 'Link is active for 15 days' : 'Generate Invite Link'}
              </button>

              {inviteLink && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">
                    Invite Link
                  </label>
                  <div className="flex space-x-2">
                    <input
                      value={inviteLink}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                    <button
                      onClick={() => copyToClipboard(inviteLink)}
                      className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600">
                    Share this link with team members to invite them to join your team.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Join Team */}
          <div className="p-6 border border-gray-200 bg-white rounded-lg">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-green-50 rounded-lg mr-3">
                <UserPlus className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Join Team
                </h2>
                <p className="text-sm text-gray-600">
                  Enter a 6-digit code to join a team
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Team Code
                </label>
                <input
                  placeholder="Enter 6-digit code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={6}
                />
                <p className="text-xs text-gray-600 mt-1">
                  Ask your team admin for the 6-digit team code
                </p>
              </div>

              <button 
                onClick={joinTeam}
                disabled={joinCode.length !== 6}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center ${
                  joinCode.length === 6
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Users className="w-4 h-4 mr-2" />
                Join Team
              </button>
            </div>
          </div>
        </div>

        {/* Active Team Invite - Only visible to link generator */}
        {currentInvite && (
          <div className="mt-8 border border-green-200 bg-green-50 rounded-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Active Team Invite
                </h2>
                <div className="flex items-center text-sm text-green-600">
                  <Link className="w-4 h-4 mr-1" />
                  Active
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Invite Code
                  </label>
                  <div className="flex space-x-2">
                    <input
                      value={currentInvite.code}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-center text-lg tracking-widest"
                    />
                    <button
                      onClick={() => copyToClipboard(currentInvite.code)}
                      className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Invite Link
                  </label>
                  <div className="flex space-x-2">
                    <input
                      value={`https://magicteams.app/join/${currentInvite.code}`}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                    <button
                      onClick={() => copyToClipboard(`https://magicteams.app/join/${currentInvite.code}`)}
                      className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                
                <p className="text-xs text-gray-600">
                  Share this code or link with team members. Expires on {new Date(currentInvite.expires_at).toLocaleDateString()}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Current Teams */}
        <div className="mt-8 border border-gray-200 bg-white rounded-lg">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Your Team Members
              </h2>
              <div className="flex items-center text-sm text-gray-600">
                <Users className="w-4 h-4 mr-1" />
                {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No team members yet</p>
                <p className="text-sm text-gray-500">
                  Share your invite link or code to add team members
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Admin (you) */}
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                      <span className="text-white text-sm font-semibold">
                        {user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {user?.email} <span className="text-sm text-blue-600">(You - Admin)</span>
                      </p>
                      <p className="text-sm text-gray-600">Team administrator</p>
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                        <span className="text-gray-600 text-sm font-semibold">
                          {member.profiles?.email?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.profiles?.email || 'Unknown User'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Joined {new Date(member.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeMember(member.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
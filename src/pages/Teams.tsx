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
import { CustomAlert } from '../components/CustomAlert'

interface InviteCode {
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
  const [inviteCode, setInviteCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [currentInvite, setCurrentInvite] = useState<InviteCode | null>(null)
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [alert, setAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    showCancel?: boolean;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  })

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', showCancel: boolean = false, onConfirm?: () => void) => {
    setAlert({
      isOpen: true,
      title,
      message,
      type,
      showCancel,
      onConfirm
    })
  }

  const closeAlert = () => {
    setAlert(prev => ({ ...prev, isOpen: false }))
  }

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
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error

      if (data && data.length > 0) {
        const invite = data[0]
        console.log('Found existing invite:', invite)
        
        // Set the invite and code (no expiration logic)
        setCurrentInvite(invite)
        setInviteCode(invite.code)
        
        // Also save to localStorage
        localStorage.setItem(`team_invite_code_${user.id}`, invite.code)
      } else {
        // Check localStorage as fallback
        const storedCode = localStorage.getItem(`team_invite_code_${user.id}`)
        if (storedCode) {
          console.log('Found code in localStorage:', storedCode)
          setInviteCode(storedCode)
        }
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

  const generateTeamInviteCode = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in to generate a team code', 'error')
      return
    }

    // Check if code already exists (one-time generation)
    if (inviteCode) {
      console.log('Code already exists:', inviteCode)
      return
    }
    
    setLoading(true)
    try {
      const code = generateInviteCode()
      console.log('🎯 Generating team code:', code)

      const { data, error } = await supabase
        .from('team_invites')
        .insert({
          code: code,
          created_by: user.id,
          team_name: `${user.email?.split('@')[0] || 'User'}'s Team`,
          team_description: 'A collaborative workspace for team productivity',
          max_members: 50,
          current_members: 1,
          expires_at: null, // No expiration
          is_active: true,
          settings: {
            allow_public_join: true,
            require_approval: false,
            default_role: 'member'
          }
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Database save failed:', error)
        throw new Error(`Failed to save team code: ${error.message}`)
      }

      console.log('✅ Team code saved to database:', data)

      // Auto-add the admin as a team member
      const { data: adminMember, error: adminError } = await supabase
        .from('team_members')
        .insert({
          user_id: user.id,
          team_invite_id: data.id,
          role: 'admin',
          status: 'active',
          permissions: {
            can_invite: true,
            can_manage_tasks: true,
            can_view_analytics: true,
            can_edit_team: true,
            can_remove_members: true
          }
        })
        .select()
        .single()

      if (adminError) {
        console.warn('⚠️ Failed to add admin as team member:', adminError)
      } else {
        console.log('✅ Admin added as team member:', adminMember)
      }

      // Update state
      setInviteCode(code)
      setCurrentInvite(data)
      
      // Save to localStorage as backup
      localStorage.setItem(`team_invite_code_${user.id}`, code)
      
      // Load team members to show the admin
      await loadTeamMembers()
      
      // Show success message
      showAlert('Success', 'Team invite code generated successfully! Code never expires.', 'success')
      console.log('✅ Code generation completed:', code)
    } catch (error) {
      console.error('Error generating invite code:', error)
      showAlert('Error', 'Failed to generate invite code. Please try again.', 'error')
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
      console.log('🔍 Loading team members for user:', user.id)

      // Get team members from the same teams as the current user
      // First get current user's team invite IDs
      const { data: userTeams, error: userTeamError } = await supabase
        .from('team_members')
        .select('team_invite_id')
        .eq('user_id', user.id)

      if (userTeamError) {
        console.error('Error fetching user teams:', userTeamError)
        setTeamMembers([])
        return
      }

      const teamInviteIds = userTeams?.map(t => t.team_invite_id) || []
      
      if (teamInviteIds.length === 0) {
        console.log('No teams found for this user')
        setTeamMembers([])
        return
      }
      
      // Get all members from the same teams without foreign key joins
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .in('team_invite_id', teamInviteIds)

      if (membersError) {
        console.error('Error fetching team members:', membersError)
        setTeamMembers([])
        return
      }

      // Get profiles for all team members separately to avoid foreign key issues
      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url')
          .in('id', userIds)

        // Combine members with their profiles
        const profileMap = new Map((profiles || []).map(p => [p.id, p]))
        const membersWithProfiles = members.map(member => ({
          ...member,
          profiles: profileMap.get(member.user_id) || null
        }))

        console.log('✅ Loaded team members with profiles:', membersWithProfiles)
        setTeamMembers(membersWithProfiles)
      } else {
        console.log('No team members found')
        setTeamMembers([])
      }
    } catch (error) {
      console.error('Error loading team members:', error)
      setTeamMembers([])
    } finally {
      setLoadingMembers(false)
    }
  }

  const removeMember = async (memberId: string, memberUserId: string) => {
    // Prevent admin from removing themselves
    if (memberUserId === user?.id) {
      showAlert('Not Allowed', 'You cannot remove yourself from the team.', 'warning')
      return
    }

    // Show confirmation dialog
    showAlert(
      'Confirm Removal',
      'Are you sure you want to remove this team member?',
      'warning',
      true,
      async () => {
        await performRemoveMember(memberId, memberUserId)
      }
    )
  }

  const performRemoveMember = async (memberId: string, memberUserId: string) => {

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      // Refresh team members list
      await loadTeamMembers()
      showAlert('Success', 'Team member removed successfully', 'success')
    } catch (error) {
      console.error('Error removing team member:', error)
      showAlert('Error', 'Failed to remove team member', 'error')
    }
  }

  const joinTeam = async () => {
    if (joinCode.length !== 6) {
      showAlert('Invalid Code', 'Please enter a 6-digit team code.', 'warning')
      return
    }

    if (!user) {
      showAlert('Authentication Required', 'You must be logged in to join a team.', 'warning')
      return
    }

    try {
      console.log('Attempting to join team with code:', joinCode)
      
      // First, find the invite code
      const { data: inviteData, error: inviteError } = await supabase
        .from('team_invites')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .eq('is_active', true)
        .single()

      if (inviteError) {
        console.error('Invite lookup error:', inviteError)
        if (inviteError.code === 'PGRST116') {
          showAlert('Invalid Code', 'Invalid team code. Please check the code and try again.', 'error')
        } else {
          showAlert('Lookup Error', 'Error looking up team code. Please try again.', 'error')
        }
        return
      }

      if (!inviteData) {
        showAlert('Invalid Code', 'Invalid team code. Please check the code and try again.', 'error')
        return
      }

      console.log('Found invite:', inviteData)

      // Check if user is already a member of this team
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('team_invite_id', inviteData.id)
        .single()

      if (existingMember) {
        showAlert('Already a Member', 'You are already a member of this team.', 'info')
        setJoinCode('')
        return
      }

      // Check if user is trying to join their own team
      if (inviteData.created_by === user.id) {
        showAlert('Invalid Action', 'You cannot join your own team using an invite code.', 'warning')
        setJoinCode('')
        return
      }

      console.log('Adding user to team...', {
        user_id: user.id,
        team_invite_id: inviteData.id,
        team_name: inviteData.team_name
      })

      // Add user as team member
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .insert({
          user_id: user.id,
          team_invite_id: inviteData.id,
          role: 'member',
          status: 'active',
          permissions: {
            can_invite: false,
            can_manage_tasks: true,
            can_view_analytics: true
          }
        })
        .select()
        .single()

      if (memberError) {
        console.error('❌ Member insert error:', memberError)
        throw new Error(`Failed to join team: ${memberError.message}`)
      }

      console.log('✅ Successfully joined team:', memberData)

      // Update team member count
      const { error: updateError } = await supabase
        .from('team_invites')
        .update({ 
          current_members: inviteData.current_members + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', inviteData.id)

      if (updateError) {
        console.warn('⚠️ Failed to update member count:', updateError)
      }

      // Refresh team members list to show the new member
      await loadTeamMembers()

      showAlert('Success!', `Successfully joined ${inviteData.team_name}!`, 'success')
      setJoinCode('')
      console.log('✅ Team join completed for:', inviteData.team_name)
    } catch (error) {
      console.error('Error joining team:', error)
      showAlert('Join Failed', `Failed to join team: ${error.message || 'Please try again.'}`, 'error')
    }
  }

  const hasExistingTeam = teamMembers.length > 0
  const isLinkDisabled = false // Always allow generating new codes

  return (
    <div className="space-y-3 sm:space-y-4 bg-white min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Teams</h1>
        <p className="text-sm text-gray-600">Manage team invitations and join existing teams</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Create Team Invite Code */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-50 rounded-lg mr-3">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Create Team Invite Code
                </h2>
                <p className="text-sm text-gray-600">
                  Generate a code to invite team members
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {!inviteCode ? (
                <button 
                  onClick={generateTeamInviteCode} 
                  disabled={loading}
                  className={`w-full px-4 py-3 rounded-md font-medium transition-colors duration-200 flex items-center justify-center ${
                    loading 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-orange-600 text-white hover:bg-orange-700'
                  }`}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {loading ? 'Generating...' : 'Create Team Invite Code'}
                </button>
              ) : null}

              {inviteCode && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">
                    Active Team Invite Code
                  </label>
                  <div className="flex space-x-2">
                    <input
                      value={inviteCode}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-center font-mono text-lg tracking-widest"
                    />
                    <button
                      onClick={() => copyToClipboard(inviteCode)}
                      className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">
                      Share this 6-digit code with team members to invite them to join your team.
                    </p>
                    <p className="text-xs text-green-600 font-medium">
                      ✅ Code generated successfully! This code never expires.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

        {/* Join Team */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 sm:p-6">
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
                className={`w-full px-4 py-2 sm:py-3 rounded-md font-medium transition-colors duration-200 flex items-center justify-center touch-manipulation ${
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


      {/* Current Teams */}
      <div className="bg-white rounded-md shadow-sm border border-gray-200">
        <div className="p-4 sm:p-6">
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
                {/* All Team Members (including admin) */}
                {teamMembers.map((member) => {
                  const isAdmin = member.user_id === user?.id;
                  return (
                    <div key={member.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-md gap-2 ${
                      isAdmin ? 'bg-blue-50 border border-blue-200' : 'border border-gray-200 hover:bg-gray-50'
                    }`}>
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                          isAdmin ? 'bg-blue-500' : 'bg-gray-300'
                        }`}>
                          <span className={`text-sm font-semibold ${
                            isAdmin ? 'text-white' : 'text-gray-600'
                          }`}>
                            {member.profiles?.email?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.profiles?.email || 'Unknown User'}
                            {isAdmin && <span className="text-sm text-blue-600 ml-2">(You - Admin)</span>}
                          </p>
                          <p className="text-sm text-gray-600">
                            {isAdmin ? 'Team administrator' : `Joined ${new Date(member.joined_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      {!isAdmin && (
                        <button
                          onClick={() => removeMember(member.id, member.user_id)}
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* Custom Alert */}
      <CustomAlert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        showCancel={alert.showCancel}
        onConfirm={alert.onConfirm}
      />
    </div>
  )
}
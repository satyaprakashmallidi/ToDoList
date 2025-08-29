import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  connectionStatus: 'connecting' | 'connected' | 'error' | 'offline'
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, userData?: { firstName: string; lastName: string; fullName: string }) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'offline'>('connecting');

  useEffect(() => {
    let mounted = true;
    let isInitialized = false;

    const handleSession = (newSession: Session | null) => {
      if (!mounted) return;

      if (newSession) {
        setSession(newSession);
        setUser(newSession.user);
        setConnectionStatus('connected');
        if (!isInitialized) {
          console.log('✅ User authenticated:', newSession.user.email);
        }
      } else {
        setSession(null);
        setUser(null);
        setConnectionStatus('offline');
        if (!isInitialized) {
          console.log('🔒 User logged out');
        }
      }
      setLoading(false);
      isInitialized = true;
    };

    const handleAuthChange = async (event: string, newSession: Session | null) => {
      if (!mounted) return;

      // Skip duplicate SIGNED_IN events after initial load
      if (event === 'SIGNED_IN' && isInitialized && session && newSession?.user?.id === session.user?.id) {
        console.log('⚠️ Skipping duplicate SIGNED_IN event for same user');
        return;
      }

      console.log('🔄 Auth state changed:', event, newSession ? 'authenticated' : 'logged out');
      handleSession(newSession);

      // Update profile only on initial sign in
      if (event === 'SIGNED_IN' && newSession?.user && !isInitialized) {
        try {
          const userMeta = newSession.user.user_metadata;
          await supabase
            .from('profiles')
            .upsert({
              id: newSession.user.id,
              email: newSession.user.email!,
              full_name: userMeta?.full_name || userMeta?.name || null,
              first_name: userMeta?.first_name || null,
              last_name: userMeta?.last_name || null,
              role: 'user' as const,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            });
        } catch (error) {
          console.warn('Profile update failed (non-critical):', error);
        }
      }
    };

    // Get initial session
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          setConnectionStatus('error');
        } else {
          setConnectionStatus(session ? 'connected' : 'offline');
        }
        
        handleSession(session);
      } catch (error) {
        console.error('Critical auth error:', error);
        setConnectionStatus('error');
        handleSession(null);
      }
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error && process.env.NODE_ENV === 'development') {
      console.error('Sign in error:', error);
    }
    return { error };
  };

  const signUp = async (email: string, password: string, userData?: { firstName: string; lastName: string; fullName: string }) => {
    const signUpData: any = { email, password };
    
    // Add user metadata if provided
    if (userData) {
      signUpData.options = {
        data: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          full_name: userData.fullName
        }
      };
    }
    
    const { error } = await supabase.auth.signUp(signUpData);
    if (error && process.env.NODE_ENV === 'development') {
      console.error('Sign up error:', error);
    }
    return { error };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Sign out error:', error);
        }
      }
      return { error };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Sign out exception:', error);
      }
      return { error };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      connectionStatus,
      signIn,
      signUp,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}
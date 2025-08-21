import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Clear any existing sessions from localStorage
try {
  localStorage.removeItem('supabase.auth.token');
  localStorage.removeItem('supabase.auth.refreshToken');
} catch (error) {
  console.warn('Failed to clear local storage:', error);
}

// Add a warning message for Brave users seeing fingerprint.js errors
if (navigator.brave !== undefined || (window as any).brave) {
  console.info(
    '%cBrave Browser Detected: If you see fingerprint.js errors in the console, this is normal. ' +
    'It\'s Brave\'s privacy protection working as intended and won\'t affect the app\'s functionality.',
    'color: #888; font-style: italic;'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'app.auth.token',
    storage: localStorage,
    flowType: 'pkce'
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache'
    }
  }
})
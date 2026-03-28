import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchMyProfile } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    // Load initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] initial session', session?.user?.email ?? 'none')
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('[Auth] state change →', _event)
        setSession(session)
        if (session?.user) {
          loadProfile(session.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    try {
      const p = await fetchMyProfile(userId)
      console.log('[Auth] profile loaded:', p?.full_name, '/', p?.role)
      setProfile(p)
    } catch (e) {
      console.error('[Auth] loadProfile error:', e)
    }
  }

  async function signIn(email, password) {
    console.log('[Auth] signIn', email)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    console.log('[Auth] signOut')
    await supabase.auth.signOut()
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    isLoading: session === undefined,
    isManager: profile?.role === 'manager',
    isStaff: profile?.role === 'production',
    isAccountant: profile?.role === 'accountant',
    signIn,
    signOut,
    reloadProfile: () => session?.user && loadProfile(session.user.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      router.refresh()
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/landing')
  }

  const refreshSession = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setSession(session)
    setUser(session?.user ?? null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

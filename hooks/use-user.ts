'use client'

import { useAuth } from '@/contexts/auth-context'

/**
 * Convenience hook that returns user and loading state
 * Use this in components that need user information
 */
export function useUser() {
  const { user, loading } = useAuth()
  
  return {
    user,
    loading,
    isAuthenticated: !!user,
  }
}

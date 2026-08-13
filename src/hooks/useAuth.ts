import { useCallback, useEffect, useState } from 'react'
import {
  type AuthUser,
  getCurrentUser,
  onAuthChange,
  refreshAuth,
  signIn as signInService,
  signOut as signOutService,
  signUp as signUpService,
} from '@/services/auth'

export interface UseAuth {
  currentUser: AuthUser | null
  isLoading: boolean
  signUp: (name: string, email: string, password: string) => Promise<AuthUser>
  signIn: (email: string, password: string) => Promise<AuthUser>
  signOut: () => void
}

/**
 * Auth hook — the single source of truth for the authenticated user on the
 * frontend. Persists the session via PocketBase's auth store (localStorage
 * in the browser) and re-renders when the store changes.
 */
export function useAuth(): UseAuth {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getCurrentUser())
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Revalidate the stored token against the backend on mount. If it is stale
  // the user is treated as logged-out.
  useEffect(() => {
    let active = true
    void (async () => {
      const user = await refreshAuth()
      if (!active) return
      setCurrentUser(user)
      setIsLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  // Stay in sync with the PocketBase auth store (e.g. signOut from elsewhere).
  useEffect(() => {
    const unsubscribe = onAuthChange(() => {
      setCurrentUser(getCurrentUser())
    })
    return unsubscribe
  }, [])

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const user = await signUpService(name, email, password)
    return user
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const user = await signInService(email, password)
    setCurrentUser(user)
    return user
  }, [])

  const signOut = useCallback(() => {
    signOutService()
    setCurrentUser(null)
  }, [])

  return {
    currentUser,
    isLoading,
    signUp,
    signIn,
    signOut,
  }
}

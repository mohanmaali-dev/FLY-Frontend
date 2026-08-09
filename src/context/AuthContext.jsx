/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'

import * as authService from '../services/auth.service.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Supabase restores the session from storage asynchronously, and also picks
    // up the tokens that email-confirmation / recovery links leave in the URL.
    // Subscribing covers both, plus token refreshes and sign-out in other tabs.
    const { data: subscription } = authService.onAuthStateChange(
      async (_event, session) => {
        if (!active) return

        if (!session?.user) {
          setUser(null)
          setLoading(false)
          return
        }

        setUser(await authService.getCurrentUser())
        setLoading(false)
      },
    )

    // onAuthStateChange fires immediately with the current session, but not
    // when there is none in some versions — so settle `loading` either way.
    authService.getSession().then((session) => {
      if (!active) return
      if (!session) {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      active = false
      subscription?.subscription?.unsubscribe()
    }
  }, [])

  const login = async (credentials) => {
    const result = await authService.login(credentials)
    setUser(result.user)
    return result
  }

  const register = async (details) => {
    const result = await authService.register(details)
    setUser(result.user)
    return result
  }

  const logout = async () => {
    await authService.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateUser: setUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

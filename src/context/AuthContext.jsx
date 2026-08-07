/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'

import * as authService from '../services/auth.service.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const result = await authService.getCurrentUser()
        setUser(result.data)
      } catch {
        try {
          await authService.refreshSession()
          const result = await authService.getCurrentUser()
          setUser(result.data)
        } catch {
          setUser(null)
        }
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [])

  const login = async (credentials) => {
    const result = await authService.login(credentials)
    setUser(result.data)
    return result
  }

  const register = async (details) => {
    const result = await authService.register(details)
    setUser(result.data)
    return result
  }

  const logout = async () => {
    await authService.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

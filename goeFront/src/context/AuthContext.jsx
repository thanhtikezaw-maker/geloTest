import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      setUser(JSON.parse(userData))
    }
    setLoading(false)
  }, [])

  const login = useCallback((userData, token) => {
    setUser(userData)
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
  }, [])

  const register = useCallback((userData, token) => {
    setUser(userData)
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('geolocation')
  }, [])

  useEffect(() => {
    if (!user || !navigator?.permissions?.query) {
      return undefined
    }

    if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') {
      return undefined
    }

    let permissionStatus

    const monitorGeolocation = async () => {
      try {
        permissionStatus = await navigator.permissions.query({ name: 'geolocation' })
        if (permissionStatus.state === 'denied') {
          logout()
          return
        }
        permissionStatus.onchange = () => {
          if (permissionStatus.state === 'denied') {
            logout()
          }
        }
      } catch (err) {
        // Ignore permission query errors
      }
    }

    monitorGeolocation()

    return () => {
      if (permissionStatus) {
        permissionStatus.onchange = null
      }
    }
  }, [logout, user])

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

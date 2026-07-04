import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import apiClient from '../api/client'
import { tokenStore } from './tokenStore'

// Datos del usuario autenticado, espejo de /api/auth/me/.
export interface Me {
  id: number
  email: string
  nombre_completo: string
  persona_id: number | null
  es_socio: boolean
  is_staff: boolean
  is_superuser: boolean
  puede_gestionar_compromisos: boolean
  puede_gestionar_reuniones: boolean
  grupos: string[]
}

interface AuthContextType {
  user: Me | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadMe(): Promise<void> {
    const res = await apiClient.get<Me>('/api/auth/me/')
    setUser(res.data)
  }

  // Al iniciar la app: si hay refresh token guardado, intentamos recuperar la
  // sesión. La petición a /me/ saldrá sin access (se perdió al recargar), el
  // interceptor lo renovará con el refresh y reintentará.
  useEffect(() => {
    async function bootstrap(): Promise<void> {
      if (!tokenStore.getRefresh()) {
        setLoading(false)
        return
      }
      try {
        await loadMe()
      } catch {
        tokenStore.clear()
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    void bootstrap()
  }, [])

  async function login(email: string, password: string): Promise<void> {
    const res = await apiClient.post('/api/token/', { email, password })
    tokenStore.setAccess(res.data.access)
    tokenStore.setRefresh(res.data.refresh)
    await loadMe()
  }

  function logout(): void {
    tokenStore.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return ctx
}

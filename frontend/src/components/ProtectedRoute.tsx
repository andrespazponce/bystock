import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// Envuelve rutas que requieren sesión. Mientras se resuelve el arranque
// muestra un cargando; si no hay usuario, redirige al login.
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <p style={{ fontFamily: 'sans-serif', margin: '2rem' }}>Cargando…</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

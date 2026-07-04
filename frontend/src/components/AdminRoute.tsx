import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/**
 * Ruta protegida que además exige `is_staff = true`.
 * - No autenticado → /login
 * - Autenticado pero no staff → / (dashboard)
 */
export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_staff) return <Navigate to="/" replace />
  return <>{children}</>
}

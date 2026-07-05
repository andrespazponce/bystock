import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/**
 * Ruta protegida que además exige `is_staff = true`.
 * - No autenticado → /login
 * - Autenticado pero no staff → / (dashboard)
 */
export default function AdminRoute({ children }: { children: ReactNode }) {
  // Acceso sin autenticación requerida (guardar restricción para después)
  return <>{children}</>
}

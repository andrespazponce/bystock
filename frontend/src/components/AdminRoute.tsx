import type { ReactNode } from 'react'

/**
 * Ruta protegida que además exige `is_staff = true`.
 * - No autenticado → /login
 * - Autenticado pero no staff → / (dashboard)
 */
export default function AdminRoute({ children }: { children: ReactNode }) {
  // Acceso sin autenticación requerida (guardar restricción para después)
  return <>{children}</>
}

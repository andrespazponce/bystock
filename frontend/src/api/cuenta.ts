import apiClient from './client'

/** Cambia la contraseña del usuario autenticado.
 * Exige la contraseña actual; la nueva se valida en el backend (longitud,
 * no demasiado común, no solo numérica, distinta a la actual). */
export async function cambiarPassword(passwordActual: string, passwordNueva: string) {
  const res = await apiClient.post<{ detail: string }>('/api/auth/cambiar-password/', {
    password_actual: passwordActual,
    password_nueva: passwordNueva,
  })
  return res.data
}

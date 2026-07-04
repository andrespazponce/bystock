import apiClient from './client'
import type { Paginated, PersonaLite } from './reuniones'

export interface Compromiso {
  id: number
  descripcion: string
  responsable: PersonaLite | null
  fecha_limite: string | null
  para_proxima_reunion: boolean
  estado: string
  estado_display: string
  vencido: boolean
  reunion_id: number
  reunion_etiqueta: string
  organo: string
  punto_titulo: string
}

export interface CompromisoFiltros {
  estado?: string
  responsable?: number
  para_proxima_reunion?: boolean
  vencido?: boolean
  abierto?: boolean
  search?: string
  page?: number
}

/** Lista paginada de compromisos, con filtros opcionales. */
export async function getCompromisos(filtros: CompromisoFiltros = {}) {
  const res = await apiClient.get<Paginated<Compromiso>>('/api/compromisos/', {
    params: filtros,
  })
  return res.data
}

/** Cambia SOLO el estado de un compromiso (PENDIENTE/CUMPLIDO/CANCELADO).
 * Requiere el permiso reuniones.change_compromiso en el backend. */
export async function updateCompromisoEstado(id: number, estado: string) {
  const res = await apiClient.patch<Compromiso>(`/api/compromisos/${id}/`, {
    estado,
  })
  return res.data
}

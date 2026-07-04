import apiClient from './client'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type TagCategoria = 'empresa' | 'tema' | 'estado' | 'intensidad' | 'persona'

export interface Tag {
  id: number
  slug: string
  categoria: TagCategoria
  nombre_display: string
  descripcion: string
  color: string
  activo: boolean
  puntos_count: number
}

export interface PuntoTagDisplay {
  id: number
  tag: Tag
  notas: string
  origen: 'IA' | 'MANUAL'
  creado_en: string
}

export interface TagHistoriaItem {
  id: number
  notas: string
  origen: string
  creado_en: string
  punto_id: number
  punto_titulo: string
  punto_orden: number
  reunion_id: number
  reunion_fecha: string
  reunion_numero: number
  reunion_gestion: number
  organo_nombre: string
}

export interface TagHistoriaResponse {
  tag: Tag
  total: number
  historia: TagHistoriaItem[]
}

// ── Colores por categoría (fallback si el servidor no devuelve color) ─────────

export const TAG_COLORS: Record<TagCategoria | string, string> = {
  empresa:    '#4a7fc1',
  tema:       '#c9a84c',
  estado:     '#4caf7c',
  intensidad: '#c94c4c',
  persona:    '#9c6abf',
}

export function tagColor(tag: Tag): string {
  return tag.color || TAG_COLORS[tag.categoria] || '#888'
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Lista todos los tags del catálogo (con búsqueda opcional). */
export async function getTags(search?: string): Promise<Tag[]> {
  const res = await apiClient.get<{ results: Tag[] } | Tag[]>('/api/tags/', {
    params: search ? { search } : {},
  })
  // El ViewSet puede devolver paginado o lista plana
  const data = res.data
  return Array.isArray(data) ? data : data.results
}

/** Detalle de un tag + línea de tiempo cronológica de todos sus puntos. */
export async function getTagHistoria(slug: string): Promise<TagHistoriaResponse> {
  const res = await apiClient.get<TagHistoriaResponse>(
    `/api/tags/${encodeURIComponent(slug)}/historia/`
  )
  return res.data
}

/** Agrega un tag a un punto (origen MANUAL). */
export async function addPuntoTag(
  puntoId: number,
  tagSlug: string,
  notas = '',
): Promise<PuntoTagDisplay> {
  const res = await apiClient.post<PuntoTagDisplay>(
    `/api/puntos/${puntoId}/tags/`,
    { tag_slug: tagSlug, notas },
  )
  return res.data
}

/** Quita un tag de un punto por su PuntoTag id. */
export async function removePuntoTag(puntoId: number, puntoTagId: number): Promise<void> {
  await apiClient.delete(`/api/puntos/${puntoId}/tags/${puntoTagId}/`)
}

/** Dispara la generación de tags por IA para todos los puntos de una reunión. */
export async function generarTagsReunion(reunionId: number): Promise<{ message: string; creados: number }> {
  const res = await apiClient.post<{ message: string; creados: number }>(
    `/api/reuniones/${reunionId}/generar-tags/`
  )
  return res.data
}

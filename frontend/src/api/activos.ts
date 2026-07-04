import apiClient from './client'

// ── Tipos ────────────────────────────────────────────────────────────────────

export type Categoria = 'INMUEBLE' | 'VEHICULO' | 'MAQUINARIA'
export type Estado = 'ACTIVO' | 'EN_MANTENIMIENTO' | 'VENDIDO' | 'BAJA'
export type EstadoInmueble =
  | 'SIN_PROYECTO'
  | 'POR_REGULARIZAR'
  | 'EN_PROYECTO'
  | 'PROYECTO_TERMINADO'

export type TipoActivo =
  | 'LOTE' | 'CASA' | 'DEPARTAMENTO' | 'LOCAL' | 'OFICINA' | 'TERRENO'
  | 'AUTO' | 'MOTO' | 'CAMION' | 'MINIBUS'
  | 'MAQUINARIA_PESADA' | 'EQUIPO'

export interface ActivoResumen {
  id: number
  nombre: string
  empresa: number
  empresa_nombre: string
  categoria: Categoria
  categoria_display: string
  tipo: TipoActivo
  tipo_display: string
  estado: Estado
  estado_display: string
  departamento: string
  ciudad: string
  direccion: string
  latitud: string | null
  longitud: string | null
  tiene_ubicacion: boolean
  valor: string | null
  fecha_adquisicion: string | null
}

export interface Activo extends ActivoResumen {
  // Comunes
  notas: string
  // Estado inmueble
  estado_inmueble: EstadoInmueble
  estado_inmueble_display: string
  // Inmueble
  area_m2: string | null
  nro_catastral: string
  nro_habitaciones: number | null
  // Vehículo / Maquinaria
  placa: string
  marca: string
  modelo_descripcion: string
  anio: number | null
  nro_serie: string
  color: string
  // Auditoría
  creado_en: string
  modificado_en: string
}

export interface ActivoPayload {
  nombre: string
  empresa: number
  tipo: TipoActivo
  estado: Estado
  valor?: string | null
  fecha_adquisicion?: string | null
  notas?: string
  departamento?: string
  ciudad?: string
  direccion?: string
  latitud?: string | null
  longitud?: string | null
  // Inmueble
  estado_inmueble?: EstadoInmueble
  area_m2?: string | null
  nro_catastral?: string
  nro_habitaciones?: number | null
  // Vehículo / Maquinaria
  placa?: string
  marca?: string
  modelo_descripcion?: string
  anio?: number | null
  nro_serie?: string
  color?: string
}

export interface ActivoDocumento {
  id: number
  activo: number
  titulo: string
  archivo: string
  nombre_archivo: string
  extension: string
  url_archivo: string
  creado_en: string
}

// ── Helpers de clasificación ─────────────────────────────────────────────────

export const TIPOS_POR_CATEGORIA: Record<Categoria, TipoActivo[]> = {
  INMUEBLE: ['LOTE', 'CASA', 'DEPARTAMENTO', 'LOCAL', 'OFICINA', 'TERRENO'],
  VEHICULO: ['AUTO', 'MOTO', 'CAMION', 'MINIBUS'],
  MAQUINARIA: ['MAQUINARIA_PESADA', 'EQUIPO'],
}

export const TIPO_A_CATEGORIA: Record<TipoActivo, Categoria> = {
  LOTE: 'INMUEBLE', CASA: 'INMUEBLE', DEPARTAMENTO: 'INMUEBLE',
  LOCAL: 'INMUEBLE', OFICINA: 'INMUEBLE', TERRENO: 'INMUEBLE',
  AUTO: 'VEHICULO', MOTO: 'VEHICULO', CAMION: 'VEHICULO', MINIBUS: 'VEHICULO',
  MAQUINARIA_PESADA: 'MAQUINARIA', EQUIPO: 'MAQUINARIA',
}

export const LABEL_TIPO: Record<TipoActivo, string> = {
  LOTE: 'Lote', CASA: 'Casa', DEPARTAMENTO: 'Departamento',
  LOCAL: 'Local comercial', OFICINA: 'Oficina', TERRENO: 'Terreno',
  AUTO: 'Automóvil', MOTO: 'Motocicleta', CAMION: 'Camión / Furgoneta', MINIBUS: 'Minibús',
  MAQUINARIA_PESADA: 'Maquinaria pesada', EQUIPO: 'Equipo / Herramienta',
}

export const LABEL_CATEGORIA: Record<Categoria, string> = {
  INMUEBLE: 'Inmueble',
  VEHICULO: 'Vehículo',
  MAQUINARIA: 'Maquinaria / Equipo',
}

export const LABEL_ESTADO: Record<Estado, string> = {
  ACTIVO: 'Activo',
  EN_MANTENIMIENTO: 'En mantenimiento',
  VENDIDO: 'Vendido',
  BAJA: 'Baja',
}

export const LABEL_ESTADO_INMUEBLE: Record<EstadoInmueble, string> = {
  SIN_PROYECTO: 'Sin proyecto',
  POR_REGULARIZAR: 'Por regularizar',
  EN_PROYECTO: 'En proyecto',
  PROYECTO_TERMINADO: 'Proyecto terminado',
}

export const DEPARTAMENTOS_BOLIVIA = [
  'La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro', 'Potosí',
  'Chuquisaca', 'Tarija', 'Beni', 'Pando',
]

// ── Llamadas a la API — Activos ──────────────────────────────────────────────

export async function getActivos(params?: Record<string, string>): Promise<ActivoResumen[]> {
  const res = await apiClient.get('/api/activos/', { params })
  return Array.isArray(res.data) ? res.data : (res.data.results ?? [])
}

export async function getActivosMapa(params?: Record<string, string>): Promise<ActivoResumen[]> {
  const res = await apiClient.get('/api/activos/mapa/', { params })
  return Array.isArray(res.data) ? res.data : (res.data.results ?? [])
}

export async function getActivo(id: number): Promise<Activo> {
  const res = await apiClient.get(`/api/activos/${id}/`)
  return res.data
}

export async function createActivo(payload: ActivoPayload): Promise<Activo> {
  const res = await apiClient.post('/api/activos/', payload)
  return res.data
}

export async function updateActivo(id: number, payload: Partial<ActivoPayload>): Promise<Activo> {
  const res = await apiClient.patch(`/api/activos/${id}/`, payload)
  return res.data
}

export async function deleteActivo(id: number): Promise<void> {
  await apiClient.delete(`/api/activos/${id}/`)
}

// ── Llamadas a la API — Documentos ───────────────────────────────────────────

export async function getActivoDocumentos(activoId: number): Promise<ActivoDocumento[]> {
  const res = await apiClient.get('/api/activos-documentos/', { params: { activo: activoId } })
  return Array.isArray(res.data) ? res.data : (res.data.results ?? [])
}

export async function uploadActivoDocumento(
  activoId: number,
  archivo: File,
  titulo?: string,
): Promise<ActivoDocumento> {
  const fd = new FormData()
  fd.append('activo', String(activoId))
  fd.append('archivo', archivo)
  if (titulo) fd.append('titulo', titulo)
  const res = await apiClient.post('/api/activos-documentos/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function deleteActivoDocumento(id: number): Promise<void> {
  await apiClient.delete(`/api/activos-documentos/${id}/`)
}

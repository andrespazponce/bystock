/**
 * API del módulo Ajustes (solo accesible a is_staff).
 * Gestión de Empresas, Órganos, Personas, Usuarios y Grupos.
 */
import apiClient from './client'
import type { PersonaLite } from './reuniones'

// ── Empresa ─────────────────────────────────────────────────────────────────

export interface EmpresaAdmin {
  id: number
  nombre: string
  codigo: string
  activa: boolean
}

export interface EmpresaPayload {
  nombre: string
  codigo: string
  activa: boolean
}

/** Lista todas las empresas (activas e inactivas). Solo is_staff. */
export async function getEmpresasAdmin(): Promise<EmpresaAdmin[]> {
  const res = await apiClient.get<EmpresaAdmin[]>('/api/empresas/')
  return res.data
}

export async function createEmpresa(payload: EmpresaPayload): Promise<EmpresaAdmin> {
  const res = await apiClient.post<EmpresaAdmin>('/api/empresas/', payload)
  return res.data
}

export async function updateEmpresa(id: number, payload: Partial<EmpresaPayload>): Promise<EmpresaAdmin> {
  const res = await apiClient.patch<EmpresaAdmin>(`/api/empresas/${id}/`, payload)
  return res.data
}

// ── Órgano ──────────────────────────────────────────────────────────────────

export interface OrganoAdmin {
  id: number
  empresa: { id: number; nombre: string; codigo: string }
  nombre: string
  tipo: string
  tipo_display: string
  descripcion: string
  activo: boolean
}

export interface OrganoPayload {
  empresa: number
  nombre: string
  tipo: string
  descripcion: string
  activo: boolean
}

/** Lista todos los órganos (activos e inactivos). Solo is_staff. */
export async function getOrganosAdmin(): Promise<OrganoAdmin[]> {
  const res = await apiClient.get<OrganoAdmin[]>('/api/organos/')
  return res.data
}

export async function createOrgano(payload: OrganoPayload): Promise<OrganoAdmin> {
  const res = await apiClient.post<OrganoAdmin>('/api/organos/', payload)
  return res.data
}

export async function updateOrgano(id: number, payload: Partial<OrganoPayload>): Promise<OrganoAdmin> {
  const res = await apiClient.patch<OrganoAdmin>(`/api/organos/${id}/`, payload)
  return res.data
}

// ── Miembro ──────────────────────────────────────────────────────────────────

export interface MiembroAdmin {
  id: number
  organo: number
  persona: PersonaLite
  rol: string
  rol_display: string
  fecha_inicio: string | null
  fecha_fin: string | null
  activo: boolean
}

export interface MiembroPayload {
  organo: number
  persona: number
  rol: string
  fecha_inicio: string | null
  fecha_fin: string | null
  activo: boolean
}

export async function getMiembros(organoId: number): Promise<MiembroAdmin[]> {
  const res = await apiClient.get<MiembroAdmin[]>('/api/miembros/', { params: { organo: organoId } })
  return res.data
}

export async function createMiembro(payload: MiembroPayload): Promise<MiembroAdmin> {
  const res = await apiClient.post<MiembroAdmin>('/api/miembros/', payload)
  return res.data
}

export async function updateMiembro(id: number, payload: Partial<MiembroPayload>): Promise<MiembroAdmin> {
  const res = await apiClient.patch<MiembroAdmin>(`/api/miembros/${id}/`, payload)
  return res.data
}

export async function deleteMiembro(id: number): Promise<void> {
  await apiClient.delete(`/api/miembros/${id}/`)
}

// ── Persona ──────────────────────────────────────────────────────────────────

export interface PersonaAdmin {
  id: number
  nombres: string
  apellidos: string
  nombre_completo: string
  documento_identidad: string | null
  telefono: string
  es_socio: boolean
  fecha_ingreso: string | null
}

export interface PersonaPayload {
  nombres: string
  apellidos: string
  documento_identidad: string | null
  telefono: string
  es_socio: boolean
  fecha_ingreso: string | null
}

/** Lista todas las personas con datos completos. Solo is_staff. */
export async function getPersonasAdmin(): Promise<PersonaAdmin[]> {
  const res = await apiClient.get<PersonaAdmin[]>('/api/personas/')
  return res.data
}

export async function createPersona(payload: PersonaPayload): Promise<PersonaAdmin> {
  const res = await apiClient.post<PersonaAdmin>('/api/personas/', payload)
  return res.data
}

export async function updatePersona(id: number, payload: Partial<PersonaPayload>): Promise<PersonaAdmin> {
  const res = await apiClient.patch<PersonaAdmin>(`/api/personas/${id}/`, payload)
  return res.data
}

// ── Grupo ────────────────────────────────────────────────────────────────────

export interface GrupoLite {
  id: number
  name: string
}

/** Lista los grupos de permisos disponibles. Solo is_staff. */
export async function getGrupos(): Promise<GrupoLite[]> {
  const res = await apiClient.get<GrupoLite[]>('/api/grupos/')
  return res.data
}

export interface GrupoDetalle {
  id: number
  name: string
  descripcion: string
  usuarios: UsuarioAdmin[]
}

/** Detalle de un grupo con la lista completa de sus usuarios miembros. */
export async function getGrupoDetalle(id: number): Promise<GrupoDetalle> {
  const res = await apiClient.get<GrupoDetalle>(`/api/grupos/${id}/`)
  return res.data
}

/** Agrega un usuario a un grupo. Devuelve el grupo actualizado. */
export async function agregarUsuarioAGrupo(grupoId: number, usuarioId: number): Promise<GrupoDetalle> {
  const res = await apiClient.post<GrupoDetalle>(`/api/grupos/${grupoId}/agregar-usuario/`, { usuario: usuarioId })
  return res.data
}

/** Quita un usuario de un grupo. Devuelve el grupo actualizado. */
export async function quitarUsuarioDeGrupo(grupoId: number, usuarioId: number): Promise<GrupoDetalle> {
  const res = await apiClient.post<GrupoDetalle>(`/api/grupos/${grupoId}/quitar-usuario/`, { usuario: usuarioId })
  return res.data
}

// ── Usuario ──────────────────────────────────────────────────────────────────

export interface UsuarioAdmin {
  id: number
  email: string
  nombre_completo: string
  persona: number | null
  persona_nombre: string | null
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  grupos: GrupoLite[]
  date_joined: string
}

export interface UsuarioCreatePayload {
  email: string
  password: string
  persona: number | null
  is_staff: boolean
  grupos: number[]
}

export interface UsuarioUpdatePayload {
  persona?: number | null
  is_active?: boolean
  is_staff?: boolean
  grupos?: number[]
  password?: string
}

/** Lista todos los usuarios (activos e inactivos). Solo is_staff. */
export async function getUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  const res = await apiClient.get<UsuarioAdmin[]>('/api/usuarios/')
  return res.data
}

export async function createUsuario(payload: UsuarioCreatePayload): Promise<UsuarioAdmin> {
  const res = await apiClient.post<UsuarioAdmin>('/api/usuarios/', payload)
  return res.data
}

export async function updateUsuario(id: number, payload: UsuarioUpdatePayload): Promise<UsuarioAdmin> {
  const res = await apiClient.patch<UsuarioAdmin>(`/api/usuarios/${id}/`, payload)
  return res.data
}

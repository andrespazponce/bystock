import apiClient from './client'
import type { EmpresaLite, Paginated } from './reuniones'

/** Reunión de origen de un documento (derivada del acta o del punto). */
export interface DocumentoOrigen {
  id: number
  etiqueta: string
  organo: string
}

/** Documento del repositorio central. Coincide con DocumentoListSerializer. */
export interface Documento {
  id: number
  titulo: string
  descripcion: string
  tipo: string
  tipo_display: string
  fecha: string | null
  empresa: EmpresaLite | null
  url_descarga: string
  reunion: DocumentoOrigen | null
}

export interface DocumentoFiltros {
  tipo?: string
  search?: string
  page?: number
  acta?: number
  punto?: number
}

/** Datos para SUBIR un documento (multipart). `archivo` es el File del input.
 * Se vincula opcionalmente a empresa/acta/punto (por id). */
export interface DocumentoUploadInput {
  titulo: string
  descripcion?: string
  tipo: string
  fecha?: string | null
  archivo: File
  empresa?: number | null
  acta?: number | null
  punto?: number | null
}

/** Opciones del filtro por tipo (los choices del modelo Documento). */
export const TIPOS_DOCUMENTO: { valor: string; label: string }[] = [
  { valor: 'ACTA_FIRMADA', label: 'Acta firmada' },
  { valor: 'INFORME', label: 'Informe' },
  { valor: 'CONTRATO', label: 'Contrato' },
  { valor: 'TESTIMONIO', label: 'Testimonio' },
  { valor: 'ESTADO_FINANCIERO', label: 'Estado financiero' },
  { valor: 'OTRO', label: 'Otro' },
]

/** Lista paginada del repositorio de documentos, con búsqueda y filtro por tipo. */
export async function getDocumentos(filtros: DocumentoFiltros = {}) {
  const res = await apiClient.get<Paginated<Documento>>('/api/documentos/', {
    params: filtros,
  })
  return res.data
}

/** Sube un documento (multipart/form-data). Solo se envían los campos presentes.
 * Forzamos el Content-Type a multipart para que axios NO serialice el FormData
 * como JSON (el apiClient usa application/json por defecto). */
export async function uploadDocumento(input: DocumentoUploadInput) {
  const fd = new FormData()
  fd.append('titulo', input.titulo)
  if (input.descripcion) fd.append('descripcion', input.descripcion)
  fd.append('tipo', input.tipo)
  if (input.fecha) fd.append('fecha', input.fecha)
  if (input.empresa != null) fd.append('empresa', String(input.empresa))
  if (input.acta != null) fd.append('acta', String(input.acta))
  if (input.punto != null) fd.append('punto', String(input.punto))
  fd.append('archivo', input.archivo)
  const res = await apiClient.post<Documento>('/api/documentos/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

/** Borra (soft delete) un documento del repositorio. */
export async function deleteDocumento(id: number) {
  await apiClient.delete(`/api/documentos/${id}/`)
}

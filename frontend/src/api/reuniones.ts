import apiClient from './client'
import type { PuntoTagDisplay } from './tags'

export interface EmpresaLite {
  id: number
  nombre: string
  codigo: string
}

export interface Organo {
  id: number
  nombre: string
  tipo: string
  tipo_display: string
  empresa: EmpresaLite
  activo: boolean
}

export interface Reunion {
  id: number
  numero: number
  gestion: number
  etiqueta: string
  fecha: string
  fecha_fin: string | null
  hora_inicio: string | null
  hora_fin: string | null
  lugar: string
  tipo: string
  tipo_display: string
  modalidad: string
  modalidad_display: string
  estado: string
  estado_display: string
  organo: Organo
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// --- Tipos del DETALLE de una reunión ---

export interface PersonaLite {
  id: number
  nombre_completo: string
  es_socio: boolean
}

export interface DocumentoLite {
  id: number
  titulo: string
  tipo: string
  tipo_display: string
  fecha: string | null
  url_descarga: string
}

export interface Resolucion {
  id: number
  texto: string
  resultado: string
  resultado_display: string
  por_unanimidad: boolean
}

export interface Compromiso {
  id: number
  descripcion: string
  responsable: PersonaLite | null
  fecha_limite: string | null
  para_proxima_reunion: boolean
  estado: string
  estado_display: string
}

export interface PuntoOrden {
  id: number
  orden: number
  titulo: string
  /** Texto completo / transcripción del punto tal como quedó en el acta. */
  desarrollo: string
  /**
   * Síntesis concisa generada por IA (3–5 oraciones).
   * Pendiente backend: el campo `resumen` debe exponerse en PuntoOrdenSerializer.
   */
  resumen?: string
  estado: string
  estado_display: string
  empresa: EmpresaLite | null
  resoluciones: Resolucion[]
  compromisos: Compromiso[]
  documentos: DocumentoLite[]
  /**
   * Tags semánticos asignados a este punto (generados por IA o manualmente).
   * Pendiente backend: PuntoOrdenSerializer debe incluir punto_tags con TagSerializer anidado.
   */
  punto_tags?: PuntoTagDisplay[]
}

export interface Asistencia {
  id: number
  persona: PersonaLite | null
  calidad: string
  calidad_display: string
  estado: string
  estado_display: string
}

export interface Acta {
  id: number
  contenido: string
  estado: string
  estado_display: string
  redactada_por: PersonaLite | null
  fecha_aprobacion: string | null
  firmada_por: PersonaLite[]
  documentos: DocumentoLite[]
}

export interface ReunionDetalle extends Reunion {
  observaciones: string
  asistencias: Asistencia[]
  puntos: PuntoOrden[]
  acta: Acta | null
}

export interface ReunionFiltros {
  organo?: number
  gestion?: number
  estado?: string
  search?: string
  page?: number
}

/** Lista paginada de reuniones, con filtros opcionales. */
export async function getReuniones(filtros: ReunionFiltros = {}) {
  const res = await apiClient.get<Paginated<Reunion>>('/api/reuniones/', {
    params: filtros,
  })
  return res.data
}

/** Detalle completo de una reunión (asistentes, orden del día, acta, documentos). */
export async function getReunion(id: number) {
  const res = await apiClient.get<ReunionDetalle>(`/api/reuniones/${id}/`)
  return res.data
}

/** Lista completa de órganos activos (sin paginar) para el selector de filtros. */
export async function getOrganos() {
  const res = await apiClient.get<Organo[]>('/api/organos/')
  return res.data
}

// --- ESCRITURA: crear / editar la cabecera de una reunión ---

/** Datos editables de la cabecera de una reunión (sin orden del día ni
 * asistencias, que se cargan aparte). Las fechas/horas van como string o null. */
export interface ReunionWritePayload {
  organo: number
  numero: number
  gestion: number
  fecha: string
  fecha_fin: string | null
  hora_inicio: string | null
  hora_fin: string | null
  lugar: string
  tipo: string
  modalidad: string
  estado: string
  observaciones: string
}

/** Crea una reunión. Requiere permiso reuniones.add_reunion en el backend. */
export async function createReunion(payload: ReunionWritePayload) {
  const res = await apiClient.post<Reunion>('/api/reuniones/', payload)
  return res.data
}

/** Edita la cabecera de una reunión (PATCH parcial).
 * Requiere permiso reuniones.change_reunion en el backend. */
export async function updateReunion(id: number, payload: Partial<ReunionWritePayload>) {
  const res = await apiClient.patch<Reunion>(`/api/reuniones/${id}/`, payload)
  return res.data
}

/** Lista completa de empresas activas (sin paginar) para selectores. */
export async function getEmpresas() {
  const res = await apiClient.get<EmpresaLite[]>('/api/empresas/')
  return res.data
}

// --- ESCRITURA: orden del día (puntos) ---

/** Punto del orden del día para la pantalla de GESTIÓN (incluye notas_crudas). */
export interface PuntoGestion {
  id: number
  reunion: number
  orden: number
  titulo: string
  desarrollo: string
  notas_crudas: string
  estado: string
  estado_display: string
  empresa: EmpresaLite | null
}

/** Datos editables de un punto. `orden` es opcional al crear (se autoasigna);
 * `empresa` es el id de la empresa o null. */
export interface PuntoWritePayload {
  reunion: number
  titulo: string
  desarrollo: string
  notas_crudas: string
  empresa: number | null
  estado: string
}

/** Trae los puntos de una reunión (paginando por si fueran muchos). */
export async function getPuntos(reunionId: number) {
  const acumulado: PuntoGestion[] = []
  let page = 1
  while (true) {
    const res = await apiClient.get<Paginated<PuntoGestion>>('/api/puntos/', {
      params: { reunion: reunionId, page },
    })
    acumulado.push(...res.data.results)
    if (!res.data.next) break
    page += 1
  }
  return acumulado
}

/** Crea un punto. Requiere reuniones.change_reunion. */
export async function createPunto(payload: PuntoWritePayload) {
  const res = await apiClient.post<PuntoGestion>('/api/puntos/', payload)
  return res.data
}

/** Edita un punto (PATCH parcial). */
export async function updatePunto(id: number, payload: Partial<PuntoWritePayload>) {
  const res = await apiClient.patch<PuntoGestion>(`/api/puntos/${id}/`, payload)
  return res.data
}

/** Quita (borrado lógico) un punto. */
export async function deletePunto(id: number) {
  await apiClient.delete(`/api/puntos/${id}/`)
}

/** Reordena TODOS los puntos de una reunión según la lista de ids dada.
 * Devuelve la lista ya con el nuevo `orden`. */
export async function reordenarPuntos(reunionId: number, ordenIds: number[]) {
  const res = await apiClient.post<PuntoGestion[]>('/api/puntos/reordenar/', {
    reunion: reunionId,
    orden: ordenIds,
  })
  return res.data
}

// --- ESCRITURA: asistencias ---

/** Asistencia para la pantalla de GESTIÓN (persona anidada + labels). */
export interface AsistenciaGestion {
  id: number
  reunion: number
  persona: PersonaLite
  calidad: string
  calidad_display: string
  estado: string
  estado_display: string
}

/** Datos editables de una asistencia. `persona` es el id de la persona. */
export interface AsistenciaWritePayload {
  reunion: number
  persona: number
  calidad: string
  estado: string
}

/** Lista completa de personas (sin paginar) para el selector de asistentes. */
export async function getPersonas() {
  const res = await apiClient.get<PersonaLite[]>('/api/personas/')
  return res.data
}

/** Trae las asistencias de una reunión (paginando por si fueran muchas). */
export async function getAsistencias(reunionId: number) {
  const acumulado: AsistenciaGestion[] = []
  let page = 1
  while (true) {
    const res = await apiClient.get<Paginated<AsistenciaGestion>>('/api/asistencias/', {
      params: { reunion: reunionId, page },
    })
    acumulado.push(...res.data.results)
    if (!res.data.next) break
    page += 1
  }
  return acumulado
}

/** Registra una asistencia. Requiere reuniones.change_reunion. */
export async function createAsistencia(payload: AsistenciaWritePayload) {
  const res = await apiClient.post<AsistenciaGestion>('/api/asistencias/', payload)
  return res.data
}

/** Edita una asistencia (PATCH parcial). */
export async function updateAsistencia(id: number, payload: Partial<AsistenciaWritePayload>) {
  const res = await apiClient.patch<AsistenciaGestion>(`/api/asistencias/${id}/`, payload)
  return res.data
}

/** Quita (borrado lógico) una asistencia. */
export async function deleteAsistencia(id: number) {
  await apiClient.delete(`/api/asistencias/${id}/`)
}

// --- ESCRITURA: resoluciones y compromisos de un punto ---

/** Trae un punto puntual (para la cabecera de la pantalla de gestión). */
export async function getPunto(id: number) {
  const res = await apiClient.get<PuntoGestion>(`/api/puntos/${id}/`)
  return res.data
}

/** Resolución para la pantalla de GESTIÓN (incluye el id del punto). */
export interface ResolucionGestion {
  id: number
  punto: number
  texto: string
  resultado: string
  resultado_display: string
  por_unanimidad: boolean
}

/** Datos editables de una resolución. */
export interface ResolucionWritePayload {
  punto: number
  texto: string
  resultado: string
  por_unanimidad: boolean
}

/** Trae las resoluciones de un punto (paginando por si fueran muchas). */
export async function getResoluciones(puntoId: number) {
  const acumulado: ResolucionGestion[] = []
  let page = 1
  while (true) {
    const res = await apiClient.get<Paginated<ResolucionGestion>>('/api/resoluciones/', {
      params: { punto: puntoId, page },
    })
    acumulado.push(...res.data.results)
    if (!res.data.next) break
    page += 1
  }
  return acumulado
}

/** Crea una resolución. Requiere reuniones.change_reunion. */
export async function createResolucion(payload: ResolucionWritePayload) {
  const res = await apiClient.post<ResolucionGestion>('/api/resoluciones/', payload)
  return res.data
}

/** Edita una resolución (PATCH parcial). */
export async function updateResolucion(id: number, payload: Partial<ResolucionWritePayload>) {
  const res = await apiClient.patch<ResolucionGestion>(`/api/resoluciones/${id}/`, payload)
  return res.data
}

/** Quita (borrado lógico) una resolución. */
export async function deleteResolucion(id: number) {
  await apiClient.delete(`/api/resoluciones/${id}/`)
}

/** Compromiso para la pantalla de GESTIÓN (persona anidada + id del punto). */
export interface CompromisoGestion {
  id: number
  punto: number
  resolucion: number | null
  descripcion: string
  responsable: PersonaLite | null
  fecha_limite: string | null
  para_proxima_reunion: boolean
  estado: string
  estado_display: string
}

/** Datos editables de un compromiso. `responsable` es el id de la persona;
 * `resolucion` es el id de una resolución del mismo punto o null. */
export interface CompromisoWritePayload {
  punto: number
  resolucion: number | null
  descripcion: string
  responsable: number
  fecha_limite: string | null
  para_proxima_reunion: boolean
  estado: string
}

/** Trae los compromisos de un punto (paginando por si fueran muchos). */
export async function getCompromisosDePunto(puntoId: number) {
  const acumulado: CompromisoGestion[] = []
  let page = 1
  while (true) {
    const res = await apiClient.get<Paginated<CompromisoGestion>>('/api/compromisos-gestion/', {
      params: { punto: puntoId, page },
    })
    acumulado.push(...res.data.results)
    if (!res.data.next) break
    page += 1
  }
  return acumulado
}

/** Crea un compromiso. Requiere reuniones.change_reunion. */
export async function createCompromiso(payload: CompromisoWritePayload) {
  const res = await apiClient.post<CompromisoGestion>('/api/compromisos-gestion/', payload)
  return res.data
}

/** Edita un compromiso (PATCH parcial). */
export async function updateCompromiso(id: number, payload: Partial<CompromisoWritePayload>) {
  const res = await apiClient.patch<CompromisoGestion>(`/api/compromisos-gestion/${id}/`, payload)
  return res.data
}

/** Quita (borrado lógico) un compromiso. */
export async function deleteCompromiso(id: number) {
  await apiClient.delete(`/api/compromisos-gestion/${id}/`)
}

// --- ESCRITURA: acta de la reunión ---

/** Datos editables del acta. `redactada_por` es el id de la persona (o null);
 * `firmada_por` es una lista de ids de persona. El acta NO se puede borrar
 * desde el portal (solo crear/editar). */
export interface ActaWritePayload {
  reunion: number
  contenido: string
  estado: string
  redactada_por: number | null
  fecha_aprobacion: string | null
  firmada_por: number[]
}

/** Trae el acta de una reunión, o null si todavía no tiene. */
export async function getActa(reunionId: number) {
  const res = await apiClient.get<Paginated<Acta>>('/api/actas/', {
    params: { reunion: reunionId },
  })
  return res.data.results[0] ?? null
}

/** Crea el acta. Requiere reuniones.change_reunion. */
export async function createActa(payload: ActaWritePayload) {
  const res = await apiClient.post<Acta>('/api/actas/', payload)
  return res.data
}

/** Edita el acta (PATCH parcial). */
export async function updateActa(id: number, payload: Partial<ActaWritePayload>) {
  const res = await apiClient.patch<Acta>(`/api/actas/${id}/`, payload)
  return res.data
}

/** Elimina el acta definitivamente (hard delete).
 *  Requiere reuniones.change_reunion. Después de llamar esto hay que
 *  navegar fuera, pues la reunión queda sin acta. */
export async function deleteActa(id: number) {
  await apiClient.delete(`/api/actas/${id}/`)
}

/** Elimina la reunión (soft delete). Desaparece de todas las listas y del dashboard. */
export async function deleteReunion(id: number) {
  await apiClient.delete(`/api/reuniones/${id}/`)
}

// ── IA: generar reunión desde convocatoria ───────────────────────────────────

/** Propuesta de reunión extraída por IA desde una convocatoria o agenda. */
export interface PropuestaConvocatoria {
  /** Id del órgano que mejor coincide, null si no se pudo determinar. */
  organo_id: number | null
  /** Nombre del órgano tal como aparece en el documento. */
  organo_nombre_detectado: string
  /** Número correlativo si se menciona en el documento. */
  numero: number | null
  /** Año de la gestión (ej. 2025). */
  gestion: number | null
  /** Fecha en formato "YYYY-MM-DD", null si no se pudo determinar. */
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  lugar: string
  tipo: string
  modalidad: string
  /** Puntos del orden del día detectados. */
  puntos: Array<{ orden: number; titulo: string }>
}

/**
 * Envía una convocatoria (PDF o imagen) al backend para que Claude extraiga
 * los datos de la reunión. Devuelve una propuesta que el usuario revisa antes
 * de confirmar la creación.
 *
 * Puede tardar 20–60 s según el tamaño del documento.
 */
export async function extraerConvocatoria(archivo: File): Promise<PropuestaConvocatoria> {
  const fd = new FormData()
  fd.append('archivo', archivo)
  const res = await apiClient.post<PropuestaConvocatoria>(
    '/api/reuniones/extraer-convocatoria/',
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return res.data
}

// ── IA: extracción de contenido desde PDF ────────────────────────────────────

/** Propuesta de desarrollo para un punto, generada por IA desde un PDF. */
export interface PropuestaPunto {
  punto_id: number
  orden: number
  titulo: string
  /** Texto narrativo sugerido para el campo `desarrollo` del punto. */
  desarrollo: string
  /** Resoluciones detectadas en el PDF para este punto. */
  resoluciones: Array<{
    texto: string
    /** "APROBADA" | "RECHAZADA" | "POSPUESTA" */
    resultado: string
    por_unanimidad: boolean
  }>
  /** Compromisos detectados. `responsable_nombre` es texto libre (no un id). */
  compromisos: Array<{
    descripcion: string
    responsable_nombre: string
    fecha_limite: string | null
    para_proxima_reunion: boolean
  }>
}

/**
 * Envía el PDF `documentoId` al backend para que Claude lo analice y devuelva
 * una propuesta de contenido por punto. La propuesta NO se guarda
 * automáticamente; el usuario la revisa y aplica desde la pantalla.
 *
 * Puede tardar 30–90 s según el tamaño del PDF.
 */
export async function extraerActa(actaId: number, documentoId: number): Promise<PropuestaPunto[]> {
  const res = await apiClient.post<{ puntos: PropuestaPunto[] }>(
    `/api/actas/${actaId}/extraer/`,
    { documento: documentoId },
  )
  return res.data.puntos
}

// ── IA: extracción completa de acta (flujo Acta-first) ──────────────────────

/** Punto extraído por IA desde un acta completa (con desarrollo + resumen + resoluciones + compromisos). */
export interface PropuestaPuntoCompleto {
  orden: number
  titulo: string
  /** Texto verbatim del acta para este punto, con solo corrección ortográfica. */
  desarrollo: string
  /** Síntesis concisa (3–5 oraciones) de los aspectos más relevantes del punto. */
  resumen: string
  resoluciones: Array<{
    texto: string
    resultado: string
    por_unanimidad: boolean
  }>
  /** `responsable` es null hasta que el usuario lo mapea a una Persona de la BD. */
  compromisos: Array<{
    descripcion: string
    responsable_nombre: string
    responsable: number | null
    fecha_limite: string | null
    para_proxima_reunion: boolean
  }>
  /** Documentos que la IA detectó que deberían adjuntarse al sistema. Solo informativo. */
  documentos_detectados: Array<{
    descripcion: string
    tipo_sugerido: string
  }>
}

/** Propuesta completa devuelta por extraerActaCompleta: metadatos + contenido. */
export interface PropuestaActaCompleta {
  organo_id: number | null
  organo_nombre_detectado: string
  numero: number | null
  gestion: number | null
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  lugar: string
  tipo: string
  modalidad: string
  puntos: PropuestaPuntoCompleto[]
}

/**
 * Envía el PDF (o imagen) de un acta firmada al backend.
 * Claude extrae metadatos de la reunión + contenido completo de cada punto.
 * Devuelve una propuesta para que el usuario la revise antes de confirmar.
 *
 * Puede tardar 30–120 s según el tamaño del PDF.
 */
export async function extraerActaCompleta(archivo: File): Promise<PropuestaActaCompleta> {
  const fd = new FormData()
  fd.append('archivo', archivo)
  const res = await apiClient.post<PropuestaActaCompleta>(
    '/api/reuniones/extraer-acta-completa/',
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return res.data
}

/**
 * Crea en una sola transacción: Reunion + Acta + PuntoOrden[] + Resolucion[] + Compromiso[].
 * `payload` es el JSON de la propuesta confirmada (con responsable como Persona ID).
 * Devuelve el ReunionDetalle completo de la reunión recién creada.
 */
export async function crearDesdeActa(payload: object): Promise<ReunionDetalle> {
  const res = await apiClient.post<ReunionDetalle>('/api/reuniones/crear-desde-acta/', payload)
  return res.data
}

/**
 * Descarga un documento por su URL segura.
 * Usa apiClient (que adjunta el JWT) para traer el archivo como blob y luego
 * dispara la descarga en el navegador. No se puede usar un <a href> directo
 * porque ese pedido no llevaría el token de autenticación.
 */
export async function descargarDocumento(urlDescarga: string, nombreSugerido: string) {
  const res = await apiClient.get(urlDescarga, { responseType: 'blob' })
  const blobUrl = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = nombreSugerido
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}

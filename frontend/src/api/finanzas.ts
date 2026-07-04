import apiClient from './client'

// ── Tipos ────────────────────────────────────────────────────────────────────

export type TipoReporte =
  | 'ESTADO_RESULTADOS' | 'BALANCE_GENERAL' | 'FLUJO_EFECTIVO' | 'ESTADO_PATRIMONIO'
  | 'MEMORIA_ANUAL' | 'PRESUPUESTO' | 'INFORME_VENTAS' | 'CUENTAS_COBRAR_PAGAR'
  | 'INFORME_AUDITORIA' | 'INFORME_SINDICO'
  | 'DECLARACION_IUE' | 'DECLARACION_IT' | 'DECLARACION_IVA' | 'CERTIFICADO_SOLVENCIA'
  | 'OTRO'

export type PeriodoTipo = 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'

export interface ReporteFinanciero {
  id: number
  empresa: number
  empresa_nombre: string
  tipo: TipoReporte
  tipo_display: string
  periodo_tipo: PeriodoTipo
  periodo_tipo_display: string
  periodo_label: string
  anio: number
  mes: number | null
  trimestre: number | null
  semestre: number | null
  titulo: string
  descripcion: string
  publicado: boolean
  sha256: string
  url_descarga: string
  subido_por: string
  total_consultas: number
  creado_en: string
}

export interface MensajeConsulta {
  id: number
  reporte: number
  usuario: number
  usuario_nombre: string
  mensaje: string
  respondido: boolean
  respuesta: string
  respondido_por: number | null
  respondido_por_nombre: string | null
  fecha_consulta: string
  fecha_respuesta: string | null
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const LABEL_TIPO: Record<TipoReporte, string> = {
  ESTADO_RESULTADOS:   'Estado de Resultados',
  BALANCE_GENERAL:     'Balance General',
  FLUJO_EFECTIVO:      'Flujo de Efectivo',
  ESTADO_PATRIMONIO:   'Estado de Cambios en el Patrimonio',
  MEMORIA_ANUAL:       'Memoria Anual / Informe de Gestión',
  PRESUPUESTO:         'Presupuesto vs. Ejecución',
  INFORME_VENTAS:      'Informe de Ventas',
  CUENTAS_COBRAR_PAGAR:'Cuentas por Cobrar y Pagar',
  INFORME_AUDITORIA:   'Informe del Auditor Externo',
  INFORME_SINDICO:     'Informe del Síndico',
  DECLARACION_IUE:     'Declaración IUE',
  DECLARACION_IT:      'Declaración IT',
  DECLARACION_IVA:     'Declaración IVA',
  CERTIFICADO_SOLVENCIA:'Certificado de Solvencia Fiscal',
  OTRO:                'Otro',
}

export const LABEL_PERIODO: Record<PeriodoTipo, string> = {
  MENSUAL:    'Mensual',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL:  'Semestral',
  ANUAL:      'Anual',
}

export const TIPOS_REPORTE: TipoReporte[] = [
  'ESTADO_RESULTADOS', 'BALANCE_GENERAL', 'FLUJO_EFECTIVO', 'ESTADO_PATRIMONIO',
  'MEMORIA_ANUAL', 'PRESUPUESTO', 'INFORME_VENTAS', 'CUENTAS_COBRAR_PAGAR',
  'INFORME_AUDITORIA', 'INFORME_SINDICO',
  'DECLARACION_IUE', 'DECLARACION_IT', 'DECLARACION_IVA', 'CERTIFICADO_SOLVENCIA',
  'OTRO',
]

export const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// ── Llamadas a la API ────────────────────────────────────────────────────────

export async function getReportes(params?: Record<string, string>): Promise<ReporteFinanciero[]> {
  const res = await apiClient.get('/api/reportes-financieros/', { params })
  return Array.isArray(res.data) ? res.data : (res.data.results ?? [])
}

export async function getReporte(id: number): Promise<ReporteFinanciero> {
  const res = await apiClient.get(`/api/reportes-financieros/${id}/`)
  return res.data
}

export async function subirReporte(formData: FormData): Promise<ReporteFinanciero> {
  const res = await apiClient.post('/api/reportes-financieros/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function editarReporte(id: number, formData: FormData): Promise<ReporteFinanciero> {
  const res = await apiClient.patch(`/api/reportes-financieros/${id}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function eliminarReporte(id: number): Promise<void> {
  await apiClient.delete(`/api/reportes-financieros/${id}/`)
}

export async function descargarReporte(urlDescarga: string): Promise<void> {
  const res = await apiClient.get(urlDescarga, { responseType: 'blob' })
  const contentDisposition = res.headers['content-disposition'] as string | undefined
  let nombreArchivo = 'reporte'
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/)
    if (match) nombreArchivo = match[1]
  }
  const url = URL.createObjectURL(new Blob([res.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}

// ── Consultas ────────────────────────────────────────────────────────────────

export async function getConsultas(reporteId: number): Promise<MensajeConsulta[]> {
  const res = await apiClient.get('/api/consultas-financieras/', {
    params: { reporte: reporteId },
  })
  return Array.isArray(res.data) ? res.data : (res.data.results ?? [])
}

export async function enviarConsulta(reporteId: number, mensaje: string): Promise<MensajeConsulta> {
  const res = await apiClient.post('/api/consultas-financieras/', {
    reporte: reporteId,
    mensaje,
  })
  return res.data
}

export async function responderConsulta(consultaId: number, respuesta: string): Promise<MensajeConsulta> {
  const res = await apiClient.patch(`/api/consultas-financieras/${consultaId}/responder/`, {
    respuesta,
  })
  return res.data
}

// ── Dashboard financiero ─────────────────────────────────────────────────────

export interface RatiosFinancieros {
  liquidez_corriente: number | null
  prueba_acida: number | null
  endeudamiento: number | null
  roa: number | null
  roe: number | null
}

export interface EmpresaBalance {
  empresa_id: number
  empresa_nombre: string
  empresa_codigo: string
  activo_total?: number
  activo_corriente?: number
  activo_no_corriente?: number
  disponible?: number
  exigible?: number
  realizable?: number
  bienes_uso?: number
  activo_intangible?: number
  activo_diferido?: number
  pasivo_total?: number
  pasivo_corriente?: number
  pasivo_no_corriente?: number
  patrimonio?: number
  capital_social?: number
  resultado_gestion?: number
  ratios: RatiosFinancieros
}

export interface DashboardData {
  periodo: { anio: number; mes: number }
  empresas: EmpresaBalance[]
  consolidado: EmpresaBalance & { ratios: RatiosFinancieros }
  periodos_disponibles: { anio: number; mes: number; label: string }[]
}

export interface PeriodoDisponible {
  anio: number
  mes: number
  label: string
}

export async function getDashboard(anio?: number, mes?: number): Promise<DashboardData> {
  const params: Record<string, string> = {}
  if (anio) params.anio = String(anio)
  if (mes) params.mes = String(mes)
  const res = await apiClient.get('/api/finanzas/dashboard/', { params })
  return res.data
}

export async function getPeriodosDisponibles(): Promise<PeriodoDisponible[]> {
  const res = await apiClient.get('/api/finanzas/periodos/')
  return Array.isArray(res.data) ? res.data : (res.data.results ?? [])
}

export type TipoEstado = 'BG' | 'ER' | 'FC'

export const LABEL_TIPO_ESTADO: Record<TipoEstado, string> = {
  BG: 'Balance General',
  ER: 'Estado de Resultados',
  FC: 'Flujo de Caja',
}

export interface ResultadoImportacion {
  importados: number
  periodos: string[]
  empresas: { nombre: string; importados: number }[]
  no_encontrados: string[]
  tipo_estado_label: string
}

export async function importarBalance(archivo: File, tipoEstado: TipoEstado = 'BG'): Promise<ResultadoImportacion> {
  const fd = new FormData()
  fd.append('archivo', archivo)
  fd.append('tipo_estado', tipoEstado)
  const res = await apiClient.post('/api/finanzas/importar/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

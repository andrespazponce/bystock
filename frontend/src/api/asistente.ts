import apiClient from './client'

/** Una referencia a un punto específico del orden del día. */
export interface ReferenciaActa {
  reunion_id: number
  punto_id: number
  etiqueta: string
  titulo_punto: string
}

/** Un mensaje en el hilo del chat. */
export interface MensajeChat {
  id: string
  rol: 'user' | 'asistente'
  texto: string
  referencias?: ReferenciaActa[]
  /** Mensaje en estado de espera (spinner). */
  cargando?: boolean
  /** Mensaje con error devuelto por el servidor. */
  error?: boolean
}

/**
 * Envía una pregunta al asistente IA junto con el historial reciente.
 * El backend carga el contexto completo de reuniones y devuelve la respuesta
 * con las referencias a los puntos que la sustentan.
 */
export async function preguntarAsistente(
  pregunta: string,
  historial: MensajeChat[],
): Promise<{ respuesta: string; referencias: ReferenciaActa[] }> {
  // Solo enviamos mensajes reales (no los de carga ni los de error sin texto útil)
  const historialSimple = historial
    .filter((m) => !m.cargando && m.texto.trim())
    .map((m) => ({ rol: m.rol, texto: m.texto }))

  const res = await apiClient.post<{
    respuesta?: string
    referencias?: ReferenciaActa[]
    error?: string
  }>('/api/asistente/', { pregunta, historial: historialSimple })

  if (res.data.error) throw new Error(res.data.error)

  return {
    respuesta: res.data.respuesta ?? '',
    referencias: res.data.referencias ?? [],
  }
}

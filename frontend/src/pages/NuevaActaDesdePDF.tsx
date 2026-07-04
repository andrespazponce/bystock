/**
 * NuevaActaDesdePDF — Flujo "Acta-first"
 *
 * El usuario sube el PDF firmado de un acta ya realizada.
 * Claude extrae metadatos + puntos + resoluciones + compromisos.
 * El usuario revisa, mapea responsables a Personas de la BD y confirma.
 * El backend crea Reunion + Acta + PuntoOrden[] + Resolucion[] + Compromiso[]
 * en una sola transacción atómica.
 *
 * Ruta: /actas/nueva-desde-pdf
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import {
  crearDesdeActa,
  extraerActaCompleta,
  getOrganos,
  getPersonas,
} from '../api/reuniones'
import type { Organo, PersonaLite, PropuestaActaCompleta } from '../api/reuniones'
import { useAuth } from '../auth/AuthContext'

// ── Constantes ───────────────────────────────────────────────────────────────

const TIPOS = [
  { value: 'ORDINARIA', label: 'Ordinaria' },
  { value: 'EXTRAORDINARIA', label: 'Extraordinaria' },
]
const MODALIDADES = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'MIXTA', label: 'Mixta' },
]
const RESULTADOS = [
  { value: 'APROBADA', label: 'Aprobada' },
  { value: 'RECHAZADA', label: 'Rechazada' },
  { value: 'POSPUESTA', label: 'Pospuesta' },
]

// ── Tipos internos ────────────────────────────────────────────────────────────

interface ResolucionEditable {
  uid: string
  texto: string
  resultado: string
  por_unanimidad: boolean
}

interface CompromisoEditable {
  uid: string
  descripcion: string
  responsable_nombre: string
  responsable: number | null
  fecha_limite: string
  para_proxima_reunion: boolean
}

interface DocumentoDetectado {
  descripcion: string
  tipo_sugerido: string
}

interface PuntoEditable {
  uid: string
  titulo: string
  /** Texto verbatim del acta para este punto, con solo corrección ortográfica. */
  desarrollo: string
  /** Síntesis concisa de los aspectos más relevantes del punto. */
  resumen: string
  resoluciones: ResolucionEditable[]
  compromisos: CompromisoEditable[]
  /** Solo informativo: documentos que la IA detectó que deberían adjuntarse. */
  documentos_detectados: DocumentoDetectado[]
  abierto: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _uid = 0
function newUid() {
  return String(++_uid)
}

function extraerErrores(err: unknown, fallback: string): string[] {
  if (axios.isAxiosError(err) && err.response?.data) {
    const data = err.response.data as Record<string, unknown>
    if (typeof data.detail === 'string') return [data.detail]
    if (err.response.status === 403) return ['No tenés permiso para crear reuniones.']
    const msgs: string[] = []
    for (const v of Object.values(data)) {
      if (Array.isArray(v)) msgs.push(...v.map(String))
      else if (v) msgs.push(String(v))
    }
    return msgs.length ? msgs : [fallback]
  }
  return [fallback]
}

function propuestaAPuntos(p: PropuestaActaCompleta): PuntoEditable[] {
  return (p.puntos ?? []).map((pt) => ({
    uid: newUid(),
    titulo: pt.titulo ?? '',
    desarrollo: pt.desarrollo ?? '',
    resumen: pt.resumen ?? '',
    abierto: true,
    documentos_detectados: pt.documentos_detectados ?? [],
    resoluciones: (pt.resoluciones ?? []).map((r) => ({
      uid: newUid(),
      texto: r.texto ?? '',
      resultado: r.resultado ?? 'APROBADA',
      por_unanimidad: r.por_unanimidad ?? false,
    })),
    compromisos: (pt.compromisos ?? []).map((c) => ({
      uid: newUid(),
      descripcion: c.descripcion ?? '',
      responsable_nombre: c.responsable_nombre ?? '',
      responsable: c.responsable ?? null,
      fecha_limite: c.fecha_limite ?? '',
      para_proxima_reunion: c.para_proxima_reunion ?? false,
    })),
  }))
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function NuevaActaDesdePDF() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const puede = !!user?.puede_gestionar_reuniones
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Datos de referencia
  const [organos, setOrganos] = useState<Organo[]>([])
  const [personas, setPersonas] = useState<PersonaLite[]>([])
  useEffect(() => {
    getOrganos().then(setOrganos).catch(() => {})
    getPersonas().then(setPersonas).catch(() => {})
  }, [])

  // Upload + extracción
  const [archivo, setArchivo] = useState<File | null>(null)
  const [extrayendo, setExtrayendo] = useState(false)
  const [errorExtraccion, setErrorExtraccion] = useState<string | null>(null)
  const [propuesta, setPropuesta] = useState<PropuestaActaCompleta | null>(null)

  // Formulario — metadatos de la reunión
  const [organoId, setOrganoId] = useState<string>('')
  const [numero, setNumero] = useState<string>('')
  const [gestion, setGestion] = useState<string>(String(new Date().getFullYear()))
  const [fecha, setFecha] = useState<string>('')
  const [horaInicio, setHoraInicio] = useState<string>('')
  const [horaFin, setHoraFin] = useState<string>('')
  const [lugar, setLugar] = useState<string>('')
  const [tipo, setTipo] = useState<string>('ORDINARIA')
  const [modalidad, setModalidad] = useState<string>('PRESENCIAL')

  // Puntos editables
  const [puntos, setPuntos] = useState<PuntoEditable[]>([])

  // Creación
  const [creando, setCreando] = useState(false)
  const [erroresCreacion, setErroresCreacion] = useState<string[]>([])

  // ── Extracción ─────────────────────────────────────────────────────────────

  function aplicarPropuesta(p: PropuestaActaCompleta) {
    if (p.organo_id != null) setOrganoId(String(p.organo_id))
    if (p.numero != null) setNumero(String(p.numero))
    if (p.gestion != null) setGestion(String(p.gestion))
    if (p.fecha) setFecha(p.fecha)
    if (p.hora_inicio) setHoraInicio(p.hora_inicio)
    if (p.hora_fin) setHoraFin(p.hora_fin)
    setLugar(p.lugar || '')
    setTipo(p.tipo || 'ORDINARIA')
    setModalidad(p.modalidad || 'PRESENCIAL')
    setPuntos(propuestaAPuntos(p))
  }

  async function extraer() {
    if (!archivo) return
    setExtrayendo(true)
    setErrorExtraccion(null)
    setPropuesta(null)
    try {
      const p = await extraerActaCompleta(archivo)
      setPropuesta(p)
      aplicarPropuesta(p)
    } catch (err) {
      setErrorExtraccion(
        extraerErrores(err, 'Error al procesar el acta con IA.').join(' '),
      )
    } finally {
      setExtrayendo(false)
    }
  }

  // ── Mutaciones de la lista de puntos ───────────────────────────────────────

  function togglePunto(uid: string) {
    setPuntos((prev) =>
      prev.map((p) => (p.uid === uid ? { ...p, abierto: !p.abierto } : p)),
    )
  }
  function moverPuntoArriba(uid: string) {
    setPuntos((prev) => {
      const i = prev.findIndex((p) => p.uid === uid)
      if (i <= 0) return prev
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next
    })
  }
  function moverPuntoAbajo(uid: string) {
    setPuntos((prev) => {
      const i = prev.findIndex((p) => p.uid === uid)
      if (i < 0 || i >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next
    })
  }
  function quitarPunto(uid: string) {
    setPuntos((prev) => prev.filter((p) => p.uid !== uid))
  }
  function agregarPunto() {
    setPuntos((prev) => [
      ...prev,
      {
        uid: newUid(),
        titulo: '',
        desarrollo: '',
        resumen: '',
        resoluciones: [],
        compromisos: [],
        documentos_detectados: [],
        abierto: true,
      },
    ])
  }
  function actualizarPunto(uid: string, cambios: Partial<Omit<PuntoEditable, 'uid'>>) {
    setPuntos((prev) => prev.map((p) => (p.uid === uid ? { ...p, ...cambios } : p)))
  }

  // ── Resoluciones ──────────────────────────────────────────────────────────

  function agregarResolucion(puntoUid: string) {
    setPuntos((prev) =>
      prev.map((p) =>
        p.uid === puntoUid
          ? {
              ...p,
              resoluciones: [
                ...p.resoluciones,
                { uid: newUid(), texto: '', resultado: 'APROBADA', por_unanimidad: false },
              ],
            }
          : p,
      ),
    )
  }
  function actualizarResolucion(puntoUid: string, resUid: string, cambios: Partial<ResolucionEditable>) {
    setPuntos((prev) =>
      prev.map((p) =>
        p.uid === puntoUid
          ? { ...p, resoluciones: p.resoluciones.map((r) => (r.uid === resUid ? { ...r, ...cambios } : r)) }
          : p,
      ),
    )
  }
  function quitarResolucion(puntoUid: string, resUid: string) {
    setPuntos((prev) =>
      prev.map((p) =>
        p.uid === puntoUid
          ? { ...p, resoluciones: p.resoluciones.filter((r) => r.uid !== resUid) }
          : p,
      ),
    )
  }

  // ── Compromisos ───────────────────────────────────────────────────────────

  function agregarCompromiso(puntoUid: string) {
    setPuntos((prev) =>
      prev.map((p) =>
        p.uid === puntoUid
          ? {
              ...p,
              compromisos: [
                ...p.compromisos,
                {
                  uid: newUid(),
                  descripcion: '',
                  responsable_nombre: '',
                  responsable: null,
                  fecha_limite: '',
                  para_proxima_reunion: false,
                },
              ],
            }
          : p,
      ),
    )
  }
  function actualizarCompromiso(puntoUid: string, compUid: string, cambios: Partial<CompromisoEditable>) {
    setPuntos((prev) =>
      prev.map((p) =>
        p.uid === puntoUid
          ? { ...p, compromisos: p.compromisos.map((c) => (c.uid === compUid ? { ...c, ...cambios } : c)) }
          : p,
      ),
    )
  }
  function quitarCompromiso(puntoUid: string, compUid: string) {
    setPuntos((prev) =>
      prev.map((p) =>
        p.uid === puntoUid
          ? { ...p, compromisos: p.compromisos.filter((c) => c.uid !== compUid) }
          : p,
      ),
    )
  }

  // ── Crear ─────────────────────────────────────────────────────────────────

  async function crear() {
    setErroresCreacion([])
    if (!organoId || !gestion || !fecha) {
      setErroresCreacion(['Completá los campos obligatorios: Órgano, Gestión y Fecha.'])
      return
    }
    const payload = {
      organo: Number(organoId),
      numero: numero ? Number(numero) : null,
      gestion: Number(gestion),
      fecha,
      hora_inicio: horaInicio || null,
      hora_fin: horaFin || null,
      lugar,
      tipo,
      modalidad,
      puntos: puntos
        .filter((p) => p.titulo.trim())
        .map((p) => ({
          titulo: p.titulo.trim(),
          desarrollo: p.desarrollo,
          resumen: p.resumen,
          resoluciones: p.resoluciones
            .filter((r) => r.texto.trim())
            .map((r) => ({ texto: r.texto, resultado: r.resultado, por_unanimidad: r.por_unanimidad })),
          compromisos: p.compromisos
            .filter((c) => c.descripcion.trim())
            .map((c) => ({
              descripcion: c.descripcion,
              responsable: c.responsable,
              fecha_limite: c.fecha_limite || null,
              para_proxima_reunion: c.para_proxima_reunion,
            })),
        })),
    }
    setCreando(true)
    try {
      const reunion = await crearDesdeActa(payload)
      navigate(`/reuniones/${reunion.id}`)
    } catch (err) {
      setErroresCreacion(extraerErrores(err, 'No se pudo crear el acta.'))
    } finally {
      setCreando(false)
    }
  }

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!puede) {
    return (
      <Layout>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          Cargar acta desde PDF
        </h1>
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No tenés permiso para crear reuniones. Pedile a un administrador que te agregue al
            grupo «Gestores de reuniones».
          </p>
        </div>
      </Layout>
    )
  }

  const puntosValidos = puntos.filter((p) => p.titulo.trim()).length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <button
        onClick={() => navigate('/reuniones')}
        className="btn-ghost"
        style={{ border: 'none', padding: 0, color: 'var(--gold)', marginBottom: '0.75rem' }}
      >
        ← Volver a las reuniones
      </button>

      <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
        Cargar acta desde PDF
      </h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem', fontSize: '0.95rem' }}>
        Subí el PDF firmado del acta y Claude extraerá los datos, los puntos tratados,
        resoluciones y compromisos. Revisá la propuesta, asigná responsables y confirmá.
      </p>

      {/* ══ PASO 1: Subir ═══════════════════════════════════════════════════ */}
      <section style={{ marginTop: '1.5rem' }}>
        <h2 className="serif" style={{ fontSize: '1.2rem', color: 'var(--gold)', margin: '0 0 0.85rem' }}>
          1. Subir el acta
        </h2>

        <div
          className="card"
          style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          {/* Zona de selección de archivo */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${archivo ? 'var(--gold)' : 'var(--border)'}`,
              borderRadius: '10px',
              padding: '2.25rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s, background 0.2s',
              background: archivo
                ? 'color-mix(in srgb, var(--gold) 6%, var(--surface))'
                : undefined,
              userSelect: 'none',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setArchivo(f)
                setPropuesta(null)
                setErrorExtraccion(null)
                e.target.value = ''
              }}
            />
            {archivo ? (
              <>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)', marginBottom: '0.4rem', fontWeight: 600 }}>PDF cargado</div>
                <div style={{ fontWeight: 600, color: 'var(--gold)', fontSize: '1rem' }}>
                  {archivo.name}
                </div>
                <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {(archivo.size / 1024).toFixed(0)} KB — clic para cambiar el archivo
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>⬆</div>
                <div style={{ color: 'var(--text)' }}>
                  Clic para elegir el PDF del acta firmada
                </div>
                <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  PDF · JPG · PNG · WEBP · GIF — máx. 20 MB
                </div>
              </>
            )}
          </div>

          {/* Botón de extracción */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-gold"
              onClick={extraer}
              disabled={!archivo || extrayendo}
              style={{ padding: '0.55rem 1.3rem' }}
            >
              {extrayendo ? 'Analizando el acta…' : 'Analizar con IA'}
            </button>
            {extrayendo && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Puede tardar 30–120 s. No cerrés la pantalla.
              </span>
            )}
          </div>

          {errorExtraccion && (
            <div className="alert-error" style={{ margin: 0 }}>
              {errorExtraccion}
            </div>
          )}

          {propuesta && (
            <div
              style={{
                padding: '0.8rem 1rem',
                background: 'color-mix(in srgb, var(--success) 12%, var(--surface))',
                borderRadius: '6px',
                borderLeft: '3px solid var(--success)',
                fontSize: '0.9rem',
              }}
            >
              Extracción completada.{' '}
              {propuesta.organo_nombre_detectado && (
                <>
                  Órgano detectado: <strong>{propuesta.organo_nombre_detectado}</strong> —{' '}
                </>
              )}
              <strong>{propuesta.puntos.length}</strong> punto(s) extraído(s).
              Revisá los datos y asigná responsables abajo.
            </div>
          )}
        </div>
      </section>

      {/* ══ PASO 2: Datos de la reunión ══════════════════════════════════════ */}
      <section
        style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}
        >
          <h2 className="serif" style={{ fontSize: '1.2rem', color: 'var(--gold)', margin: 0 }}>
            2. Datos de la reunión
          </h2>
          {propuesta && (
            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--gold)',
                background: 'color-mix(in srgb, var(--gold) 12%, var(--surface))',
                padding: '0.15rem 0.55rem',
                borderRadius: '12px',
                border: '1px solid var(--gold)',
              }}
            >
              pre-completado por IA
            </span>
          )}
        </div>

        <div
          className="card"
          style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
        >
          {/* Fila 1: Órgano + Número + Gestión */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Campo label="Órgano *" style={{ flex: 3, minWidth: 200 }}>
              <select
                className="select"
                value={organoId}
                onChange={(e) => setOrganoId(e.target.value)}
              >
                <option value="">— Seleccioná —</option>
                {organos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre} — {o.empresa.nombre} ({o.empresa.codigo})
                  </option>
                ))}
              </select>
              {propuesta?.organo_id == null && propuesta?.organo_nombre_detectado && (
                <span style={{ fontSize: '0.78rem', color: 'var(--warning)', marginTop: '0.2rem' }}>
                  IA detectó "{propuesta.organo_nombre_detectado}" — seleccionalo manualmente.
                </span>
              )}
            </Campo>
            <Campo label="Número (vacío = automático)" style={{ flex: 1, minWidth: 180 }}>
              <input
                type="number"
                className="input"
                value={numero}
                min={1}
                placeholder="ej. 5"
                onChange={(e) => setNumero(e.target.value)}
              />
            </Campo>
            <Campo label="Gestión (año) *" style={{ flex: 1, minWidth: 110 }}>
              <input
                type="number"
                className="input"
                value={gestion}
                min={2000}
                max={2100}
                onChange={(e) => setGestion(e.target.value)}
              />
            </Campo>
          </div>

          {/* Fila 2: Fecha + Hora inicio + Hora fin */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Campo label="Fecha *" style={{ flex: 2, minWidth: 160 }}>
              <input
                type="date"
                className="input"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </Campo>
            <Campo label="Hora de inicio" style={{ flex: 1, minWidth: 130 }}>
              <input
                type="time"
                className="input"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </Campo>
            <Campo label="Hora de fin" style={{ flex: 1, minWidth: 130 }}>
              <input
                type="time"
                className="input"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
              />
            </Campo>
          </div>

          {/* Fila 3: Lugar */}
          <Campo label="Lugar">
            <input
              type="text"
              className="input"
              value={lugar}
              placeholder="Sala de reuniones, oficina, dirección…"
              onChange={(e) => setLugar(e.target.value)}
            />
          </Campo>

          {/* Fila 4: Tipo + Modalidad */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Campo label="Tipo" style={{ flex: 1, minWidth: 150 }}>
              <select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Modalidad" style={{ flex: 1, minWidth: 150 }}>
              <select className="select" value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
                {MODALIDADES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </Campo>
          </div>
        </div>
      </section>

      {/* ══ PASO 3: Puntos del acta ══════════════════════════════════════════ */}
      <section
        style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}
        >
          <h2 className="serif" style={{ fontSize: '1.2rem', color: 'var(--gold)', margin: 0 }}>
            3. Puntos del acta
          </h2>
          {puntos.length > 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {puntosValidos} punto(s) — podés reordenar, editar o agregar más
            </span>
          )}
        </div>

        {puntos.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>
            Sin puntos todavía. Analizá el acta con IA o agregá manualmente.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {puntos.map((p, i) => (
            <EditorPunto
              key={p.uid}
              punto={p}
              indice={i}
              total={puntos.length}
              personas={personas}
              onToggle={() => togglePunto(p.uid)}
              onMoverArriba={() => moverPuntoArriba(p.uid)}
              onMoverAbajo={() => moverPuntoAbajo(p.uid)}
              onQuitar={() => quitarPunto(p.uid)}
              onActualizar={(cambios) => actualizarPunto(p.uid, cambios)}
              onAgregarResolucion={() => agregarResolucion(p.uid)}
              onActualizarResolucion={(rUid, cambios) => actualizarResolucion(p.uid, rUid, cambios)}
              onQuitarResolucion={(rUid) => quitarResolucion(p.uid, rUid)}
              onAgregarCompromiso={() => agregarCompromiso(p.uid)}
              onActualizarCompromiso={(cUid, cambios) => actualizarCompromiso(p.uid, cUid, cambios)}
              onQuitarCompromiso={(cUid) => quitarCompromiso(p.uid, cUid)}
            />
          ))}
        </div>

        <button
          type="button"
          className="btn-ghost"
          onClick={agregarPunto}
          style={{ padding: '0.38rem 0.75rem', fontSize: '0.88rem', marginTop: '0.75rem' }}
        >
          + Agregar punto
        </button>
      </section>

      {/* ══ CONFIRMAR ════════════════════════════════════════════════════════ */}
      <div
        style={{
          marginTop: '2rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className="btn-gold"
          onClick={crear}
          disabled={creando}
          style={{ padding: '0.65rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
        >
          {creando
            ? 'Creando…'
            : puntosValidos > 0
            ? `Crear acta con ${puntosValidos} punto(s)`
            : 'Crear acta completa'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => navigate('/reuniones')}
          disabled={creando}
          style={{ padding: '0.65rem 1rem' }}
        >
          Cancelar
        </button>
      </div>

      {erroresCreacion.length > 0 && (
        <div className="alert-error" style={{ marginTop: '1rem' }}>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {erroresCreacion.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </Layout>
  )
}

// ── EditorPunto ───────────────────────────────────────────────────────────────

interface EditorPuntoProps {
  punto: PuntoEditable
  indice: number
  total: number
  personas: PersonaLite[]
  onToggle: () => void
  onMoverArriba: () => void
  onMoverAbajo: () => void
  onQuitar: () => void
  onActualizar: (cambios: Partial<Omit<PuntoEditable, 'uid'>>) => void
  onAgregarResolucion: () => void
  onActualizarResolucion: (uid: string, cambios: Partial<ResolucionEditable>) => void
  onQuitarResolucion: (uid: string) => void
  onAgregarCompromiso: () => void
  onActualizarCompromiso: (uid: string, cambios: Partial<CompromisoEditable>) => void
  onQuitarCompromiso: (uid: string) => void
}

const LABEL_TIPO_DOC: Record<string, string> = {
  ACTA_FIRMADA: 'Acta firmada',
  INFORME: 'Informe',
  CONTRATO: 'Contrato',
  TESTIMONIO: 'Testimonio / escritura',
  ESTADO_FINANCIERO: 'Estado financiero',
  OTRO: 'Otro',
}

function EditorPunto({
  punto, indice, total, personas,
  onToggle, onMoverArriba, onMoverAbajo, onQuitar, onActualizar,
  onAgregarResolucion, onActualizarResolucion, onQuitarResolucion,
  onAgregarCompromiso, onActualizarCompromiso, onQuitarCompromiso,
}: EditorPuntoProps) {
  return (
    <div className="card" style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Cabecera del punto */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span
          style={{
            color: 'var(--gold)',
            fontWeight: 700,
            fontSize: '0.9rem',
            minWidth: '1.6rem',
            flexShrink: 0,
          }}
        >
          {indice + 1}.
        </span>
        <input
          type="text"
          className="input"
          value={punto.titulo}
          placeholder={`Punto ${indice + 1}`}
          onChange={(e) => onActualizar({ titulo: e.target.value })}
          style={{ flex: 1, fontWeight: 500 }}
        />
        <button
          type="button" className="btn-ghost" onClick={onMoverArriba} disabled={indice === 0}
          title="Subir" style={{ padding: '0.28rem 0.5rem', fontSize: '0.82rem' }}
        >↑</button>
        <button
          type="button" className="btn-ghost" onClick={onMoverAbajo} disabled={indice === total - 1}
          title="Bajar" style={{ padding: '0.28rem 0.5rem', fontSize: '0.82rem' }}
        >↓</button>
        <button
          type="button" className="btn-ghost" onClick={onToggle}
          title={punto.abierto ? 'Colapsar' : 'Expandir'}
          style={{ padding: '0.28rem 0.5rem', fontSize: '0.82rem' }}
        >
          {punto.abierto ? '▲' : '▼'}
        </button>
        <button
          type="button" className="btn-ghost" onClick={onQuitar}
          title="Quitar punto"
          style={{ padding: '0.28rem 0.5rem', fontSize: '0.88rem', color: 'var(--danger)' }}
        >×</button>
      </div>

      {/* Cuerpo expandible */}
      {punto.abierto && (
        <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Resumen */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.88rem' }}>
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              Resumen
              <span style={{ fontSize: '0.75rem', color: 'var(--gold)', fontStyle: 'italic' }}>
                — síntesis de los aspectos más relevantes
              </span>
            </span>
            <textarea
              className="input"
              value={punto.resumen}
              rows={3}
              placeholder="Resumen conciso de lo más importante tratado en este punto…"
              onChange={(e) => onActualizar({ resumen: e.target.value })}
              style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </label>

          {/* Desarrollo */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.88rem' }}>
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              Transcripción
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                — texto verbatim del acta, solo corrección ortográfica
              </span>
            </span>
            <textarea
              className="input"
              value={punto.desarrollo}
              rows={6}
              placeholder="Texto tal cual aparece en el acta para este punto…"
              onChange={(e) => onActualizar({ desarrollo: e.target.value })}
              style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </label>

          {/* Documentos detectados */}
          {punto.documentos_detectados.length > 0 && (
            <div
              style={{
                padding: '0.7rem 0.9rem',
                background: 'color-mix(in srgb, var(--warning, #d97706) 10%, var(--surface))',
                borderRadius: '6px',
                borderLeft: '3px solid var(--warning, #d97706)',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.35rem', color: 'var(--warning, #d97706)' }}>
                Documentos detectados — debés subirlos manualmente
              </div>
              <ul style={{ margin: '0 0 0.35rem', paddingLeft: '1.1rem' }}>
                {punto.documentos_detectados.map((doc, i) => (
                  <li key={i} style={{ marginBottom: '0.15rem' }}>
                    {doc.descripcion}
                    {doc.tipo_sugerido && doc.tipo_sugerido !== 'OTRO' && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                        ({LABEL_TIPO_DOC[doc.tipo_sugerido] ?? doc.tipo_sugerido})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Una vez confirmada el acta, subílos desde la pantalla de Documentos vinculando al punto correspondiente.
              </span>
            </div>
          )}

          {/* Resoluciones */}
          <div>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Resoluciones ({punto.resoluciones.length})
            </div>
            {punto.resoluciones.map((r) => (
              <EditorResolucion
                key={r.uid}
                resolucion={r}
                onActualizar={(cambios) => onActualizarResolucion(r.uid, cambios)}
                onQuitar={() => onQuitarResolucion(r.uid)}
              />
            ))}
            <button
              type="button" className="btn-ghost" onClick={onAgregarResolucion}
              style={{ fontSize: '0.82rem', padding: '0.25rem 0.6rem', marginTop: '0.25rem' }}
            >
              + Resolución
            </button>
          </div>

          {/* Compromisos */}
          <div>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Compromisos ({punto.compromisos.length})
            </div>
            {punto.compromisos.map((c) => (
              <EditorCompromiso
                key={c.uid}
                compromiso={c}
                personas={personas}
                onActualizar={(cambios) => onActualizarCompromiso(c.uid, cambios)}
                onQuitar={() => onQuitarCompromiso(c.uid)}
              />
            ))}
            <button
              type="button" className="btn-ghost" onClick={onAgregarCompromiso}
              style={{ fontSize: '0.82rem', padding: '0.25rem 0.6rem', marginTop: '0.25rem' }}
            >
              + Compromiso
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── EditorResolucion ──────────────────────────────────────────────────────────

interface EditorResolucionProps {
  resolucion: ResolucionEditable
  onActualizar: (cambios: Partial<ResolucionEditable>) => void
  onQuitar: () => void
}

function EditorResolucion({ resolucion, onActualizar, onQuitar }: EditorResolucionProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-start',
        padding: '0.5rem 0.6rem',
        marginBottom: '0.4rem',
        background: 'var(--bg)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="select"
            value={resolucion.resultado}
            onChange={(e) => onActualizar({ resultado: e.target.value })}
            style={{ width: 'auto', fontSize: '0.82rem' }}
          >
            {RESULTADOS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={resolucion.por_unanimidad}
              onChange={(e) => onActualizar({ por_unanimidad: e.target.checked })}
            />
            Por unanimidad
          </label>
        </div>
        <input
          type="text"
          className="input"
          value={resolucion.texto}
          placeholder="Texto de la resolución…"
          onChange={(e) => onActualizar({ texto: e.target.value })}
          style={{ fontSize: '0.88rem' }}
        />
      </div>
      <button
        type="button" className="btn-ghost" onClick={onQuitar}
        style={{ padding: '0.2rem 0.5rem', fontSize: '0.88rem', color: 'var(--danger)', flexShrink: 0, marginTop: '0.15rem' }}
      >×</button>
    </div>
  )
}

// ── EditorCompromiso ──────────────────────────────────────────────────────────

interface EditorCompromisoProps {
  compromiso: CompromisoEditable
  personas: PersonaLite[]
  onActualizar: (cambios: Partial<CompromisoEditable>) => void
  onQuitar: () => void
}

function EditorCompromiso({ compromiso, personas, onActualizar, onQuitar }: EditorCompromisoProps) {
  return (
    <div
      style={{
        padding: '0.5rem 0.6rem',
        marginBottom: '0.4rem',
        background: 'var(--bg)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <input
          type="text"
          className="input"
          value={compromiso.descripcion}
          placeholder="Descripción del compromiso…"
          onChange={(e) => onActualizar({ descripcion: e.target.value })}
          style={{ fontSize: '0.88rem' }}
        />

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Responsable */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 2, minWidth: 160 }}>
            {compromiso.responsable_nombre && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                IA detectó: «{compromiso.responsable_nombre}»
              </span>
            )}
            <select
              className="select"
              value={compromiso.responsable ?? ''}
              onChange={(e) =>
                onActualizar({ responsable: e.target.value ? Number(e.target.value) : null })
              }
              style={{ fontSize: '0.82rem' }}
            >
              <option value="">— Sin responsable —</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre_completo}</option>
              ))}
            </select>
          </label>

          {/* Fecha límite */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: 140, fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Fecha límite</span>
            <input
              type="date"
              className="input"
              value={compromiso.fecha_limite}
              onChange={(e) => onActualizar({ fecha_limite: e.target.value })}
              style={{ fontSize: '0.82rem' }}
            />
          </label>

          {/* Para próxima reunión */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.82rem',
              cursor: 'pointer',
              paddingBottom: '0.3rem',
            }}
          >
            <input
              type="checkbox"
              checked={compromiso.para_proxima_reunion}
              onChange={(e) => onActualizar({ para_proxima_reunion: e.target.checked })}
            />
            Para próxima reunión
          </label>
        </div>
      </div>

      <button
        type="button" className="btn-ghost" onClick={onQuitar}
        style={{ padding: '0.2rem 0.5rem', fontSize: '0.88rem', color: 'var(--danger)', flexShrink: 0, marginTop: '0.15rem' }}
      >×</button>
    </div>
  )
}

// ── Helpers de presentación ───────────────────────────────────────────────────

function Campo({
  label,
  children,
  style,
}: {
  label: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        fontSize: '0.9rem',
        ...style,
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </label>
  )
}

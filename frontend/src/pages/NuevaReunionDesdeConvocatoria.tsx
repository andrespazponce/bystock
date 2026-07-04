/**
 * NuevaReunionDesdeConvocatoria
 *
 * Flujo en 3 pasos en una sola pantalla:
 *   1. Subir el PDF o imagen de la convocatoria / agenda.
 *   2. Claude extrae los datos y pre-completa el formulario.
 *   3. El usuario revisa, edita si necesita, y crea la reunión con su orden del día.
 *
 * La creación hace:
 *   POST /api/reuniones/      → crea la reunión
 *   POST /api/puntos/ × N    → crea cada punto secuencialmente (para respetar el orden)
 * y luego navega a /reuniones/:id/orden-del-dia.
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import {
  createPunto,
  createReunion,
  extraerConvocatoria,
  getOrganos,
} from '../api/reuniones'
import type { Organo, PropuestaConvocatoria } from '../api/reuniones'
import { useAuth } from '../auth/AuthContext'

// ── Choices (espejo del modelo) ──────────────────────────────────────────────
const TIPOS = [
  { value: 'ORDINARIA', label: 'Ordinaria' },
  { value: 'EXTRAORDINARIA', label: 'Extraordinaria' },
]
const MODALIDADES = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'MIXTA', label: 'Mixta' },
]
const ESTADOS_REUNION = [
  { value: 'CONVOCADA', label: 'Convocada' },
  { value: 'REALIZADA', label: 'Realizada' },
  { value: 'CANCELADA', label: 'Cancelada' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function extraerErrores(err: unknown, fallback: string): string[] {
  if (axios.isAxiosError(err) && err.response?.data) {
    const data = err.response.data as Record<string, unknown>
    if (typeof data.detail === 'string') return [data.detail]
    if (err.response.status === 403) return ['No tenés permiso para crear reuniones.']
    const msgs: string[] = []
    for (const valor of Object.values(data)) {
      if (Array.isArray(valor)) msgs.push(...valor.map(String))
      else if (valor) msgs.push(String(valor))
    }
    return msgs.length ? msgs : [fallback]
  }
  return [fallback]
}

let _uidCounter = 0
function newUid() {
  return String(++_uidCounter)
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function NuevaReunionDesdeConvocatoria() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const puede = !!user?.puede_gestionar_reuniones
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Órganos ─────────────────────────────────────────────────────────────
  const [organos, setOrganos] = useState<Organo[]>([])
  useEffect(() => {
    getOrganos().then(setOrganos).catch(() => {})
  }, [])

  // ── Upload + extracción ──────────────────────────────────────────────────
  const [archivo, setArchivo] = useState<File | null>(null)
  const [extrayendo, setExtrayendo] = useState(false)
  const [errorExtraccion, setErrorExtraccion] = useState<string | null>(null)
  const [propuesta, setPropuesta] = useState<PropuestaConvocatoria | null>(null)

  // ── Formulario ───────────────────────────────────────────────────────────
  const [organoId, setOrganoId] = useState<string>('')
  const [numero, setNumero] = useState<string>('')
  const [gestion, setGestion] = useState<string>(String(new Date().getFullYear()))
  const [fecha, setFecha] = useState<string>('')
  const [horaInicio, setHoraInicio] = useState<string>('')
  const [horaFin, setHoraFin] = useState<string>('')
  const [lugar, setLugar] = useState<string>('')
  const [tipo, setTipo] = useState<string>('ORDINARIA')
  const [modalidad, setModalidad] = useState<string>('PRESENCIAL')
  const [estado, setEstado] = useState<string>('CONVOCADA')

  // ── Puntos editables ─────────────────────────────────────────────────────
  const [puntos, setPuntos] = useState<Array<{ uid: string; titulo: string }>>([])

  // ── Creación ─────────────────────────────────────────────────────────────
  const [creando, setCreando] = useState(false)
  const [erroresCreacion, setErroresCreacion] = useState<string[]>([])

  // ── Lógica ───────────────────────────────────────────────────────────────
  function aplicarPropuesta(p: PropuestaConvocatoria) {
    if (p.organo_id != null) setOrganoId(String(p.organo_id))
    if (p.numero != null) setNumero(String(p.numero))
    if (p.gestion != null) setGestion(String(p.gestion))
    if (p.fecha) setFecha(p.fecha)
    if (p.hora_inicio) setHoraInicio(p.hora_inicio)
    if (p.hora_fin) setHoraFin(p.hora_fin)
    setLugar(p.lugar || '')
    setTipo(p.tipo || 'ORDINARIA')
    setModalidad(p.modalidad || 'PRESENCIAL')
    setPuntos((p.puntos || []).map((pt) => ({ uid: newUid(), titulo: pt.titulo })))
  }

  async function extraer() {
    if (!archivo) return
    setExtrayendo(true)
    setErrorExtraccion(null)
    setPropuesta(null)
    try {
      const p = await extraerConvocatoria(archivo)
      setPropuesta(p)
      aplicarPropuesta(p)
    } catch (err) {
      setErrorExtraccion(extraerErrores(err, 'Error al procesar el documento con IA.').join(' '))
    } finally {
      setExtrayendo(false)
    }
  }

  // ── Helpers de la lista de puntos ────────────────────────────────────────
  function moverArriba(uid: string) {
    setPuntos((prev) => {
      const i = prev.findIndex((p) => p.uid === uid)
      if (i <= 0) return prev
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next
    })
  }
  function moverAbajo(uid: string) {
    setPuntos((prev) => {
      const i = prev.findIndex((p) => p.uid === uid)
      if (i < 0 || i >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next
    })
  }
  function editarTitulo(uid: string, titulo: string) {
    setPuntos((prev) => prev.map((p) => (p.uid === uid ? { ...p, titulo } : p)))
  }
  function agregarPunto() {
    setPuntos((prev) => [...prev, { uid: newUid(), titulo: '' }])
  }
  function quitarPunto(uid: string) {
    setPuntos((prev) => prev.filter((p) => p.uid !== uid))
  }

  // ── Crear reunión + puntos ───────────────────────────────────────────────
  async function crearReunion() {
    setErroresCreacion([])

    if (!organoId || !numero || !gestion || !fecha) {
      setErroresCreacion(['Completá los campos obligatorios: Órgano, Número, Gestión y Fecha.'])
      return
    }

    const puntosFiltrados = puntos.filter((p) => p.titulo.trim())

    setCreando(true)
    try {
      const reunion = await createReunion({
        organo: Number(organoId),
        numero: Number(numero),
        gestion: Number(gestion),
        fecha,
        fecha_fin: null,
        hora_inicio: horaInicio || null,
        hora_fin: horaFin || null,
        lugar,
        tipo,
        modalidad,
        estado,
        observaciones: '',
      })

      // Secuencial: el auto-orden del backend usa max(orden)+1
      for (const p of puntosFiltrados) {
        await createPunto({
          reunion: reunion.id,
          titulo: p.titulo.trim(),
          desarrollo: '',
          notas_crudas: '',
          empresa: null,
          estado: 'PENDIENTE',
        })
      }

      navigate(`/reuniones/${reunion.id}/orden-del-dia`)
    } catch (err) {
      setErroresCreacion(extraerErrores(err, 'No se pudo crear la reunión.'))
    } finally {
      setCreando(false)
    }
  }

  // ── Guard ────────────────────────────────────────────────────────────────
  if (!puede) {
    return (
      <Layout>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          Nueva reunión desde convocatoria
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

  // ── Render ───────────────────────────────────────────────────────────────
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
        Nueva reunión desde convocatoria
      </h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem', fontSize: '0.95rem' }}>
        Subí la convocatoria o agenda (PDF o imagen) y Claude completará los datos
        automáticamente. Revisá, editá si hace falta y creá la reunión con un clic.
      </p>

      {/* ══ PASO 1: Upload ══════════════════════════════════════════════════ */}
      <section style={{ marginTop: '1.5rem' }}>
        <SeccionTitulo>1. Subir el documento</SeccionTitulo>

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
                // reset el input para poder volver a elegir el mismo archivo
                e.target.value = ''
              }}
            />
            {archivo ? (
              <>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)', marginBottom: '0.4rem', fontWeight: 600 }}>Archivo cargado</div>
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
                  Clic para elegir el archivo de convocatoria o agenda
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
              {extrayendo ? 'Analizando el documento…' : 'Extraer con IA'}
            </button>
            {extrayendo && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Puede tardar 20–60 s. No cerrés la pantalla.
              </span>
            )}
          </div>

          {/* Error de extracción */}
          {errorExtraccion && (
            <div className="alert-error" style={{ margin: 0 }}>
              {errorExtraccion}
            </div>
          )}

          {/* Banner de éxito */}
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
                  Órgano detectado:{' '}
                  <strong>{propuesta.organo_nombre_detectado}</strong> —{' '}
                </>
              )}
              <strong>{propuesta.puntos.length}</strong> punto(s) en el orden del día.
              Revisá los datos abajo.
            </div>
          )}
        </div>
      </section>

      {/* ══ PASO 2: Datos de la reunión ══════════════════════════════════════ */}
      <section
        style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
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
            <Campo label="Número *" style={{ flex: 1, minWidth: 100 }}>
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

          {/* Fila 4: Tipo + Modalidad + Estado */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Campo label="Tipo" style={{ flex: 1, minWidth: 150 }}>
              <select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Modalidad" style={{ flex: 1, minWidth: 150 }}>
              <select
                className="select"
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value)}
              >
                {MODALIDADES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Estado" style={{ flex: 1, minWidth: 140 }}>
              <select className="select" value={estado} onChange={(e) => setEstado(e.target.value)}>
                {ESTADOS_REUNION.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        </div>
      </section>

      {/* ══ PASO 3: Orden del día ═════════════════════════════════════════════ */}
      <section
        style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <h2 className="serif" style={{ fontSize: '1.2rem', color: 'var(--gold)', margin: 0 }}>
            3. Orden del día
          </h2>
          {puntos.length > 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {puntosValidos} punto(s) — podés reordenar, editar o agregar más
            </span>
          )}
        </div>

        <div
          className="card"
          style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}
        >
          {puntos.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 0.25rem' }}>
              Sin puntos todavía. Extraé desde el documento o agregá manualmente.
            </p>
          )}

          {puntos.map((p, i) => (
            <div key={p.uid} style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
              {/* Número de orden */}
              <span
                style={{
                  color: 'var(--gold)',
                  fontWeight: 700,
                  minWidth: '1.6rem',
                  fontSize: '0.9rem',
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                {i + 1}.
              </span>

              {/* Título editable */}
              <input
                type="text"
                className="input"
                value={p.titulo}
                placeholder={`Punto ${i + 1}`}
                onChange={(e) => editarTitulo(p.uid, e.target.value)}
                style={{ flex: 1 }}
              />

              {/* Controles de orden y quitar */}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => moverArriba(p.uid)}
                disabled={i === 0}
                title="Subir"
                style={{ padding: '0.28rem 0.5rem', fontSize: '0.82rem' }}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => moverAbajo(p.uid)}
                disabled={i === puntos.length - 1}
                title="Bajar"
                style={{ padding: '0.28rem 0.5rem', fontSize: '0.82rem' }}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => quitarPunto(p.uid)}
                title="Quitar punto"
                style={{
                  padding: '0.28rem 0.5rem',
                  fontSize: '0.88rem',
                  color: 'var(--danger)',
                }}
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            className="btn-ghost"
            onClick={agregarPunto}
            style={{
              padding: '0.38rem 0.75rem',
              fontSize: '0.88rem',
              alignSelf: 'flex-start',
              marginTop: puntos.length > 0 ? '0.35rem' : 0,
            }}
          >
            + Agregar punto
          </button>
        </div>
      </section>

      {/* ══ BOTÓN CREAR ══════════════════════════════════════════════════════ */}
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
          onClick={crearReunion}
          disabled={creando}
          style={{ padding: '0.65rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
        >
          {creando
            ? 'Creando…'
            : puntosValidos > 0
            ? `Crear reunión con ${puntosValidos} punto(s)`
            : 'Crear reunión'}
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

// ── Helpers de presentación ───────────────────────────────────────────────────
function SeccionTitulo({ children }: { children: ReactNode }) {
  return (
    <h2
      className="serif"
      style={{ fontSize: '1.2rem', color: 'var(--gold)', margin: '0 0 0.85rem' }}
    >
      {children}
    </h2>
  )
}

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

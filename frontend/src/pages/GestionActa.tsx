import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import DocumentosAdjuntos from '../components/DocumentosAdjuntos'
import {
  createActa,
  updateActa,
  deleteActa,
  updatePunto,
  deletePunto,
  getReunion,
  getPersonas,
  extraerActa,
  createResolucion,
  updateResolucion,
  deleteResolucion,
  createCompromiso,
  updateCompromiso,
  deleteCompromiso,
} from '../api/reuniones'
import type {
  Acta,
  ActaWritePayload,
  PersonaLite,
  PropuestaPunto,
  PuntoOrden,
  ReunionDetalle,
  Resolucion,
  ResolucionGestion,
  Compromiso,
  CompromisoGestion,
} from '../api/reuniones'
import { useAuth } from '../auth/AuthContext'

// ── Choices ───────────────────────────────────────────────────────────────────

const ESTADOS_ACTA = [
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'APROBADA', label: 'Aprobada' },
  { value: 'FIRMADA', label: 'Firmada' },
]

const RESULTADOS_RESOLUCION = [
  { value: 'APROBADA', label: 'Aprobada' },
  { value: 'RECHAZADA', label: 'Rechazada' },
  { value: 'POSPUESTA', label: 'Pospuesta' },
]

const COLOR_RESULTADO: Record<string, string> = {
  APROBADA: 'var(--success)',
  RECHAZADA: 'var(--danger)',
  POSPUESTA: 'var(--warning)',
}

const COLOR_ESTADO_PUNTO: Record<string, string> = {
  PENDIENTE: 'var(--border)',
  TRATADO: 'var(--success)',
  POSPUESTO: 'var(--warning)',
  INFORMATIVO: 'var(--info)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function extraerErrores(err: unknown, fallback: string): string[] {
  if (axios.isAxiosError(err) && err.response?.status === 400 && err.response.data) {
    const data = err.response.data as Record<string, unknown>
    const msgs: string[] = []
    for (const valor of Object.values(data)) {
      if (Array.isArray(valor)) msgs.push(...valor.map(String))
      else if (valor) msgs.push(String(valor))
    }
    return msgs.length ? msgs : [fallback]
  }
  if (axios.isAxiosError(err) && err.response?.status === 403)
    return ['No tenés permiso para gestionar esta reunión.']
  return [fallback]
}

// ── Tipos internos ────────────────────────────────────────────────────────────

type MetaForm = {
  estado: string
  redactada_por: string
  fecha_aprobacion: string
  firmada_por: number[]
}
const META_VACIO: MetaForm = {
  estado: 'BORRADOR',
  redactada_por: '',
  fecha_aprobacion: '',
  firmada_por: [],
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function GestionActa() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const reunionId = Number(id)
  const { user } = useAuth()
  const puede = !!user?.puede_gestionar_reuniones

  // ── Datos ───────────────────────────────────────────────────────────────
  const [reunion, setReunion] = useState<ReunionDetalle | null>(null)
  const [acta, setActa] = useState<Acta | null>(null)
  const [personas, setPersonas] = useState<PersonaLite[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // ── Formulario de metadatos ─────────────────────────────────────────────
  const [metaForm, setMetaForm] = useState<MetaForm>({ ...META_VACIO })
  const [metaErrores, setMetaErrores] = useState<string[]>([])
  const [guardandoMeta, setGuardandoMeta] = useState(false)
  const [metaOk, setMetaOk] = useState(false)

  // ── Desarrollo por punto ────────────────────────────────────────────────
  const [desarrollos, setDesarrollos] = useState<Record<number, string>>({})
  const [guardandoPunto, setGuardandoPunto] = useState<number | null>(null)
  const [erroresPunto, setErroresPunto] = useState<Record<number, string>>({})

  // ── Texto oficial ───────────────────────────────────────────────────────
  const [contenido, setContenido] = useState('')
  const [guardandoContenido, setGuardandoContenido] = useState(false)
  const [contenidoOk, setContenidoOk] = useState(false)
  const [erroresContenido, setErroresContenido] = useState<string[]>([])

  // ── IA ──────────────────────────────────────────────────────────────────
  const [docExtraccion, setDocExtraccion] = useState<string>('')
  const [extrayendo, setExtrayendo] = useState(false)
  const [errorExtraccion, setErrorExtraccion] = useState<string | null>(null)
  const [propuestaIA, setPropuestaIA] = useState<PropuestaPunto[] | null>(null)

  // ── Eliminar acta ───────────────────────────────────────────────────────
  const [confirmDeleteActa, setConfirmDeleteActa] = useState(false)
  const [eliminandoActa, setEliminandoActa] = useState(false)
  const [errorDeleteActa, setErrorDeleteActa] = useState<string | null>(null)

  // ── Limpiar orden del día ───────────────────────────────────────────────
  const [confirmLimpiarAgenda, setConfirmLimpiarAgenda] = useState(false)
  const [limpiandoAgenda, setLimpiandoAgenda] = useState(false)

  // ── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setErrorCarga(null)
    Promise.all([getReunion(reunionId), getPersonas()])
      .then(([r, pers]) => {
        if (cancelado) return
        setReunion(r)
        setPersonas(pers)
        const a = r.acta
        setActa(a)
        const devs: Record<number, string> = {}
        r.puntos.forEach(p => { devs[p.id] = p.desarrollo ?? '' })
        setDesarrollos(devs)
        if (a) {
          setMetaForm({
            estado: a.estado,
            redactada_por: a.redactada_por ? String(a.redactada_por.id) : '',
            fecha_aprobacion: a.fecha_aprobacion ?? '',
            firmada_por: a.firmada_por.map(p => p.id),
          })
          setContenido(a.contenido ?? '')
        }
      })
      .catch(() => { if (!cancelado) setErrorCarga('No se pudo cargar la información de la reunión.') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [reunionId])

  // ── Metadatos ────────────────────────────────────────────────────────────
  function toggleFirmante(personaId: number) {
    setMetaForm(f => ({
      ...f,
      firmada_por: f.firmada_por.includes(personaId)
        ? f.firmada_por.filter(x => x !== personaId)
        : [...f.firmada_por, personaId],
    }))
    setMetaOk(false)
  }

  async function guardarMeta(e: FormEvent) {
    e.preventDefault()
    setMetaErrores([])
    setMetaOk(false)
    setGuardandoMeta(true)
    try {
      let guardada: Acta
      if (acta) {
        guardada = await updateActa(acta.id, {
          estado: metaForm.estado,
          redactada_por: metaForm.redactada_por ? Number(metaForm.redactada_por) : null,
          fecha_aprobacion: metaForm.fecha_aprobacion || null,
          firmada_por: metaForm.firmada_por,
        })
      } else {
        const payload: ActaWritePayload = {
          reunion: reunionId,
          contenido: '',
          estado: metaForm.estado,
          redactada_por: metaForm.redactada_por ? Number(metaForm.redactada_por) : null,
          fecha_aprobacion: metaForm.fecha_aprobacion || null,
          firmada_por: metaForm.firmada_por,
        }
        guardada = await createActa(payload)
      }
      setActa(guardada)
      setMetaOk(true)
    } catch (err) {
      setMetaErrores(extraerErrores(err, 'No se pudo guardar el acta.'))
    } finally {
      setGuardandoMeta(false)
    }
  }

  // ── Eliminar acta ────────────────────────────────────────────────────────
  async function eliminarActa() {
    if (!acta) return
    setEliminandoActa(true)
    setErrorDeleteActa(null)
    try {
      await deleteActa(acta.id)
      navigate(`/reuniones/${reunionId}`)
    } catch {
      setErrorDeleteActa('No se pudo eliminar el acta. Intentá de nuevo.')
      setEliminandoActa(false)
      setConfirmDeleteActa(false)
    }
  }

  // ── Desarrollo por punto ─────────────────────────────────────────────────
  async function guardarDesarrollo(punto: PuntoOrden) {
    const texto = desarrollos[punto.id] ?? ''
    setGuardandoPunto(punto.id)
    setErroresPunto(prev => ({ ...prev, [punto.id]: '' }))
    try {
      await updatePunto(punto.id, { desarrollo: texto })
      setReunion(r =>
        r ? { ...r, puntos: r.puntos.map(p => p.id === punto.id ? { ...p, desarrollo: texto } : p) } : null
      )
    } catch (err) {
      const msg = extraerErrores(err, 'No se pudo guardar el desarrollo.').join(' ')
      setErroresPunto(prev => ({ ...prev, [punto.id]: msg }))
    } finally {
      setGuardandoPunto(null)
    }
  }

  // ── Eliminar punto ───────────────────────────────────────────────────────
  function handlePuntoEliminado(puntoId: number) {
    setReunion(r => r ? { ...r, puntos: r.puntos.filter(p => p.id !== puntoId) } : null)
    setDesarrollos(prev => {
      const next = { ...prev }
      delete next[puntoId]
      return next
    })
  }

  // ── Limpiar orden del día ────────────────────────────────────────────────
  async function limpiarOrdenDelDia() {
    if (!reunion) return
    setLimpiandoAgenda(true)
    try {
      for (const p of reunion.puntos) {
        await deletePunto(p.id)
      }
      setReunion(r => r ? { ...r, puntos: [] } : null)
      setDesarrollos({})
    } finally {
      setLimpiandoAgenda(false)
      setConfirmLimpiarAgenda(false)
    }
  }

  // ── Texto oficial ────────────────────────────────────────────────────────
  function generarContenido() {
    if (!reunion) return
    const L: string[] = []
    L.push('ACTA DE REUNIÓN')
    L.push('═'.repeat(60))
    L.push(`${reunion.etiqueta} — ${reunion.organo.nombre}`)
    if (reunion.organo.empresa) L.push(reunion.organo.empresa.nombre)
    L.push('')
    L.push(`Tipo: ${reunion.tipo_display}  |  Modalidad: ${reunion.modalidad_display}  |  Estado: ${reunion.estado_display}`)
    L.push(`Fecha: ${formatFecha(reunion.fecha)}`)
    if (reunion.fecha_fin) L.push(`Fecha de fin: ${formatFecha(reunion.fecha_fin)}`)
    if (reunion.hora_inicio) L.push(`Hora de inicio: ${reunion.hora_inicio}`)
    if (reunion.hora_fin) L.push(`Hora de fin: ${reunion.hora_fin}`)
    if (reunion.lugar) L.push(`Lugar: ${reunion.lugar}`)
    L.push('')
    const presentes = reunion.asistencias.filter(a => a.estado === 'PRESENTE')
    const ausentes = reunion.asistencias.filter(a => a.estado !== 'PRESENTE')
    if (presentes.length > 0) {
      L.push('PRESENTES:')
      presentes.forEach(a => L.push(`  - ${a.persona?.nombre_completo ?? '—'} (${a.calidad_display})`))
      L.push('')
    }
    if (ausentes.length > 0) {
      L.push('AUSENTES / EXCUSAS:')
      ausentes.forEach(a => L.push(`  - ${a.persona?.nombre_completo ?? '—'} (${a.estado_display})`))
      L.push('')
    }
    L.push('ORDEN DEL DÍA Y DESARROLLO:')
    L.push('─'.repeat(60))
    L.push('')
    reunion.puntos.forEach(p => {
      L.push(`${p.orden}. ${p.titulo.toUpperCase()}`)
      L.push('')
      const dev = desarrollos[p.id] ?? p.desarrollo
      L.push(dev ? dev : '(Sin desarrollo registrado.)')
      L.push('')
      if (p.resoluciones.length > 0) {
        L.push('  RESOLUCIONES:')
        p.resoluciones.forEach(r => {
          const unani = r.por_unanimidad ? ' (por unanimidad)' : ''
          L.push(`    • ${r.texto}`)
          L.push(`      → ${r.resultado_display}${unani}`)
        })
        L.push('')
      }
      if (p.compromisos.length > 0) {
        L.push('  COMPROMISOS:')
        p.compromisos.forEach(c => {
          const resp = c.responsable ? `Resp.: ${c.responsable.nombre_completo}` : ''
          const vence = c.fecha_limite ? `  Vence: ${formatFecha(c.fecha_limite)}` : ''
          L.push(`    • ${c.descripcion}`)
          if (resp || vence) L.push(`      ${resp}${vence}`)
        })
        L.push('')
      }
      L.push('─'.repeat(60))
      L.push('')
    })
    if (reunion.hora_fin) L.push(`Siendo las ${reunion.hora_fin}, se da por concluida la sesión.`)
    setContenido(L.join('\n'))
    setContenidoOk(false)
  }

  // ── IA ───────────────────────────────────────────────────────────────────
  async function extraerConIA() {
    if (!acta || !docExtraccion) return
    setExtrayendo(true)
    setErrorExtraccion(null)
    setPropuestaIA(null)
    try {
      const puntos = await extraerActa(acta.id, Number(docExtraccion))
      setPropuestaIA(puntos)
    } catch (err) {
      const msg = extraerErrores(err, 'Error al procesar el PDF con IA.').join(' ')
      setErrorExtraccion(msg)
    } finally {
      setExtrayendo(false)
    }
  }

  function aplicarTodaLaPropuesta() {
    if (!propuestaIA) return
    setDesarrollos(prev => {
      const nuevos = { ...prev }
      propuestaIA.forEach(p => { if (p.desarrollo) nuevos[p.punto_id] = p.desarrollo })
      return nuevos
    })
    setPropuestaIA(null)
  }

  async function guardarContenido() {
    if (!acta) return
    setErroresContenido([])
    setContenidoOk(false)
    setGuardandoContenido(true)
    try {
      const guardada = await updateActa(acta.id, { contenido })
      setActa(guardada)
      setContenidoOk(true)
    } catch (err) {
      setErroresContenido(extraerErrores(err, 'No se pudo guardar el texto del acta.'))
    } finally {
      setGuardandoContenido(false)
    }
  }

  // ── Guard sin permiso ────────────────────────────────────────────────────
  if (!puede) {
    return (
      <Layout>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>Acta</h1>
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No tenés permiso para gestionar esta reunión. Pedile a un administrador que te agregue al grupo «Gestores de reuniones».
          </p>
        </div>
      </Layout>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Layout>
      <button
        onClick={() => navigate(`/reuniones/${reunionId}`)}
        className="btn-ghost"
        style={{ border: 'none', padding: 0, color: 'var(--gold)', marginBottom: '0.75rem' }}
      >
        ← Volver a la reunión
      </button>
      <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
        {acta ? 'Editar acta' : 'Redactar acta'}
      </h1>
      {reunion && (
        <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          {reunion.etiqueta} — {reunion.organo.nombre}
        </p>
      )}

      {errorCarga && <div className="alert-error" style={{ marginTop: '1rem' }}>{errorCarga}</div>}

      {cargando ? (
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>
      ) : (
        <>
          {/* ══ 1. METADATOS DEL ACTA ══════════════════════════════════════ */}
          <section style={{ marginTop: '1.5rem' }}>
            <SeccionTitulo>{acta ? 'Estado del acta' : 'Crear acta'}</SeccionTitulo>
            <form onSubmit={guardarMeta}>
              <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <Campo label="Estado" style={{ flex: 1, minWidth: 150 }}>
                    <select
                      className="select"
                      value={metaForm.estado}
                      onChange={e => { setMetaForm(f => ({ ...f, estado: e.target.value })); setMetaOk(false) }}
                    >
                      {ESTADOS_ACTA.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Redactada por (opcional)" style={{ flex: 2, minWidth: 200 }}>
                    <select
                      className="select"
                      value={metaForm.redactada_por}
                      onChange={e => { setMetaForm(f => ({ ...f, redactada_por: e.target.value })); setMetaOk(false) }}
                    >
                      <option value="">— Sin asignar —</option>
                      {personas.map(p => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Fecha de aprobación (opcional)" style={{ flex: 1, minWidth: 160 }}>
                    <input
                      type="date"
                      className="input"
                      value={metaForm.fecha_aprobacion}
                      onChange={e => { setMetaForm(f => ({ ...f, fecha_aprobacion: e.target.value })); setMetaOk(false) }}
                    />
                  </Campo>
                </div>

                {/* Firmada por */}
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Firmada por (opcional)</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.4rem', marginTop: '0.5rem' }}>
                    {personas.map(p => (
                      <label key={p.id} style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', fontSize: '0.9rem' }}>
                        <input type="checkbox" checked={metaForm.firmada_por.includes(p.id)} onChange={() => toggleFirmante(p.id)} />
                        <span>{p.nombre_completo}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {metaErrores.length > 0 && (
                  <div className="alert-error" style={{ margin: 0 }}>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {metaErrores.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
                {metaOk && <p style={{ margin: 0, color: 'var(--success)', fontWeight: 600 }}>Guardado correctamente.</p>}

                <div>
                  <button type="submit" disabled={guardandoMeta} className="btn-gold" style={{ padding: '0.55rem 1.1rem' }}>
                    {guardandoMeta ? 'Guardando…' : acta ? 'Guardar cambios' : 'Crear acta'}
                  </button>
                </div>

                {/* Zona de peligro — eliminar acta */}
                {acta && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.25rem' }}>
                    <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                      Zona de peligro
                    </p>
                    {!confirmDeleteActa ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteActa(true)}
                        style={{
                          background: 'none', border: '1px solid var(--danger)', borderRadius: 6,
                          color: 'var(--danger)', cursor: 'pointer', padding: '0.4rem 0.9rem',
                          fontSize: '0.83rem', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,76,76,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                      >
                        Eliminar acta
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--danger)' }}>
                          ⚠ Esta acción elimina el acta definitivamente junto con sus documentos adjuntos. No se puede deshacer.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={eliminarActa}
                            disabled={eliminandoActa}
                            style={{
                              background: 'var(--danger)', border: 'none', borderRadius: 6,
                              color: '#fff', cursor: 'pointer', padding: '0.4rem 0.9rem', fontSize: '0.83rem',
                              opacity: eliminandoActa ? 0.6 : 1,
                            }}
                          >
                            {eliminandoActa ? 'Eliminando…' : 'Confirmar eliminación'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setConfirmDeleteActa(false); setErrorDeleteActa(null) }}
                            className="btn-ghost"
                            style={{ fontSize: '0.83rem', padding: '0.4rem 0.75rem' }}
                          >
                            Cancelar
                          </button>
                        </div>
                        {errorDeleteActa && <p style={{ margin: 0, color: 'var(--danger)', fontSize: '0.83rem' }}>{errorDeleteActa}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
          </section>

          {/* Documentos del acta */}
          {acta && (
            <section style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <SeccionTitulo>Documentos del acta</SeccionTitulo>
              <DocumentosAdjuntos acta={acta.id} puede={puede} />
            </section>
          )}

          {/* ══ IA: EXTRACCIÓN DESDE PDF ═══════════════════════════════════ */}
          {acta && acta.documentos.length > 0 && (
            <section style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <SeccionTitulo>Completar con IA desde el PDF</SeccionTitulo>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 1rem' }}>
                Seleccioná el PDF del acta y dejá que Claude lea el documento y proponga el desarrollo de cada punto, con las resoluciones y compromisos detectados.
              </p>
              <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Campo label="Documento PDF a analizar">
                  <select
                    className="select"
                    value={docExtraccion}
                    onChange={e => { setDocExtraccion(e.target.value); setErrorExtraccion(null); setPropuestaIA(null) }}
                    disabled={extrayendo}
                  >
                    <option value="">— Elegí un documento —</option>
                    {acta.documentos.map(d => <option key={d.id} value={d.id}>{d.titulo} ({d.tipo_display})</option>)}
                  </select>
                </Campo>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-gold" onClick={extraerConIA} disabled={!docExtraccion || extrayendo} style={{ padding: '0.55rem 1.2rem' }}>
                    {extrayendo ? 'Analizando el PDF…' : 'Extraer con IA'}
                  </button>
                  {extrayendo && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Puede tardar 30–90 segundos.</span>}
                </div>
                {errorExtraccion && <div className="alert-error" style={{ margin: 0 }}>{errorExtraccion}</div>}
                {propuestaIA && propuestaIA.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--gold)' }}>Propuesta lista — {propuestaIA.length} punto(s)</span>
                      <button type="button" className="btn-gold" onClick={aplicarTodaLaPropuesta} style={{ padding: '0.45rem 1rem', fontSize: '0.9rem' }}>Aplicar todos los desarrollos ↓</button>
                      <button type="button" className="btn-ghost" onClick={() => setPropuestaIA(null)} style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}>Descartar</button>
                    </div>
                    {propuestaIA.map(p => (
                      <TarjetaPropuesta
                        key={p.punto_id}
                        propuesta={p}
                        onAplicar={desarrollo => {
                          setDesarrollos(prev => ({ ...prev, [p.punto_id]: desarrollo }))
                          setPropuestaIA(prev => prev ? prev.filter(x => x.punto_id !== p.punto_id) : null)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ══ 2. DESARROLLO PUNTO A PUNTO ════════════════════════════════ */}
          <section style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <SeccionTitulo style={{ margin: 0 }}>Desarrollo de cada punto</SeccionTitulo>
              {puede && reunion && reunion.puntos.length > 0 && (
                confirmLimpiarAgenda ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.83rem', color: 'var(--danger)' }}>¿Eliminar todos los puntos?</span>
                    <button
                      type="button"
                      onClick={limpiarOrdenDelDia}
                      disabled={limpiandoAgenda}
                      style={{ background: 'var(--danger)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', padding: '0.3rem 0.7rem', fontSize: '0.8rem', opacity: limpiandoAgenda ? 0.6 : 1 }}
                    >
                      {limpiandoAgenda ? 'Eliminando…' : 'Sí, eliminar todo'}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setConfirmLimpiarAgenda(false)} style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>Cancelar</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmLimpiarAgenda(true)}
                    style={{ background: 'none', border: '1px solid var(--danger)', borderRadius: 6, color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                  >
                    Limpiar orden del día
                  </button>
                )
              )}
            </div>

            {reunion && reunion.puntos.length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>
                Esta reunión no tiene puntos en el orden del día.{' '}
                <span
                  style={{ color: 'var(--gold)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => navigate(`/reuniones/${reunionId}/orden-del-dia`)}
                >
                  Ir al orden del día →
                </span>
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {reunion?.puntos.map(punto => (
                <TarjetaPunto
                  key={punto.id}
                  punto={punto}
                  desarrollo={desarrollos[punto.id] ?? ''}
                  onCambioDesarrollo={txt => setDesarrollos(prev => ({ ...prev, [punto.id]: txt }))}
                  guardando={guardandoPunto === punto.id}
                  errorGuardado={erroresPunto[punto.id] ?? ''}
                  puede={puede}
                  onGuardar={() => guardarDesarrollo(punto)}
                  onIrAlPunto={() => navigate(`/reuniones/${reunionId}/puntos/${punto.id}`)}
                  personas={personas}
                  onDelete={() => handlePuntoEliminado(punto.id)}
                />
              ))}
            </div>
          </section>

          {/* ══ 3. TEXTO OFICIAL ═══════════════════════════════════════════ */}
          {acta && (
            <section style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <SeccionTitulo>Texto oficial del acta</SeccionTitulo>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 1rem' }}>
                Este es el texto que se imprime y firma. Podés generarlo automáticamente desde los desarrollos de cada punto o escribirlo a mano.
              </p>
              <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-ghost" onClick={generarContenido} style={{ padding: '0.45rem 1rem', fontSize: '0.9rem' }}>
                    ↻ Generar desde los puntos
                  </button>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Reemplaza el texto con el desarrollo de todos los puntos.</span>
                </div>
                <textarea
                  className="input"
                  rows={22}
                  value={contenido}
                  onChange={e => { setContenido(e.target.value); setContenidoOk(false) }}
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.88rem', lineHeight: 1.65 }}
                  placeholder="El texto del acta aparecerá aquí."
                />
                {erroresContenido.length > 0 && (
                  <div className="alert-error" style={{ margin: 0 }}>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {erroresContenido.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
                {contenidoOk && <p style={{ margin: 0, color: 'var(--success)', fontWeight: 600 }}>Texto del acta guardado correctamente.</p>}
                <div>
                  <button className="btn-gold" onClick={guardarContenido} disabled={guardandoContenido} style={{ padding: '0.55rem 1.2rem' }}>
                    {guardandoContenido ? 'Guardando…' : 'Guardar texto del acta'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {!acta && (
            <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
              Creá el acta primero para poder guardar el texto oficial.
            </p>
          )}
        </>
      )}
    </Layout>
  )
}

// ── TarjetaPunto (expandida con resoluciones/compromisos inline) ──────────────

function TarjetaPunto({
  punto,
  desarrollo,
  onCambioDesarrollo,
  guardando,
  errorGuardado,
  puede,
  onGuardar,
  onIrAlPunto,
  personas,
  onDelete,
}: {
  punto: PuntoOrden
  desarrollo: string
  onCambioDesarrollo: (txt: string) => void
  guardando: boolean
  errorGuardado: string
  puede: boolean
  onGuardar: () => void
  onIrAlPunto: () => void
  personas: PersonaLite[]
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const sinCambios = desarrollo === (punto.desarrollo ?? '')

  async function handleDelete() {
    setEliminando(true)
    try {
      await deletePunto(punto.id)
      onDelete()
    } catch {
      setEliminando(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div
      className="card"
      style={{
        padding: '1.25rem',
        borderLeft: `4px solid ${COLOR_ESTADO_PUNTO[punto.estado] ?? 'var(--border)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <span className="serif" style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '1rem' }}>
            {punto.orden}. {punto.titulo}
          </span>
          <span className="chip" style={{ color: COLOR_ESTADO_PUNTO[punto.estado] ?? 'var(--text-muted)', fontSize: '0.78rem' }}>
            {punto.estado_display}
          </span>
          {punto.empresa && (
            <span className="chip" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{punto.empresa.nombre}</span>
          )}
        </div>
      </div>

      {/* Textarea de desarrollo */}
      <Campo label="Desarrollo (qué se trató en este punto)">
        <textarea
          className="input"
          rows={5}
          value={desarrollo}
          onChange={e => onCambioDesarrollo(e.target.value)}
          disabled={!puede}
          placeholder="Describí qué se trató, qué se discutió…"
          style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }}
        />
      </Campo>

      {/* Botón guardar desarrollo */}
      {puede && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn-gold" onClick={onGuardar} disabled={guardando || sinCambios} style={{ padding: '0.45rem 1rem' }}>
            {guardando ? 'Guardando…' : 'Guardar desarrollo'}
          </button>
          {!guardando && !sinCambios && <span style={{ fontSize: '0.82rem', color: 'var(--warning)' }}>Cambios sin guardar</span>}
          {errorGuardado && <span style={{ fontSize: '0.82rem', color: 'var(--danger)' }}>{errorGuardado}</span>}
        </div>
      )}

      {/* ── Resoluciones inline ──────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
        <ResolucionesEditor puntoId={punto.id} inicial={punto.resoluciones} puede={puede} />
      </div>

      {/* ── Compromisos inline ───────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
        <CompromisosEditor puntoId={punto.id} inicial={punto.compromisos} puede={puede} personas={personas} />
      </div>

      {/* Documentos del punto */}
      <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
          Documentos adjuntos al punto:
        </span>
        <DocumentosAdjuntos punto={punto.id} puede={puede} />
      </div>

      {/* Footer: acciones */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button className="btn-ghost" onClick={onIrAlPunto} style={{ padding: '0.3rem 0.7rem', fontSize: '0.85rem' }}>
          Gestionar punto (avanzado) →
        </button>
        {puede && (
          confirmDelete ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--danger)' }}>¿Eliminar este punto?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={eliminando}
                style={{ background: 'var(--danger)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', padding: '0.3rem 0.7rem', fontSize: '0.8rem', opacity: eliminando ? 0.6 : 1 }}
              >
                {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)} style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>Cancelar</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--danger)', borderRadius: 6, color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
            >
              Eliminar punto
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ── ResolucionesEditor ────────────────────────────────────────────────────────

function ResolucionesEditor({
  puntoId,
  inicial,
  puede,
}: {
  puntoId: number
  inicial: Resolucion[]
  puede: boolean
}) {
  type ResLocal = ResolucionGestion
  const [lista, setLista] = useState<ResLocal[]>(() =>
    inicial.map(r => ({ ...r, punto: puntoId }))
  )
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ texto: '', resultado: 'APROBADA', por_unanimidad: true })
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [nuevoForm, setNuevoForm] = useState({ texto: '', resultado: 'APROBADA', por_unanimidad: true })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function iniciarEdicion(r: ResLocal) {
    setEditandoId(r.id)
    setEditForm({ texto: r.texto, resultado: r.resultado, por_unanimidad: r.por_unanimidad })
    setError(null)
  }

  async function guardarEdicion(id: number) {
    setGuardando(true)
    setError(null)
    try {
      const actualizada = await updateResolucion(id, editForm)
      setLista(prev => prev.map(r => r.id === id ? { ...actualizada, punto: puntoId } : r))
      setEditandoId(null)
    } catch {
      setError('No se pudo guardar la resolución.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleDelete(id: number) {
    setGuardando(true)
    setError(null)
    try {
      await deleteResolucion(id)
      setLista(prev => prev.filter(r => r.id !== id))
      setConfirmDeleteId(null)
    } catch {
      setError('No se pudo eliminar la resolución.')
    } finally {
      setGuardando(false)
    }
  }

  async function crearNueva() {
    if (!nuevoForm.texto.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const creada = await createResolucion({ punto: puntoId, ...nuevoForm })
      setLista(prev => [...prev, { ...creada, punto: puntoId }])
      setNuevoForm({ texto: '', resultado: 'APROBADA', por_unanimidad: true })
      setMostrarNuevo(false)
    } catch {
      setError('No se pudo crear la resolución.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          Resoluciones ({lista.length})
        </span>
        {puede && !mostrarNuevo && (
          <button
            type="button"
            onClick={() => { setMostrarNuevo(true); setError(null) }}
            style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', padding: '0.1rem 0.5rem', fontSize: '0.72rem' }}
          >
            + Nueva
          </button>
        )}
      </div>

      {lista.length === 0 && !mostrarNuevo && (
        <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Sin resoluciones formales.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {lista.map((r, i) => (
          <div key={r.id}>
            {editandoId === r.id ? (
              /* Modo edición */
              <div style={{ padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <textarea
                  className="input"
                  rows={2}
                  value={editForm.texto}
                  onChange={e => setEditForm(f => ({ ...f, texto: e.target.value }))}
                  style={{ resize: 'vertical', fontSize: '0.88rem' }}
                />
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select className="select" style={{ fontSize: '0.83rem', flex: 1, minWidth: 130 }} value={editForm.resultado} onChange={e => setEditForm(f => ({ ...f, resultado: e.target.value }))}>
                    {RESULTADOS_RESOLUCION.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.83rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={editForm.por_unanimidad} onChange={e => setEditForm(f => ({ ...f, por_unanimidad: e.target.checked }))} />
                    Por unanimidad
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn-gold" onClick={() => guardarEdicion(r.id)} disabled={guardando} style={{ padding: '0.3rem 0.75rem', fontSize: '0.82rem' }}>
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setEditandoId(null)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}>Cancelar</button>
                </div>
              </div>
            ) : confirmDeleteId === r.id ? (
              /* Confirmar eliminación */
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(201,76,76,0.07)', border: '1px solid rgba(201,76,76,0.3)', borderRadius: 6, display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.83rem', color: 'var(--danger)', flex: 1 }}>¿Eliminar esta resolución?</span>
                <button type="button" onClick={() => handleDelete(r.id)} disabled={guardando} style={{ background: 'var(--danger)', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}>
                  {guardando ? '…' : 'Sí'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmDeleteId(null)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>No</button>
              </div>
            ) : (
              /* Vista normal */
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.5rem 0.75rem', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--gold)', flexShrink: 0, marginTop: 2 }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text)' }}>{r.texto}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: COLOR_RESULTADO[r.resultado] ?? 'var(--text-muted)' }}>
                    {r.resultado_display}{r.por_unanimidad ? ' · por unanimidad' : ''}
                  </p>
                </div>
                {puede && (
                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    <button type="button" onClick={() => iniciarEdicion(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '0.1rem 0.3rem' }}>Editar</button>
                    <button type="button" onClick={() => setConfirmDeleteId(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.78rem', padding: '0.1rem 0.3rem' }}>×</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Formulario nueva resolución */}
        {mostrarNuevo && (
          <div style={{ padding: '0.75rem', background: 'var(--surface)', border: '1px dashed var(--gold)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <textarea
              className="input"
              rows={2}
              value={nuevoForm.texto}
              onChange={e => setNuevoForm(f => ({ ...f, texto: e.target.value }))}
              placeholder="Texto de la resolución…"
              style={{ resize: 'vertical', fontSize: '0.88rem' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="select" style={{ fontSize: '0.83rem', flex: 1, minWidth: 130 }} value={nuevoForm.resultado} onChange={e => setNuevoForm(f => ({ ...f, resultado: e.target.value }))}>
                {RESULTADOS_RESOLUCION.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.83rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={nuevoForm.por_unanimidad} onChange={e => setNuevoForm(f => ({ ...f, por_unanimidad: e.target.checked }))} />
                Por unanimidad
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn-gold" onClick={crearNueva} disabled={guardando || !nuevoForm.texto.trim()} style={{ padding: '0.3rem 0.75rem', fontSize: '0.82rem' }}>
                {guardando ? 'Guardando…' : 'Crear resolución'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => { setMostrarNuevo(false); setNuevoForm({ texto: '', resultado: 'APROBADA', por_unanimidad: true }) }} style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {error && <p style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--danger)', margin: '0.35rem 0 0' }}>{error}</p>}
    </div>
  )
}

// ── CompromisosEditor ─────────────────────────────────────────────────────────

function CompromisosEditor({
  puntoId,
  inicial,
  puede,
  personas,
}: {
  puntoId: number
  inicial: Compromiso[]
  puede: boolean
  personas: PersonaLite[]
}) {
  type CompLocal = CompromisoGestion
  const [lista, setLista] = useState<CompLocal[]>(() =>
    inicial.map(c => ({ ...c, punto: puntoId, resolucion: null }))
  )
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ descripcion: '', responsable: '', fecha_limite: '', para_proxima_reunion: false })
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [nuevoForm, setNuevoForm] = useState({ descripcion: '', responsable: '', fecha_limite: '', para_proxima_reunion: false })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function iniciarEdicion(c: CompLocal) {
    setEditandoId(c.id)
    setEditForm({
      descripcion: c.descripcion,
      responsable: c.responsable ? String(c.responsable.id) : '',
      fecha_limite: c.fecha_limite ?? '',
      para_proxima_reunion: c.para_proxima_reunion,
    })
    setError(null)
  }

  async function guardarEdicion(id: number) {
    if (!editForm.responsable) { setError('El responsable es obligatorio.'); return }
    setGuardando(true)
    setError(null)
    try {
      const actualizado = await updateCompromiso(id, {
        descripcion: editForm.descripcion,
        responsable: Number(editForm.responsable),
        fecha_limite: editForm.fecha_limite || null,
        para_proxima_reunion: editForm.para_proxima_reunion,
      })
      setLista(prev => prev.map(c => c.id === id ? { ...actualizado, punto: puntoId } : c))
      setEditandoId(null)
    } catch {
      setError('No se pudo guardar el compromiso.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleDelete(id: number) {
    setGuardando(true)
    setError(null)
    try {
      await deleteCompromiso(id)
      setLista(prev => prev.filter(c => c.id !== id))
      setConfirmDeleteId(null)
    } catch {
      setError('No se pudo eliminar el compromiso.')
    } finally {
      setGuardando(false)
    }
  }

  async function crearNuevo() {
    if (!nuevoForm.descripcion.trim() || !nuevoForm.responsable) {
      setError('Descripción y responsable son obligatorios.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const creado = await createCompromiso({
        punto: puntoId,
        resolucion: null,
        descripcion: nuevoForm.descripcion,
        responsable: Number(nuevoForm.responsable),
        fecha_limite: nuevoForm.fecha_limite || null,
        para_proxima_reunion: nuevoForm.para_proxima_reunion,
        estado: 'PENDIENTE',
      })
      setLista(prev => [...prev, { ...creado, punto: puntoId }])
      setNuevoForm({ descripcion: '', responsable: '', fecha_limite: '', para_proxima_reunion: false })
      setMostrarNuevo(false)
    } catch {
      setError('No se pudo crear el compromiso.')
    } finally {
      setGuardando(false)
    }
  }

  const FormCompromiso = ({ form, setForm }: { form: typeof nuevoForm; setForm: (v: typeof nuevoForm) => void }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <textarea
        className="input"
        rows={2}
        value={form.descripcion}
        onChange={e => setForm({ ...form, descripcion: e.target.value })}
        placeholder="Descripción del compromiso…"
        style={{ resize: 'vertical', fontSize: '0.88rem' }}
      />
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Campo label="Responsable" style={{ flex: 2, minWidth: 160 }}>
          <select className="select" style={{ fontSize: '0.83rem' }} value={form.responsable} onChange={e => setForm({ ...form, responsable: e.target.value })}>
            <option value="">— Seleccionar —</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}
          </select>
        </Campo>
        <Campo label="Fecha límite" style={{ flex: 1, minWidth: 130 }}>
          <input type="date" className="input" style={{ fontSize: '0.83rem' }} value={form.fecha_limite} onChange={e => setForm({ ...form, fecha_limite: e.target.value })} />
        </Campo>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.83rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.para_proxima_reunion} onChange={e => setForm({ ...form, para_proxima_reunion: e.target.checked })} />
        Para la próxima reunión
      </label>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          Compromisos ({lista.length})
        </span>
        {puede && !mostrarNuevo && (
          <button
            type="button"
            onClick={() => { setMostrarNuevo(true); setError(null) }}
            style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', padding: '0.1rem 0.5rem', fontSize: '0.72rem' }}
          >
            + Nuevo
          </button>
        )}
      </div>

      {lista.length === 0 && !mostrarNuevo && (
        <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Sin compromisos registrados.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {lista.map(c => (
          <div key={c.id}>
            {editandoId === c.id ? (
              <div style={{ padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <FormCompromiso
                  form={editForm}
                  setForm={v => setEditForm(v)}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn-gold" onClick={() => guardarEdicion(c.id)} disabled={guardando} style={{ padding: '0.3rem 0.75rem', fontSize: '0.82rem' }}>
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setEditandoId(null)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}>Cancelar</button>
                </div>
              </div>
            ) : confirmDeleteId === c.id ? (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(201,76,76,0.07)', border: '1px solid rgba(201,76,76,0.3)', borderRadius: 6, display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.83rem', color: 'var(--danger)', flex: 1 }}>¿Eliminar este compromiso?</span>
                <button type="button" onClick={() => handleDelete(c.id)} disabled={guardando} style={{ background: 'var(--danger)', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}>
                  {guardando ? '…' : 'Sí'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmDeleteId(null)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>No</button>
              </div>
            ) : (
              <div style={{ padding: '0.5rem 0.75rem', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--gold-600)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text)' }}>{c.descripcion}</p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {c.responsable?.nombre_completo ?? 'Sin responsable'}
                      {c.fecha_limite ? ` · vence ${formatFecha(c.fecha_limite)}` : ''}
                      {c.para_proxima_reunion ? ' · próxima reunión' : ''}
                      {' · '}{c.estado_display}
                    </p>
                  </div>
                  {puede && (
                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                      <button type="button" onClick={() => iniciarEdicion(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '0.1rem 0.3rem' }}>Editar</button>
                      <button type="button" onClick={() => setConfirmDeleteId(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.78rem', padding: '0.1rem 0.3rem' }}>×</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Formulario nuevo compromiso */}
        {mostrarNuevo && (
          <div style={{ padding: '0.75rem', background: 'var(--surface)', border: '1px dashed var(--gold)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <FormCompromiso
              form={nuevoForm}
              setForm={v => setNuevoForm(v)}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn-gold" onClick={crearNuevo} disabled={guardando} style={{ padding: '0.3rem 0.75rem', fontSize: '0.82rem' }}>
                {guardando ? 'Guardando…' : 'Crear compromiso'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => { setMostrarNuevo(false); setNuevoForm({ descripcion: '', responsable: '', fecha_limite: '', para_proxima_reunion: false }) }} style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {error && <p style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--danger)', margin: '0.35rem 0 0' }}>{error}</p>}
    </div>
  )
}

// ── TarjetaPropuesta ──────────────────────────────────────────────────────────

function TarjetaPropuesta({
  propuesta,
  onAplicar,
}: {
  propuesta: PropuestaPunto
  onAplicar: (desarrollo: string) => void
}) {
  const [texto, setTexto] = useState(propuesta.desarrollo)

  return (
    <div
      className="card"
      style={{
        padding: '1.1rem',
        borderLeft: '4px solid var(--gold)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        background: 'color-mix(in srgb, var(--gold) 4%, var(--surface))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span className="serif" style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '0.95rem' }}>
          {propuesta.orden}. {propuesta.titulo}
        </span>
        {propuesta.resoluciones.length > 0 && (
          <span className="chip" style={{ fontSize: '0.75rem', color: 'var(--info)' }}>{propuesta.resoluciones.length} resolución(es)</span>
        )}
        {propuesta.compromisos.length > 0 && (
          <span className="chip" style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>{propuesta.compromisos.length} compromiso(s)</span>
        )}
      </div>

      <Campo label="Desarrollo propuesto (podés editarlo antes de aplicar)">
        <textarea
          className="input"
          rows={5}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55, fontSize: '0.9rem' }}
        />
      </Campo>

      {propuesta.resoluciones.length > 0 && (
        <div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
            Resoluciones detectadas (crear manualmente si corresponde):
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {propuesta.resoluciones.map((r, i) => (
              <div
                key={i}
                style={{
                  fontSize: '0.85rem', padding: '0.4rem 0.65rem', background: 'var(--bg)', borderRadius: '6px',
                  borderLeft: `3px solid ${r.resultado === 'APROBADA' ? 'var(--success)' : r.resultado === 'RECHAZADA' ? 'var(--danger)' : 'var(--warning)'}`,
                }}
              >
                <span style={{ fontWeight: 600, marginRight: '0.4rem' }}>{r.resultado}{r.por_unanimidad ? ' (unanimidad)' : ''}:</span>
                {r.texto}
              </div>
            ))}
          </div>
        </div>
      )}

      {propuesta.compromisos.length > 0 && (
        <div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
            Compromisos detectados (crear manualmente si corresponde):
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {propuesta.compromisos.map((c, i) => (
              <div key={i} style={{ fontSize: '0.85rem', padding: '0.4rem 0.65rem', background: 'var(--bg)', borderRadius: '6px', borderLeft: '3px solid var(--warning)' }}>
                <span style={{ fontWeight: 600 }}>{c.responsable_nombre}: </span>
                {c.descripcion}
                {c.fecha_limite && <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>— vence {c.fecha_limite}</span>}
                {c.para_proxima_reunion && <span className="chip" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>próxima reunión</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          className="btn-gold"
          onClick={() => onAplicar(texto)}
          style={{ padding: '0.4rem 0.9rem', fontSize: '0.88rem' }}
        >
          Aplicar este desarrollo ↓
        </button>
      </div>
    </div>
  )
}

// ── Helpers de presentación ───────────────────────────────────────────────────

function SeccionTitulo({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <h2 className="serif" style={{ fontSize: '1.2rem', color: 'var(--gold)', margin: '0 0 0.85rem', ...style }}>
      {children}
    </h2>
  )
}

function Campo({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem', ...style }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </label>
  )
}

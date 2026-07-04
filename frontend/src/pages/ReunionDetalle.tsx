import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { descargarDocumento, deleteReunion, getReunion } from '../api/reuniones'
import type { DocumentoLite, PuntoOrden, ReunionDetalle as Detalle } from '../api/reuniones'
import { useAuth } from '../auth/AuthContext'
import {
  addPuntoTag,
  generarTagsReunion,
  getTags,
  removePuntoTag,
  tagColor,
  type PuntoTagDisplay,
  type Tag,
} from '../api/tags'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES_LARGO = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d} de ${MESES_LARGO[Number(m)]}`
}

function formatearFechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const COLOR_RESULTADO: Record<string, string> = {
  APROBADA: 'var(--success)',
  RECHAZADA: 'var(--danger)',
  POSPUESTA: 'var(--warning)',
}

const COLOR_ESTADO_REUNION: Record<string, string> = {
  CONVOCADA: 'var(--info)',
  REALIZADA: 'var(--success)',
  CANCELADA: 'var(--danger)',
}

// ── Documentos ────────────────────────────────────────────────────────────────

function Documentos({ docs }: { docs: DocumentoLite[] }) {
  if (docs.length === 0) return null
  return (
    <div style={{ marginTop: '0.75rem' }}>
      <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
        Documentos adjuntos
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {docs.map((doc) => (
          <button
            key={doc.id}
            onClick={() => descargarDocumento(doc.url_descarga, doc.titulo)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--gold)',
              cursor: 'pointer',
              padding: '0.35rem 0.75rem',
              fontSize: '0.85rem',
              textAlign: 'left',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            ↓ {doc.titulo}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: '0.4rem' }}>({doc.tipo_display})</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Tag chip (sólo lectura, para cabecera colapsada) ──────────────────────────

function TagChipMin({ pt }: { pt: PuntoTagDisplay }) {
  const color = tagColor(pt.tag)
  return (
    <Link
      to={`/tags/${encodeURIComponent(pt.tag.slug)}`}
      onClick={e => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.1rem 0.45rem',
        borderRadius: 10,
        fontSize: '0.68rem',
        fontWeight: 600,
        background: `${color}18`,
        color,
        border: `1px solid ${color}3a`,
        whiteSpace: 'nowrap',
        letterSpacing: '0.03em',
        textDecoration: 'none',
        lineHeight: 1.5,
      }}
    >
      {pt.tag.nombre_display}
    </Link>
  )
}

// ── Tags Manager (gestión completa dentro del punto expandido) ────────────────

function TagsManager({
  puntoId,
  tags,
  setTags,
  puedeGestionar,
}: {
  puntoId: number
  tags: PuntoTagDisplay[]
  setTags: Dispatch<SetStateAction<PuntoTagDisplay[]>>
  puedeGestionar: boolean
}) {
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const [catalogo, setCatalogo] = useState<Tag[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false)
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null)
  const [guardandoSlug, setGuardandoSlug] = useState<string | null>(null)
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown al clicar fuera
  useEffect(() => {
    if (!mostrarDropdown) return
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMostrarDropdown(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [mostrarDropdown])

  // Cargar catálogo la primera vez que se abre el dropdown
  useEffect(() => {
    if (!mostrarDropdown || catalogo.length > 0 || cargandoCatalogo) return
    setCargandoCatalogo(true)
    setErrorCatalogo(null)
    getTags()
      .then(lista => setCatalogo(lista))
      .catch(() => setErrorCatalogo('Sistema de tags en configuración. Disponible próximamente.'))
      .finally(() => setCargandoCatalogo(false))
  }, [mostrarDropdown, catalogo.length, cargandoCatalogo])

  const slugsActuales = new Set(tags.map(t => t.tag.slug))
  const catalogoFiltrado = catalogo
    .filter(t => !slugsActuales.has(t.slug))
    .filter(t => {
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return t.nombre_display.toLowerCase().includes(q) || t.categoria.includes(q)
    })

  async function handleAdd(tag: Tag) {
    setGuardandoSlug(tag.slug)
    setErrorGuardado(null)
    try {
      const nuevo = await addPuntoTag(puntoId, tag.slug)
      setTags(prev => [...prev, nuevo])
      setMostrarDropdown(false)
      setBusqueda('')
    } catch {
      setErrorGuardado(`No se pudo agregar "${tag.nombre_display}". El endpoint aún no está disponible.`)
    } finally {
      setGuardandoSlug(null)
    }
  }

  async function handleRemove(pt: PuntoTagDisplay) {
    setEliminandoId(pt.id)
    setErrorGuardado(null)
    const prevTags = [...tags]
    setTags(prev => prev.filter(t => t.id !== pt.id)) // optimista
    try {
      await removePuntoTag(puntoId, pt.id)
    } catch {
      setTags(prevTags) // revertir
      setErrorGuardado(`No se pudo quitar "${pt.tag.nombre_display}".`)
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <div style={{ marginBottom: '0.85rem' }}>
      {/* Cabecera de sección + botón añadir */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: 0 }}>
          Tags
        </p>
        {puedeGestionar && (
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setMostrarDropdown(v => !v) }}
              style={{
                background: 'none',
                border: '1px dashed var(--border)',
                borderRadius: 8,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.1rem 0.55rem',
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              + Añadir
            </button>

            {mostrarDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  zIndex: 200,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
                  minWidth: 230,
                  maxWidth: 290,
                  overflow: 'hidden',
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Búsqueda */}
                <div style={{ padding: '0.5rem 0.5rem 0.25rem' }}>
                  <input
                    autoFocus
                    placeholder="Buscar tag…"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border)',
                      borderRadius: 5,
                      color: 'var(--text)',
                      padding: '0.3rem 0.5rem',
                      fontSize: '0.82rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Lista */}
                <div style={{ maxHeight: 210, overflowY: 'auto' }}>
                  {cargandoCatalogo && (
                    <p style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      Cargando catálogo…
                    </p>
                  )}
                  {errorCatalogo && (
                    <p style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: 'var(--danger)', margin: 0 }}>
                      {errorCatalogo}
                    </p>
                  )}
                  {!cargandoCatalogo && !errorCatalogo && catalogoFiltrado.length === 0 && (
                    <p style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      {busqueda ? 'Sin coincidencias.' : 'Todos los tags disponibles ya están asignados.'}
                    </p>
                  )}
                  {catalogoFiltrado.map(tag => {
                    const color = tagColor(tag)
                    const isAdding = guardandoSlug === tag.slug
                    return (
                      <button
                        key={tag.slug}
                        disabled={!!guardandoSlug}
                        onClick={() => handleAdd(tag)}
                        style={{
                          width: '100%',
                          background: 'none',
                          border: 'none',
                          borderBottom: '1px solid var(--border)',
                          cursor: isAdding ? 'wait' : 'pointer',
                          padding: '0.45rem 0.75rem',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: 'var(--text)',
                          fontSize: '0.83rem',
                          opacity: isAdding ? 0.4 : 1,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { if (!guardandoSlug) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: color }} />
                        <span style={{ flex: 1 }}>{tag.nombre_display}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{tag.categoria}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tags actuales */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
        {tags.length === 0 ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Sin tags asignados.
          </span>
        ) : (
          tags.map(pt => {
            const color = tagColor(pt.tag)
            const isRemoving = eliminandoId === pt.id
            return (
              <div
                key={pt.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  padding: '0.15rem 0.35rem 0.15rem 0.55rem',
                  borderRadius: 10,
                  background: `${color}18`,
                  border: `1px solid ${color}3a`,
                  opacity: isRemoving ? 0.35 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <Link
                  to={`/tags/${encodeURIComponent(pt.tag.slug)}`}
                  onClick={e => e.stopPropagation()}
                  style={{ color, textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.02em', lineHeight: 1.4 }}
                >
                  {pt.tag.nombre_display}
                </Link>
                {pt.origen === 'IA' && (
                  <span title="Generado por IA" style={{ fontSize: '0.6rem', color, opacity: 0.65, marginLeft: '0.05rem' }}>✦</span>
                )}
                {puedeGestionar && (
                  <button
                    onClick={e => { e.stopPropagation(); handleRemove(pt) }}
                    disabled={!!eliminandoId}
                    title="Quitar tag"
                    style={{
                      background: 'none', border: 'none', padding: '0 0.05rem',
                      cursor: 'pointer', color, opacity: 0.6, fontSize: '0.75rem', lineHeight: 1,
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {errorGuardado && (
        <p style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--danger)', margin: '0.4rem 0 0' }}>
          {errorGuardado}
        </p>
      )}
    </div>
  )
}

// ── Punto colapsable ──────────────────────────────────────────────────────────

function PuntoCard({ punto, puedeGestionar, reunionId, navigate }: {
  punto: PuntoOrden
  puedeGestionar: boolean
  reunionId: number
  navigate: ReturnType<typeof useNavigate>
}) {
  const [abierto, setAbierto] = useState(false)
  const [verTranscripcion, setVerTranscripcion] = useState(false)
  // Tags: estado local (persiste mientras el componente esté montado)
  const [localTags, setLocalTags] = useState<PuntoTagDisplay[]>(punto.punto_tags ?? [])

  const totalResoluciones = punto.resoluciones.length
  const totalCompromisos = punto.compromisos.length
  const tieneResumen = !!punto.resumen
  const hayTags = localTags.length > 0

  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: '0.6rem' }}>

      {/* Cabecera — siempre visible */}
      <div
        onClick={() => setAbierto(a => !a)}
        style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.9rem 1.1rem', cursor: 'pointer', userSelect: 'none' }}
      >
        {/* Número */}
        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--gold)', flexShrink: 0, width: 28, textAlign: 'right', paddingTop: '0.15rem' }}>
          {String(punto.orden).padStart(2, '0')}
        </span>

        {/* Título + tags strip */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--text)', display: 'block' }}>
            {punto.titulo}
          </span>
          {hayTags && (
            <div
              onClick={e => e.stopPropagation()}
              style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.4rem' }}
            >
              {localTags.slice(0, 5).map(pt => (
                <TagChipMin key={pt.id} pt={pt} />
              ))}
              {localTags.length > 5 && (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '0.1rem 0.3rem', alignSelf: 'center' }}>
                  +{localTags.length - 5} más
                </span>
              )}
            </div>
          )}
        </div>

        {/* Badges de conteo + estado */}
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, alignItems: 'center', paddingTop: hayTags ? 0 : undefined }}>
          {totalResoluciones > 0 && (
            <span className="topic-tag" style={{ fontSize: '0.7rem' }}>
              {totalResoluciones} res.
            </span>
          )}
          {totalCompromisos > 0 && (
            <span className="topic-tag" style={{ fontSize: '0.7rem', opacity: 0.8 }}>
              {totalCompromisos} comp.
            </span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {punto.estado_display}
          </span>
        </div>

        {/* Toggle */}
        <span style={{ color: 'var(--gold)', fontSize: '0.85rem', transform: abierto ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0, paddingTop: '0.1rem' }}>
          ›
        </span>
      </div>

      {/* Contenido expandido */}
      {abierto && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.1rem 1.1rem', background: 'rgba(0,0,0,0.15)' }}>

          {/* Tags (gestión completa) */}
          <TagsManager
            puntoId={punto.id}
            tags={localTags}
            setTags={setLocalTags}
            puedeGestionar={puedeGestionar}
          />

          {/* Resumen */}
          {tieneResumen && (
            <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', borderRadius: 8, background: 'rgba(201,168,76,0.06)', borderLeft: '3px solid var(--gold-600)' }}>
              <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gold)', marginBottom: '0.4rem', fontWeight: 600 }}>
                Resumen
              </p>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text)', margin: 0 }}>
                {punto.resumen}
              </p>
            </div>
          )}

          {/* Transcripción */}
          {punto.desarrollo ? (
            tieneResumen ? (
              <div style={{ marginBottom: '1rem' }}>
                <button
                  onClick={e => { e.stopPropagation(); setVerTranscripcion(v => !v) }}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    fontSize: '0.78rem', color: 'var(--gold-600)',
                    textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600,
                    marginBottom: verTranscripcion ? '0.6rem' : 0,
                  }}
                >
                  <span style={{ transform: verTranscripcion ? 'rotate(90deg)' : 'rotate(0)', display: 'inline-block', transition: 'transform 0.2s' }}>›</span>
                  {verTranscripcion ? 'Ocultar transcripción' : 'Ver transcripción completa'}
                </button>
                {verTranscripcion && (
                  <p style={{ fontSize: '0.88rem', lineHeight: 1.75, color: 'var(--text-muted)', margin: 0, whiteSpace: 'pre-wrap', borderLeft: '2px solid var(--border)', paddingLeft: '0.85rem' }}>
                    {punto.desarrollo}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Transcripción
                </p>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.75, color: 'var(--text-muted)', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {punto.desarrollo}
                </p>
              </div>
            )
          ) : (
            !tieneResumen && (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 1rem' }}>
                Sin contenido registrado.
              </p>
            )
          )}

          {/* Resoluciones */}
          {punto.resoluciones.length > 0 && (
            <div style={{ marginBottom: '0.85rem' }}>
              <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Resoluciones
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {punto.resoluciones.map((res, i) => (
                  <div key={res.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.5rem 0.75rem', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--gold)', flexShrink: 0, marginTop: 2 }}>
                      #{i + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text)' }}>{res.texto}</p>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: COLOR_RESULTADO[res.resultado] ?? 'var(--text-muted)' }}>
                        {res.resultado_display}{res.por_unanimidad ? ' · por unanimidad' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compromisos */}
          {punto.compromisos.length > 0 && (
            <div style={{ marginBottom: '0.85rem' }}>
              <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Compromisos
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {punto.compromisos.map(c => (
                  <div key={c.id} style={{ padding: '0.5rem 0.75rem', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--gold-600)' }}>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text)' }}>{c.descripcion}</p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {c.responsable?.nombre_completo ?? 'Sin responsable'}
                      {c.fecha_limite ? ` · vence ${formatearFechaCorta(c.fecha_limite)}` : ''}
                      {' · '}{c.estado_display}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Documentos docs={punto.documentos} />

          {puedeGestionar && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/reuniones/${reunionId}/puntos/${punto.id}`) }}
              className="btn-ghost"
              style={{ marginTop: '0.75rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}
            >
              Gestionar punto →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página de detalle ─────────────────────────────────────────────────────────

export default function ReunionDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const puedeGestionar = !!user?.puede_gestionar_reuniones

  const [reunion, setReunion] = useState<Detalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generandoTags, setGenerandoTags] = useState(false)
  const [mensajeTags, setMensajeTags] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [confirmDeleteReunion, setConfirmDeleteReunion] = useState(false)
  const [eliminandoReunion, setEliminandoReunion] = useState(false)
  const [errorDeleteReunion, setErrorDeleteReunion] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setError(null)
    getReunion(Number(id))
      .then(data => { if (!cancelado) setReunion(data) })
      .catch(err => {
        if (cancelado) return
        setError(err?.response?.status === 404 ? 'La reunión no existe.' : 'No se pudo cargar la reunión.')
      })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [id])

  async function handleEliminarReunion() {
    if (!reunion) return
    setEliminandoReunion(true)
    setErrorDeleteReunion(null)
    try {
      await deleteReunion(reunion.id)
      navigate('/reuniones')
    } catch {
      setErrorDeleteReunion('No se pudo eliminar la reunión. Intentá de nuevo.')
      setEliminandoReunion(false)
      setConfirmDeleteReunion(false)
    }
  }

  async function handleGenerarTags() {
    if (!reunion) return
    setGenerandoTags(true)
    setMensajeTags(null)
    try {
      const res = await generarTagsReunion(reunion.id)
      // Recargar para obtener los punto_tags actualizados
      const actualizada = await getReunion(reunion.id)
      setReunion(actualizada)
      setMensajeTags({ tipo: 'ok', texto: `${res.message} (${res.creados} tags creados)` })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        setMensajeTags({ tipo: 'error', texto: 'El endpoint de tags aún no está disponible. Pendiente de implementación.' })
      } else {
        setMensajeTags({ tipo: 'error', texto: 'Error al generar tags con IA.' })
      }
    } finally {
      setGenerandoTags(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <p style={{ color: 'var(--text-muted)' }}>Cargando…</p>
      </Layout>
    )
  }

  if (error || !reunion) {
    return (
      <Layout>
        <p className="alert-error">{error ?? 'No se pudo cargar la reunión.'}</p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/reuniones">← Volver a la lista</Link>
        </p>
      </Layout>
    )
  }

  const r = reunion
  const totalResoluciones = r.puntos.reduce((acc, p) => acc + p.resoluciones.length, 0)

  return (
    <Layout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        <Link to="/reuniones" style={{ color: 'var(--gold-400)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          ‹ Reuniones
        </Link>
        <span>/</span>
        <span>{r.etiqueta}</span>
      </div>

      {/* Header card */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <p className="section-label" style={{ marginBottom: '0.4rem' }}>{r.etiqueta}</p>
            <h1 className="serif" style={{ fontSize: '1.7rem', margin: '0 0 0.75rem', fontWeight: 400, color: 'var(--text)' }}>
              {r.organo.nombre}
              <span style={{ color: 'var(--text-muted)', fontSize: '1rem', marginLeft: '0.5rem' }}>
                ({r.organo.empresa.codigo})
              </span>
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              <span>{formatearFecha(r.fecha)}{r.fecha_fin ? ` al ${formatearFecha(r.fecha_fin)}` : ''}</span>
              {r.hora_inicio && <span>{r.hora_inicio.slice(0, 5)}{r.hora_fin ? `–${r.hora_fin.slice(0, 5)}` : ''}</span>}
              <span>{r.asistencias.length} asistentes</span>
              <span>{totalResoluciones} resoluciones</span>
              <span>{r.puntos.length} puntos del orden del día</span>
            </div>
          </div>

          {/* Botones de gestión */}
          {puedeGestionar && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flexShrink: 0 }}>
              <button
                onClick={handleGenerarTags}
                disabled={generandoTags || r.puntos.length === 0}
                className="btn-ghost"
                style={{ fontSize: '0.82rem', opacity: generandoTags ? 0.6 : 1 }}
                title="Analiza todos los puntos con IA y asigna tags automáticamente"
              >
                {generandoTags ? '⏳ Generando tags…' : '✦ Tags IA'}
              </button>
              <button onClick={() => navigate(`/reuniones/${r.id}/orden-del-dia`)} className="btn-ghost" style={{ fontSize: '0.85rem' }}>
                Orden del día
              </button>
              <button onClick={() => navigate(`/reuniones/${r.id}/asistentes`)} className="btn-ghost" style={{ fontSize: '0.85rem' }}>
                Asistentes
              </button>
              <button onClick={() => navigate(`/reuniones/${r.id}/acta`)} className="btn-gold" style={{ fontSize: '0.85rem' }}>
                {r.acta ? 'Editar acta' : 'Redactar acta'}
              </button>
            </div>
          )}
        </div>

        {/* Zona de peligro: eliminar reunión */}
        {puedeGestionar && (
          <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)' }}>
            {!confirmDeleteReunion ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteReunion(true)}
                style={{
                  background: 'none', border: '1px solid rgba(201,76,76,0.4)', borderRadius: 6,
                  color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem 0.75rem',
                  fontSize: '0.78rem', letterSpacing: '0.01em', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,76,76,0.4)' }}
              >
                Eliminar reunión
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--danger)' }}>
                  ⚠ Esto elimina la reunión, su acta, todos sus puntos, resoluciones, compromisos y documentos. No se puede deshacer.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleEliminarReunion}
                    disabled={eliminandoReunion}
                    style={{
                      background: 'var(--danger)', border: 'none', borderRadius: 6,
                      color: '#fff', cursor: 'pointer', padding: '0.35rem 0.85rem',
                      fontSize: '0.82rem', opacity: eliminandoReunion ? 0.6 : 1,
                    }}
                  >
                    {eliminandoReunion ? 'Eliminando…' : 'Sí, eliminar todo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setConfirmDeleteReunion(false); setErrorDeleteReunion(null) }}
                    className="btn-ghost"
                    style={{ fontSize: '0.82rem', padding: '0.35rem 0.7rem' }}
                  >
                    Cancelar
                  </button>
                  {errorDeleteReunion && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{errorDeleteReunion}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mensaje resultado de generar tags */}
        {mensajeTags && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.6rem 0.9rem',
            borderRadius: 6,
            fontSize: '0.82rem',
            background: mensajeTags.tipo === 'ok' ? 'rgba(76,175,124,0.08)' : 'rgba(201,76,76,0.08)',
            color: mensajeTags.tipo === 'ok' ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${mensajeTags.tipo === 'ok' ? 'rgba(76,175,124,0.25)' : 'rgba(201,76,76,0.25)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{mensajeTags.texto}</span>
            <button
              onClick={() => setMensajeTags(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, fontSize: '0.85rem', padding: '0 0.25rem' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Chips de estado y tipo */}
        <div style={{ marginTop: '1.1rem' }}>
          <div className="gold-divider" style={{ marginBottom: '1rem' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <span className="topic-tag" style={{ color: COLOR_ESTADO_REUNION[r.estado] ?? 'var(--gold-300)', borderColor: COLOR_ESTADO_REUNION[r.estado] ?? 'var(--gold)' }}>
              {r.estado_display}
            </span>
            <span className="topic-tag">{r.tipo_display}</span>
            <span className="topic-tag">{r.modalidad_display}</span>
            {r.lugar && <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>{r.lugar}</span>}
            {r.observaciones && (
              <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                {r.observaciones}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Layout de 2 columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>

        {/* Columna principal */}
        <div>
          <h2 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Orden del Día
            {r.puntos.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({r.puntos.length} puntos)</span>}
          </h2>

          {r.puntos.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin puntos cargados.</p>
          ) : (
            r.puntos.map(p => (
              <PuntoCard
                key={p.id}
                punto={p}
                puedeGestionar={puedeGestionar}
                reunionId={r.id}
                navigate={navigate}
              />
            ))
          )}

          {/* Acta */}
          {r.acta && (
            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: 0 }}>
                  Acta
                </h2>
                <div className="gold-divider" />
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Estado: <strong style={{ color: 'var(--text)' }}>{r.acta.estado_display}</strong>
                  {r.acta.redactada_por ? ` · Redactada por ${r.acta.redactada_por.nombre_completo}` : ''}
                  {r.acta.fecha_aprobacion ? ` · Aprobada el ${formatearFechaCorta(r.acta.fecha_aprobacion)}` : ''}
                </p>
                {r.acta.firmada_por.length > 0 && (
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                    Firmada por: {r.acta.firmada_por.map(f => f.nombre_completo).join(', ')}
                  </p>
                )}
                <Documentos docs={r.acta.documentos} />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Resoluciones globales */}
          <div>
            <h2 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Resoluciones ({totalResoluciones})
            </h2>
            {totalResoluciones === 0 ? (
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: 0 }}>Sin resoluciones formales</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {r.puntos.flatMap(p =>
                  p.resoluciones.map((res, i) => (
                    <div key={res.id} className="card" style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--gold)', flexShrink: 0, marginTop: 2 }}>
                          #{i + 1}
                        </span>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text)', lineHeight: 1.5 }}>{res.texto}</p>
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: COLOR_RESULTADO[res.resultado] ?? 'var(--text-muted)' }}>
                            {res.resultado_display}{res.por_unanimidad ? ' · unanimidad' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Asistentes */}
          <div>
            <h2 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
              Asistentes ({r.asistencias.length})
            </h2>
            <div className="card" style={{ padding: '0.75rem' }}>
              {r.asistencias.length === 0 ? (
                <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: 0 }}>Sin asistentes registrados.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {r.asistencias.map(a => {
                    const nombre = a.persona?.nombre_completo ?? '—'
                    const initials = nombre.split(' ').filter(w => w.length > 2).map(w => w[0]).slice(0, 2).join('')
                    return (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.2)',
                          color: 'var(--gold-400)', fontSize: '0.7rem', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {initials}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {nombre}
                          </p>
                          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {a.calidad_display} · {a.estado_display}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  )
}

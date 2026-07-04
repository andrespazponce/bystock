import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { getOrganos, getReuniones, descargarDocumento } from '../api/reuniones'
import type { Organo, Reunion } from '../api/reuniones'
import { getDocumentos } from '../api/documentos'
import type { Documento } from '../api/documentos'
import { useAuth } from '../auth/AuthContext'

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function parseFecha(iso: string) {
  const [, m, d] = iso.split('-')
  return { dia: d, mes: MESES[Number(m)] }
}

const COLOR_ESTADO: Record<string, string> = {
  CONVOCADA: 'var(--info)',
  REALIZADA: 'var(--success)',
  CANCELADA: 'var(--danger)',
}

// ── Tarjeta de reunión ────────────────────────────────────────────────────────

function ReunionCard({
  r,
  onClick,
  actaDoc,
}: {
  r: Reunion
  onClick: () => void
  actaDoc?: Documento
}) {
  const { dia, mes } = parseFecha(r.fecha)
  const [descargando, setDescargando] = useState(false)

  async function handleDescargar(e: React.MouseEvent) {
    e.stopPropagation()
    if (!actaDoc || descargando) return
    setDescargando(true)
    try {
      const nombreArchivo = `${r.etiqueta.replace(/\//g, '-')} Acta.pdf`
      await descargarDocumento(actaDoc.url_descarga, nombreArchivo)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '1.1rem 1.25rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1.25rem',
        cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateX(0)')}
    >
      {/* Bloque de fecha */}
      <div style={{ flexShrink: 0, width: 48, textAlign: 'center' }}>
        <div className="serif" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--gold-400)', lineHeight: 1 }}>
          {dia}
        </div>
        <div style={{ fontSize: '0.72rem', marginTop: 2, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {mes}
        </div>
      </div>

      {/* Divisor vertical */}
      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', flexShrink: 0 }} />

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gold)' }}>
            {r.etiqueta}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '1px 8px',
              borderRadius: 99,
              border: `1px solid ${COLOR_ESTADO[r.estado] ?? 'var(--border)'}`,
              color: COLOR_ESTADO[r.estado] ?? 'var(--text-muted)',
              background: 'transparent',
            }}
          >
            {r.estado_display}
          </span>
        </div>

        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.4rem' }}>
          {r.organo.nombre}
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>
            {' '}({r.organo.empresa.codigo})
          </span>
        </div>

        {/* Tipo — Modalidad · lugar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--gold)', fontWeight: 500 }}>
            {r.tipo_display} — {r.modalidad_display}
          </span>
          {r.lugar && (
            <>
              <span style={{ color: 'var(--border)', fontSize: '0.75rem' }}>·</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.lugar}</span>
            </>
          )}
        </div>

        {/* Botón de descarga (solo si hay acta PDF) */}
        {actaDoc && (
          <div style={{ marginTop: '0.6rem' }}>
            <button
              onClick={handleDescargar}
              disabled={descargando}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '4px',
                border: '1px solid var(--gold)',
                color: 'var(--gold)',
                background: 'var(--gold-soft)',
                cursor: descargando ? 'default' : 'pointer',
                opacity: descargando ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {descargando ? (
                <>⏳ Descargando…</>
              ) : (
                <>↓ Acta PDF</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Flecha de navegación */}
      <div style={{ flexShrink: 0, color: 'var(--gold-600)', fontSize: '1rem', alignSelf: 'center' }}>
        →
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Reuniones() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const puedeGestionar = !!user?.puede_gestionar_reuniones

  const [organos, setOrganos] = useState<Organo[]>([])
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [count, setCount] = useState(0)
  const [actasMap, setActasMap] = useState<Map<number, Documento>>(new Map())
  const [organoId, setOrganoId] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    getOrganos().then(setOrganos).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setError(null)

    async function cargarTodo() {
      // Carga todas las páginas de reuniones + todos los PDFs de actas en paralelo
      const [todas, actas] = await Promise.all([
        cargarTodasReuniones(),
        cargarTodasActasPDF(),
      ])
      if (cancelado) return

      setReuniones(todas.lista)
      setCount(todas.total)

      // Mapa reunion_id → documento (primera acta encontrada por reunión)
      const mapa = new Map<number, Documento>()
      for (const doc of actas) {
        if (doc.reunion && !mapa.has(doc.reunion.id)) {
          mapa.set(doc.reunion.id, doc)
        }
      }
      setActasMap(mapa)
    }

    cargarTodo()
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar las reuniones. Probá de nuevo.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => { cancelado = true }
  }, [organoId, refreshKey])

  async function cargarTodasReuniones() {
    const lista: Reunion[] = []
    let pagina = 1
    let total = 0
    while (true) {
      const data = await getReuniones({ organo: organoId || undefined, page: pagina })
      lista.push(...data.results)
      total = data.count
      if (!data.next) break
      pagina++
    }
    return { lista, total }
  }

  async function cargarTodasActasPDF() {
    const docs: Documento[] = []
    let pagina = 1
    while (true) {
      const data = await getDocumentos({ tipo: 'ACTA_FIRMADA', page: pagina })
      docs.push(...data.results)
      if (!data.next) break
      pagina++
    }
    return docs
  }

  // Agrupar por gestión (año), descendente
  const gestionesOrdenadas = [...new Set(reuniones.map(r => r.gestion))].sort((a, b) => b - a)
  const porGestion: Record<number, Reunion[]> = {}
  for (const g of gestionesOrdenadas) {
    porGestion[g] = reuniones.filter(r => r.gestion === g)
  }

  return (
    <Layout>
      {/* Encabezado */}
      <div style={{ marginBottom: '2rem' }}>
        <p className="section-label" style={{ marginBottom: '0.4rem' }}>Archivo</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 className="serif" style={{ fontSize: '2rem', margin: 0, color: 'var(--text)', fontWeight: 400 }}>
              Reuniones de Directorio
            </h1>
            {!loading && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.3rem' }}>
                {count} reuniones registradas · {gestionesOrdenadas.length} gestiones
                {actasMap.size > 0 && (
                  <span style={{ color: 'var(--gold)', marginLeft: '0.5rem' }}>
                    · {actasMap.size} actas en PDF
                  </span>
                )}
              </p>
            )}
          </div>

          {puedeGestionar && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/reuniones/desde-convocatoria')}
                className="btn-ghost"
                title="Crear reunión leyendo una convocatoria con IA"
              >
                Desde convocatoria
              </button>
              <button
                onClick={() => navigate('/actas/nueva-desde-pdf')}
                className="btn-ghost"
                title="Cargar acta ya realizada desde un PDF"
              >
                Cargar acta PDF
              </button>
              <button onClick={() => navigate('/reuniones/nueva')} className="btn-gold">
                + Nueva reunión
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <select
          className="select"
          value={organoId}
          onChange={(e) => setOrganoId(e.target.value ? Number(e.target.value) : '')}
          style={{ minWidth: 180 }}
        >
          <option value="">Todos los órganos</option>
          {organos.map((o) => (
            <option key={o.id} value={o.id}>{o.nombre} ({o.empresa.codigo})</option>
          ))}
        </select>

        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          className="btn-ghost"
          style={{ marginLeft: 'auto' }}
        >
          {loading ? 'Cargando…' : '↻ Actualizar'}
        </button>
      </div>

      {/* Estados */}
      {loading && <p style={{ color: 'var(--text-muted)' }}>Cargando reuniones…</p>}
      {error && <p className="alert-error">{error}</p>}
      {!loading && !error && reuniones.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>No hay reuniones para mostrar.</p>
      )}

      {/* Grupos por año */}
      {!loading && !error && gestionesOrdenadas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {gestionesOrdenadas.map((gestion) => (
            <div key={gestion}>
              {/* Cabecera del año */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <h2 className="serif" style={{ fontSize: '1.3rem', margin: 0, fontWeight: 400, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  {gestion}
                </h2>
                <div className="gold-divider" />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {porGestion[gestion].length} reuniones
                </span>
              </div>

              {/* Tarjetas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {porGestion[gestion].map((r) => (
                  <ReunionCard
                    key={r.id}
                    r={r}
                    onClick={() => navigate(`/reuniones/${r.id}`)}
                    actaDoc={actasMap.get(r.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { getTagHistoria, tagColor, type TagHistoriaItem, type TagHistoriaResponse } from '../api/tags'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatFecha(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d} ${MESES[Number(m)]}. ${a}`
}

// ── Ítem cronológico ──────────────────────────────────────────────────────────

function HistoriaItem({ item, color }: { item: TagHistoriaItem; color: string }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      {/* Línea temporal */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 36 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color, border: `2px solid ${color}`,
          flexShrink: 0, marginTop: 6,
        }} />
        <div style={{ width: 2, flex: 1, background: `${color}22`, marginTop: 4, minHeight: 20 }} />
      </div>

      {/* Contenido */}
      <div className="card" style={{ flex: 1, padding: '0.85rem 1rem', marginBottom: '0.6rem' }}>
        {/* Cabecera: fecha + reunión */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color, fontWeight: 700, letterSpacing: '0.04em' }}>
              {formatFecha(item.reunion_fecha)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              {item.organo_nombre}
            </span>
          </div>
          <Link
            to={`/reuniones/${item.reunion_id}`}
            style={{ fontSize: '0.75rem', color: 'var(--gold-400)', textDecoration: 'none', flexShrink: 0 }}
          >
            Acta {item.reunion_numero}/{item.reunion_gestion} →
          </Link>
        </div>

        {/* Punto */}
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text)', fontWeight: 500, lineHeight: 1.5 }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--gold)', marginRight: '0.5rem' }}>
            {String(item.punto_orden).padStart(2, '0')}
          </span>
          {item.punto_titulo}
        </p>

        {/* Notas del tag (si las hay) */}
        {item.notas && (
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', borderLeft: `2px solid ${color}44`, paddingLeft: '0.6rem' }}>
            {item.notas}
          </p>
        )}

        {/* Origen */}
        {item.origen === 'IA' && (
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color }}>✦</span> Detectado por IA
          </p>
        )}
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function TagHistoriaPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<TagHistoriaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelado = false
    setLoading(true)
    setError(null)
    getTagHistoria(slug)
      .then(res => { if (!cancelado) setData(res) })
      .catch(err => {
        if (cancelado) return
        const status = err?.response?.status
        if (status === 404) {
          setError('Este tag no existe o el sistema de tags aún no está disponible.')
        } else {
          setError('No se pudo cargar el historial de este tag.')
        }
      })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [slug])

  if (loading) {
    return (
      <Layout>
        <p style={{ color: 'var(--text-muted)' }}>Cargando historial…</p>
      </Layout>
    )
  }

  if (error || !data) {
    return (
      <Layout>
        <div style={{ marginBottom: '1.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <Link to="/reuniones" style={{ color: 'var(--gold-400)' }}>‹ Reuniones</Link>
        </div>
        <p className="alert-error">{error ?? 'Error desconocido.'}</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          El módulo de Tags estará disponible una vez que el backend implemente los endpoints correspondientes.
        </p>
      </Layout>
    )
  }

  const { tag, historia, total } = data
  const color = tagColor(tag)

  // Agrupar por año para mostrar separadores
  const porGestion: Record<number, TagHistoriaItem[]> = {}
  for (const item of historia) {
    const gestion = item.reunion_gestion
    if (!porGestion[gestion]) porGestion[gestion] = []
    porGestion[gestion].push(item)
  }
  const gestiones = Object.keys(porGestion).map(Number).sort((a, b) => b - a)

  return (
    <Layout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        <Link to="/reuniones" style={{ color: 'var(--gold-400)' }}>‹ Reuniones</Link>
        <span>/</span>
        <span>Tags</span>
        <span>/</span>
        <span style={{ color }}>{tag.nombre_display}</span>
      </div>

      {/* Header del tag */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            {/* Chip de categoría */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.15rem 0.6rem',
              borderRadius: 10,
              fontSize: '0.72rem',
              fontWeight: 700,
              background: `${color}18`,
              color,
              border: `1px solid ${color}3a`,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.6rem',
            }}>
              {tag.categoria}
            </span>

            <h1 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-serif, serif)' }}>
              {tag.nombre_display}
            </h1>

            {tag.descripcion && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>
                {tag.descripcion}
              </p>
            )}

            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
              <span>
                <strong style={{ color: 'var(--text)', fontSize: '1.1rem' }}>{total}</strong>
                {' '}aparición{total !== 1 ? 'es' : ''} en actas
              </span>
              {gestiones.length > 1 && (
                <span>
                  <strong style={{ color: 'var(--text)', fontSize: '1.1rem' }}>{gestiones.length}</strong>
                  {' '}gestiones distintas
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="gold-divider" style={{ marginTop: '1.1rem' }} />
      </div>

      {/* Línea de tiempo cronológica */}
      {total === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Este tag aún no tiene apariciones registradas.</p>
        </div>
      ) : (
        gestiones.map(gestion => (
          <div key={gestion} style={{ marginBottom: '2rem' }}>
            {/* Separador de gestión */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
                Gestión {gestion}
              </span>
              <div className="gold-divider" />
            </div>

            {porGestion[gestion].map(item => (
              <HistoriaItem key={item.id} item={item} color={color} />
            ))}
          </div>
        ))
      )}
    </Layout>
  )
}

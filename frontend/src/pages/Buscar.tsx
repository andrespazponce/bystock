import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { getReuniones } from '../api/reuniones'
import type { Reunion } from '../api/reuniones'
import { getCompromisos } from '../api/compromisos'
import type { Compromiso } from '../api/compromisos'
import { getDocumentos } from '../api/documentos'
import type { Documento } from '../api/documentos'
import { descargarDocumento } from '../api/reuniones'

const MIN_CARACTERES = 2

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

interface Resultados {
  reuniones: Reunion[]
  compromisos: Compromiso[]
  documentos: Documento[]
}

export default function Buscar() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [res, setRes] = useState<Resultados | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounce: esperamos 400ms tras la última tecla antes de buscar.
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 400)
    return () => clearTimeout(t)
  }, [input])

  useEffect(() => {
    if (query.length < MIN_CARACTERES) {
      setRes(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelado = false
    setLoading(true)
    setError(null)
    // Los tres endpoints en paralelo; cada uno filtra por ?search=.
    Promise.all([
      getReuniones({ search: query }),
      getCompromisos({ search: query }),
      getDocumentos({ search: query }),
    ])
      .then(([reuniones, compromisos, documentos]) => {
        if (cancelado) return
        setRes({
          reuniones: reuniones.results,
          compromisos: compromisos.results,
          documentos: documentos.results,
        })
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo completar la búsqueda.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [query])

  const total = res ? res.reuniones.length + res.compromisos.length + res.documentos.length : 0

  return (
    <Layout>
      <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
        Buscar
      </h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>
        Busca en reuniones, compromisos y documentos a la vez.
      </p>

      <input
        type="search"
        className="input"
        autoFocus
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Escribí al menos 2 caracteres…"
        style={{ marginTop: '1.25rem', width: '100%', fontSize: '1.05rem', padding: '0.7rem 0.9rem' }}
      />

      {loading && <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Buscando…</p>}
      {error && <p className="alert-error" style={{ marginTop: '1.5rem' }}>{error}</p>}

      {!loading && !error && query.length >= MIN_CARACTERES && total === 0 && (
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>
          Sin resultados para «{query}».
        </p>
      )}

      {!loading && !error && res && total > 0 && (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Reuniones */}
          <Seccion titulo="Reuniones" cantidad={res.reuniones.length}>
            {res.reuniones.map((r) => (
              <Fila key={r.id} onClick={() => navigate(`/reuniones/${r.id}`)}>
                <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{r.etiqueta}</span> · {r.organo.nombre}{' '}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  ({r.organo.empresa.codigo}) · {formatearFecha(r.fecha)}
                </span>
              </Fila>
            ))}
          </Seccion>

          {/* Compromisos */}
          <Seccion titulo="Compromisos" cantidad={res.compromisos.length}>
            {res.compromisos.map((c) => (
              <Fila key={c.id} onClick={() => navigate(`/reuniones/${c.reunion_id}`)}>
                {c.descripcion}{' '}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  — {c.responsable?.nombre_completo ?? 'sin responsable'} · {c.estado_display}
                  {c.vencido && <span style={{ color: 'var(--danger)' }}> · vencido</span>}
                </span>
              </Fila>
            ))}
          </Seccion>

          {/* Documentos */}
          <Seccion titulo="Documentos" cantidad={res.documentos.length}>
            {res.documentos.map((d) => (
              <Fila key={d.id} onClick={() => descargarDocumento(d.url_descarga, d.titulo)} title="Descargar documento">
                {d.titulo}{' '}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>· {d.tipo_display}</span>
              </Fila>
            ))}
          </Seccion>
        </div>
      )}
    </Layout>
  )
}

function Seccion({ titulo, cantidad, children }: { titulo: string; cantidad: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: '0.85rem', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>
        {titulo.toUpperCase()} ({cantidad})
      </h2>
      {cantidad === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Sin coincidencias.</p>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>{children}</div>
      )}
    </section>
  )
}

function Fila({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  title?: string
}) {
  return (
    <div
      onClick={onClick}
      title={title}
      style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </div>
  )
}

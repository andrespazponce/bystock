import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { getDocumentos, TIPOS_DOCUMENTO } from '../api/documentos'
import type { Documento } from '../api/documentos'
import { descargarDocumento } from '../api/reuniones'

const PAGE_SIZE = 20

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export default function Documentos() {
  const navigate = useNavigate()

  const [tipo, setTipo] = useState('')
  const [busquedaInput, setBusquedaInput] = useState('') // lo que el usuario teclea
  const [busqueda, setBusqueda] = useState('') // valor aplicado (con debounce)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Documento[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [descargando, setDescargando] = useState<number | null>(null)

  // Debounce: esperamos 400ms tras la última tecla antes de buscar,
  // así no disparamos un pedido por cada caracter.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(busquedaInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [busquedaInput])

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setError(null)
    getDocumentos({
      tipo: tipo || undefined,
      search: busqueda || undefined,
      page,
    })
      .then((data) => {
        if (cancelado) return
        setItems(data.results)
        setCount(data.count)
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar los documentos.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [tipo, busqueda, page])

  async function handleDescargar(doc: Documento) {
    setDescargando(doc.id)
    try {
      await descargarDocumento(doc.url_descarga, doc.titulo)
    } catch {
      setError('No se pudo descargar el documento.')
    } finally {
      setDescargando(null)
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <Layout>
      <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
        Documentos
      </h1>

      {/* Filtros: búsqueda por texto + tipo */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          className="input"
          value={busquedaInput}
          onChange={(e) => setBusquedaInput(e.target.value)}
          placeholder="Buscar por título o descripción…"
          style={{ flex: '1 1 280px', minWidth: 200 }}
        />
        <select
          className="select"
          value={tipo}
          onChange={(e) => {
            setPage(1)
            setTipo(e.target.value)
          }}
        >
          <option value="">Todos los tipos</option>
          {TIPOS_DOCUMENTO.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>}
      {error && <p className="alert-error" style={{ marginTop: '1.5rem' }}>{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>No se encontraron documentos.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <table className="tabla" style={{ marginTop: '1.5rem' }}>
          <thead>
            <tr>
              <th>Título</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Origen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>
                  <div>{d.titulo}</div>
                  {d.descripcion && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{d.descripcion}</div>
                  )}
                </td>
                <td>{d.tipo_display}</td>
                <td>{formatearFecha(d.fecha)}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {d.reunion ? (
                    <span
                      onClick={() => navigate(`/reuniones/${d.reunion!.id}`)}
                      style={{ cursor: 'pointer', color: 'var(--gold)' }}
                      title="Ver la reunión de origen"
                    >
                      {d.reunion.etiqueta} · {d.reunion.organo}
                    </span>
                  ) : (
                    d.empresa?.nombre ?? '—'
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => handleDescargar(d)} disabled={descargando === d.id} className="btn-gold">
                    {descargando === d.id ? 'Descargando…' : 'Descargar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !error && count > PAGE_SIZE && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost">
            ← Anterior
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Página {page} de {totalPaginas} ({count} documentos)
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))} disabled={page >= totalPaginas} className="btn-ghost">
            Siguiente →
          </button>
        </div>
      )}
    </Layout>
  )
}
